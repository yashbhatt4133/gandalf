// Curated learning-vertical generation (Definition/Example/Analogy/Scenario/
// Sources) — see CONTENT_TAXONOMY.md and ERD.md's `recommended_topics`.

function buildPrompt({ topic, domain, interests }) {
  const interestLine = interests?.length
    ? `Personalize each analogy to one of these interests where it fits naturally: ${interests.join(', ')}.`
    : 'No personal interests were given — use a broadly relatable analogy instead.';

  return `You are creating 4 ranked "learning verticals" (curated sub-topics) to help someone prepare for a first-round technical interview/OA on "${topic}" (domain: ${domain}).

${interestLine}

Return ONLY a JSON array (no markdown fences, no prose) of exactly 4 objects, ranked from most foundational to most advanced, shaped exactly like:
{
  "title": string (a specific sub-topic, not the whole topic again),
  "tier": "foundational" | "core" | "advanced",
  "hook_question": string (one sentence that hooks curiosity),
  "definition": string (2-4 sentences),
  "example": string (a concrete worked example),
  "analogy": string (an analogy, personalized per the instruction above if possible),
  "analogy_interest": string or null (which interest the analogy used, or null),
  "scenario": string (a real-world scenario where this matters),
  "sources": [{ "title": string, "url": string }] (1-3 real, general tech resources — e.g. GeeksforGeeks, MDN, official docs, well-known CS course notes)
}`;
}

function isValidVertical(v) {
  return v && typeof v === 'object' && typeof v.title === 'string' && v.title.trim() && typeof v.definition === 'string';
}

export function parseGeneratedVerticals(rawText) {
  let jsonText = rawText.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonText = fenced[1].trim();
  const start = jsonText.indexOf('[');
  const end = jsonText.lastIndexOf(']');
  if (start !== -1 && end !== -1) jsonText = jsonText.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(isValidVertical);
    if (valid.length === 0) return null;
    return valid.map((v, i) => ({
      title: v.title.trim(),
      rank: i + 1,
      tier: ['foundational', 'core', 'advanced'].includes(v.tier) ? v.tier : 'core',
      hook_question: v.hook_question || '',
      definition: v.definition,
      example: v.example || '',
      analogy: v.analogy || '',
      analogy_interest: v.analogy_interest || null,
      scenario: v.scenario || '',
      sources: Array.isArray(v.sources) ? v.sources.filter((s) => s && s.title && s.url) : [],
    }));
  } catch {
    return null;
  }
}

function fallbackVerticals(topic) {
  return [1, 2, 3, 4].map((rank) => ({
    title: `${topic} — Part ${rank}`,
    rank,
    tier: rank <= 1 ? 'foundational' : rank <= 3 ? 'core' : 'advanced',
    hook_question: `What's the one thing about ${topic} most people get wrong?`,
    definition: `Content for "${topic}" couldn't be generated right now — try regenerating from the journey page once your provider is reachable.`,
    example: '',
    analogy: '',
    analogy_interest: null,
    scenario: '',
    sources: [],
  }));
}

export async function generateVerticals({ provider, model, apiKey, topic, domain, interests }) {
  try {
    const prompt = buildPrompt({ topic, domain, interests });
    const raw = await provider.generateText({ prompt, model, apiKey });
    const parsed = parseGeneratedVerticals(raw);
    if (parsed) return parsed;
  } catch {
    // falls through
  }
  return fallbackVerticals(topic);
}
