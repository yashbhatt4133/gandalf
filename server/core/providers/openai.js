/** @type {import('./types.js').LlmProvider} */
export const openaiProvider = {
  id: 'openai',
  async generateText({ prompt, model, apiKey }) {
    if (!apiKey) throw new Error('OpenAI requires an API key.');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.9, top_p: 0.95 }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI request failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  },
};
