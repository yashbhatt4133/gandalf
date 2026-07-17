// Quiz generation + defensive parsing. Runs server-side (not client-side,
// despite DEPLOYMENT.md's original sketch) because `correct_option` is now
// persisted as an answer key and must never reach the browser unanswered —
// see ERD.md's "behavior change from the original" note on quiz_questions.

const QUESTION_TYPES_HINT = `Mix "mcq" (a conceptual question) and "predict_output" (a short code snippet + options describing its output/behavior) question types where the topic suits code; use "mcq" only if the topic isn't code-related.`;

function questionTypeConstraint(preferredQuestionTypes) {
  if (!preferredQuestionTypes || preferredQuestionTypes.length === 0) return QUESTION_TYPES_HINT;
  if (preferredQuestionTypes.length === 1) {
    return `Use ONLY the "${preferredQuestionTypes[0]}" question type for every question — this is the candidate's stated preference.`;
  }
  return QUESTION_TYPES_HINT;
}

function buildPrompt({ topic, domain, questionCount, level, avoidQuestions, preferredQuestionTypes, description, feedbackNotes, focusTags }) {
  const avoid = avoidQuestions?.length
    ? `\n\nThe candidate has already been asked the questions below in past sessions. Write genuinely NEW questions — do not repeat, paraphrase, or closely resemble any of these:\n${avoidQuestions.map((q) => `- ${q}`).join('\n')}`
    : '';
  const desc = description?.trim() ? `\n\nThe candidate specifically requested: "${description.trim()}". Tailor the questions accordingly.` : '';
  const notes = feedbackNotes?.length
    ? `\n\nThe candidate left this feedback on earlier questions — take it seriously and clearly improve on it:\n${feedbackNotes.map((n) => `- ${n}`).join('\n')}`
    : '';
  const focus = focusTags?.length
    ? `\n\nThe candidate was weak on these specific sub-topics in an earlier quiz — concentrate the questions there to re-test exactly those gaps: ${focusTags.join(', ')}.`
    : '';

  return `You are writing ${questionCount} multiple-choice interview-prep questions for the topic "${topic}" (domain: ${domain}), for a candidate at "${level}" difficulty level, for a first-round technical screening (OA/OT). Write realistic, exam-style questions of the kind actually asked in company online assessments — specific and technical, NOT generic "how should you study" advice questions.

${questionTypeConstraint(preferredQuestionTypes)}${desc}${notes}${focus}

Return ONLY a JSON array (no markdown fences, no prose) of exactly ${questionCount} objects, each shaped exactly like:
{
  "question_text": string,
  "question_type": "mcq" | "predict_output",
  "code_snippet": string or null (only for predict_output),
  "language": string or null (e.g. "python", "java", "javascript", "cpp" — only for predict_output),
  "options": { "A": string, "B": string, "C": string, "D": string },
  "correct_option": "A" | "B" | "C" | "D",
  "explanation": string (1-3 sentences, why the correct option is correct),
  "difficulty": "foundational" | "core" | "advanced",
  "tags": array of 3-4 short lowercase topic tags, e.g. ["recursion", "stacks", "time-complexity"]
}${avoid}`;
}

function isValidQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.question_text !== 'string' || !q.question_text.trim()) return false;
  if (!['mcq', 'predict_output'].includes(q.question_type)) return false;
  if (!q.options || typeof q.options !== 'object') return false;
  const keys = Object.keys(q.options);
  if (!['A', 'B', 'C', 'D'].every((k) => keys.includes(k))) return false;
  if (!['A', 'B', 'C', 'D'].includes(q.correct_option)) return false;
  return true;
}

function normalizeTags(tags, fallbackTopic) {
  const cleaned = Array.isArray(tags)
    ? tags
        .filter((t) => typeof t === 'string' && t.trim())
        .map((t) => t.trim().toLowerCase())
        .slice(0, 4)
    : [];
  return cleaned.length > 0 ? cleaned : [fallbackTopic.toLowerCase()];
}

