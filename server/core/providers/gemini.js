/** @type {import('./types.js').LlmProvider} */
export const geminiProvider = {
  id: 'gemini',
  async generateText({ prompt, model, apiKey }) {
    if (!apiKey) throw new Error('Gemini requires an API key.');

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, topP: 0.95 } }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini request failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  },
};
