/** @type {import('./types.js').LlmProvider} */
export const groqProvider = {
  id: 'groq',
  async generateText({ prompt, model, apiKey }) {
    if (!apiKey) throw new Error('Groq requires an API key.');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Groq request failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  },
};