function normalizeQuestion(q, index, topic) {
  return {
    question_text: q.question_text.trim(),
    question_type: q.question_type,
    code_snippet: q.question_type === 'predict_output' ? q.code_snippet ?? null : null,
    language: q.question_type === 'predict_output' ? q.language ?? null : null,
    options: q.options,
    correct_option: q.correct_option,
    explanation: typeof q.explanation === 'string' ? q.explanation : '',
    difficulty: ['foundational', 'core', 'advanced'].includes(q.difficulty) ? q.difficulty : 'core',
    order_index: index,
    tags: normalizeTags(q.tags, topic),
  };
}

/** Defensive parse of the LLM's raw text into validated question objects. */
export function parseGeneratedQuiz(rawText, expectedCount, topic) {
  let jsonText = rawText.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonText = fenced[1].trim();

  const start = jsonText.indexOf('[');
  const end = jsonText.lastIndexOf(']');
  if (start !== -1 && end !== -1) jsonText = jsonText.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(isValidQuestion).slice(0, expectedCount);
    if (valid.length === 0) return null;
    return valid.map((q, i) => normalizeQuestion(q, i, topic));
  } catch {
    return null;
  }
}

export async function generateQuizBatch({ provider, model, apiKey, topic, domain, questionCount, level, avoidQuestions, preferredQuestionTypes, description, feedbackNotes, focusTags }) {
  const prompt = buildPrompt({ topic, domain, questionCount, level, avoidQuestions, preferredQuestionTypes, description, feedbackNotes, focusTags });

  // There is NO static fallback bank — the app is LLM-only, so a working
  // provider (local Ollama or a cloud API) must be configured. Provider/config/
  // network errors propagate untouched; a response that can't be parsed after
  // one retry (temperature is non-zero, so the retry differs) throws too, rather
  // than silently serving canned filler.
  let raw = await provider.generateText({ prompt, model, apiKey });
  let parsed = parseGeneratedQuiz(raw, questionCount, topic);
  if (parsed && parsed.length > 0) return parsed;

  raw = await provider.generateText({ prompt, model, apiKey });
  parsed = parseGeneratedQuiz(raw, questionCount, topic);
  if (parsed && parsed.length > 0) return parsed;

  throw new Error(`The AI provider returned an unreadable response for "${topic}" twice. Try again, or switch model/provider in Settings.`);
}

export async function generateOneAdaptiveQuestion({ provider, model, apiKey, topic, domain, level, avoidQuestions, preferredQuestionTypes, description, feedbackNotes }) {
  const [question] = await generateQuizBatch({ provider, model, apiKey, topic, domain, questionCount: 1, level, avoidQuestions, preferredQuestionTypes, description, feedbackNotes });
  return question;
}

// ---------- Dynamic topic suggestions (Adaptive Quiz topic picker) ----------

/** Defensive parse of the suggestion model's JSON array of short strings. */
export function parseTopicList(raw) {
  let t = (raw || '').trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  try {
    const parsed = JSON.parse(t);
    if (!Array.isArray(parsed)) return null;
    const clean = Array.from(
      new Set(parsed.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().replace(/\s+/g, ' ').slice(0, 60)))
    ).slice(0, 6);
    return clean.length ? clean : null;
  } catch {
    return null;
  }
}

/** Generate a handful of specific, practiceable sub-topics for a domain. */
export async function generateTopicSuggestions({ provider, model, apiKey, domain, targetRole, interests, existing }) {
  const avoid = existing?.length ? `\n\nDo NOT repeat any of these already-listed topics: ${existing.join(', ')}.` : '';
  const persona = targetRole ? ` The candidate is preparing for ${targetRole} interviews.` : '';
  const interestLine = interests?.length ? ` They're interested in ${interests.slice(0, 5).join(', ')} — lean toward sub-topics that connect where natural.` : '';
  const prompt = `List 6 specific, practiceable sub-topics within the interview-prep domain "${domain}" that are commonly tested in first-round technical online assessments (OA/OT).${persona}${interestLine} Each must be a short noun phrase (2-5 words), specific enough to build a focused quiz around — never the whole domain again, and no "how to study" meta-topics.${avoid}

Return ONLY a JSON array of exactly 6 short strings (no markdown fences, no prose), e.g. ["Sliding Window", "Two Pointers", "Monotonic Stack", ...].`;

  let parsed = parseTopicList(await provider.generateText({ prompt, model, apiKey }));
  if (!parsed) parsed = parseTopicList(await provider.generateText({ prompt, model, apiKey }));
  if (!parsed) throw new Error('The AI provider returned an unreadable topic list. Try again, or switch model/provider in Settings.');
  return parsed;
}

