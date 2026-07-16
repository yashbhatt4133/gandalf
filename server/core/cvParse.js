// CV / background parsing — one call, extraction prompt (see PROVIDERS.md).

function buildPrompt(text) {
  return `Extract a candidate's technical profile from the resume/background text below. Return ONLY a JSON object (no markdown fences, no prose) shaped exactly like:
{
  "skills": string[],
  "languages": string[],
  "years_experience": number or null,
  "roles": string[],
  "summary": string (1-2 sentences)
}

Resume/background text:
"""
${text.slice(0, 8000)}
"""`;
}

function parseSkillsResponse(rawText) {
  let jsonText = rawText.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonText = fenced[1].trim();
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start !== -1 && end !== -1) jsonText = jsonText.slice(start, end + 1);

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

export async function parseResumeText({ provider, model, apiKey, text }) {
  if (!text?.trim()) return { skills: [], languages: [], years_experience: null, roles: [], summary: '' };

  try {
    const raw = await provider.generateText({ prompt: buildPrompt(text), model, apiKey });
    const parsed = parseSkillsResponse(raw);
    if (parsed) return parsed;
  } catch {
    // falls through
  }
  return { skills: [], languages: [], years_experience: null, roles: [], summary: '' };
}
