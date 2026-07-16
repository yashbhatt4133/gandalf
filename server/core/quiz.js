// Quiz generation + defensive parsing. Runs server-side (not client-side,
// despite DEPLOYMENT.md's original sketch) because `correct_option` is now
// persisted as an answer key and must never reach the browser unanswered —
// see ERD.md's "behavior change from the original" note on quiz_questions.

const QUESTION_TYPES_HINT = `Mix "mcq" (a conceptual question) and "predict_output" (a short code snippet + options describing its output/behavior) question types where the topic suits code; use "mcq" only if the topic isn't code-related.`;

function buildPrompt({ topic, domain, questionCount, level, avoidQuestions }) {
  const avoid = avoidQuestions?.length ? `\nDo not repeat or closely resemble any of these already-asked questions:\n${avoidQuestions.map((q) => `- ${q}`).join('\n')}` : '';

  return `You are writing ${questionCount} multiple-choice interview-prep questions for the topic "${topic}" (domain: ${domain}), for a candidate at "${level}" difficulty level, for a first-round technical screening (OA/OT).

${QUESTION_TYPES_HINT}

Return ONLY a JSON array (no markdown fences, no prose) of exactly ${questionCount} objects, each shaped exactly like:
{
  "question_text": string,
  "question_type": "mcq" | "predict_output",
  "code_snippet": string or null (only for predict_output),
  "language": string or null (e.g. "python", "java", "javascript", "cpp" — only for predict_output),
  "options": { "A": string, "B": string, "C": string, "D": string },
  "correct_option": "A" | "B" | "C" | "D",
  "explanation": string (1-3 sentences, why the correct option is correct),
  "difficulty": "foundational" | "core" | "advanced"
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

function normalizeQuestion(q, index) {
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
  };
}

/** Defensive parse of the LLM's raw text into validated question objects. */
export function parseGeneratedQuiz(rawText, expectedCount) {
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
    return valid.map(normalizeQuestion);
  } catch {
    return null;
  }
}

/** A small, topic-agnostic safety net so a quiz never fully fails to load. */
export function fallbackQuestions(topic, count) {
  const bank = [
    {
      question_text: `Which approach is generally the best starting point when you're unsure how to tackle a "${topic}" problem under time pressure?`,
      question_type: 'mcq',
      code_snippet: null,
      language: null,
      options: {
        A: 'Restate the problem in your own words and identify constraints first',
        B: 'Start writing code immediately to save time',
        C: 'Skip it and come back only if time remains',
        D: 'Guess an answer and move on',
      },
      correct_option: 'A',
      explanation: 'Restating the problem and identifying constraints surfaces edge cases before you commit to an approach.',
      difficulty: 'foundational',
    },
    {
      question_text: `In "${topic}", which of these is most often the source of an off-by-one or edge-case bug?`,
      question_type: 'mcq',
      code_snippet: null,
      language: null,
      options: {
        A: 'Boundary conditions (empty input, first/last element)',
        B: 'Variable naming',
        C: 'Code comments',
        D: 'File organization',
      },
      correct_option: 'A',
      explanation: 'Boundary conditions are the most common source of subtle bugs across nearly every topic.',
      difficulty: 'core',
    },
  ];

  return Array.from({ length: count }, (_, i) => ({ ...bank[i % bank.length], order_index: i }));
}

export async function generateQuizBatch({ provider, model, apiKey, topic, domain, questionCount, level, avoidQuestions }) {
  try {
    const prompt = buildPrompt({ topic, domain, questionCount, level, avoidQuestions });
    const raw = await provider.generateText({ prompt, model, apiKey });
    const parsed = parseGeneratedQuiz(raw, questionCount);
    if (parsed && parsed.length > 0) return parsed;
  } catch {
    // falls through to the static safety net below
  }
  return fallbackQuestions(topic, questionCount);
}

export async function generateOneAdaptiveQuestion({ provider, model, apiKey, topic, domain, level, avoidQuestions }) {
  const [question] = await generateQuizBatch({ provider, model, apiKey, topic, domain, questionCount: 1, level, avoidQuestions });
  return question;
}