// ---------- Per-question review helpers (History screen: Explain More / Validate) ----------

function formatOptions(options) {
  return ['A', 'B', 'C', 'D'].filter((k) => options?.[k]).map((k) => `${k}) ${options[k]}`).join('\n');
}

/** A fresh, personalized explanation of one question — for the "Explain More" button. */
export async function generateExplanation({ provider, model, apiKey, question, targetRole, interests }) {
  const codeBlock = question.code_snippet ? `\n\nCode snippet:\n${question.code_snippet}` : '';
  const persona = [];
  if (targetRole) persona.push(`preparing for ${targetRole} interviews`);
  if (interests?.length) persona.push(`interested in ${interests.slice(0, 5).join(', ')}`);
  const personaLine = persona.length ? ` The learner is ${persona.join(' and ')}; where it genuinely helps, use a short analogy from those interests to make it stick.` : '';

  const prompt = `You are a patient interview-prep tutor. Explain, clearly and step by step, why the correct answer to this question is what it is — and briefly why the tempting wrong options are wrong.${personaLine}

Question: ${question.question_text}${codeBlock}
Options:
${formatOptions(question.options)}
The answer key marks the correct option as: ${question.correct_option}

Write plain prose, 3-6 sentences. Do NOT repeat the full question or re-list the options. IMPORTANT: if the answer key's marked option is actually wrong, say so plainly and explain the truly correct answer instead of defending the key.`;

  const raw = await provider.generateText({ prompt, model, apiKey });
  const text = (raw || '').trim();
  if (!text) throw new Error('The AI provider returned an empty explanation. Try again, or switch model/provider in Settings.');
  return text;
}

/** Defensive parse of the validator's single JSON object. */
export function parseValidation(raw) {
  let t = (raw || '').trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  try {
    const o = JSON.parse(t);
    const ans = String(o.independent_answer ?? '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(ans)) return null;
    return {
      independentAnswer: ans,
      verdict: typeof o.verdict === 'string' ? o.verdict.trim() : '',
      explanation: typeof o.explanation === 'string' ? o.explanation.trim() : '',
    };
  } catch {
    return null;
  }
}

/**
 * Independently re-solves a question and checks the stored answer key — for the
 * "Validate" button. Whether the key is correct is derived from the validator's
 * independent answer vs. the stored `correct_option`, not the model's own boolean.
 */
export async function validateGeneratedQuestion({ provider, model, apiKey, question }) {
  const codeBlock = question.code_snippet ? `\n\nCode snippet:\n${question.code_snippet}` : '';
  const prompt = `You are a meticulous answer-key checker for interview-prep questions. Independently solve the question below from scratch, then judge whether the provided answer key is correct.

Question: ${question.question_text}${codeBlock}
Options:
${formatOptions(question.options)}

The answer key currently claims the correct option is "${question.correct_option}"${question.explanation ? ` with the explanation: "${question.explanation}"` : ''}.

Return ONLY a JSON object (no markdown fences, no extra prose) shaped exactly:
{
  "independent_answer": "A" | "B" | "C" | "D",
  "verdict": "one concise sentence: confirm the key, or state which option is actually correct and why the key is wrong",
  "explanation": "a correct, clear 2-4 sentence explanation of the truly correct answer"
}`;

  let parsed = parseValidation(await provider.generateText({ prompt, model, apiKey }));
  if (!parsed) parsed = parseValidation(await provider.generateText({ prompt, model, apiKey }));
  if (!parsed) throw new Error('The AI provider returned an unreadable validation response. Try again, or switch model/provider in Settings.');

  return { ...parsed, keyIsCorrect: parsed.independentAnswer === String(question.correct_option).trim().toUpperCase() };
}
