const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

/** @type {import('./types.js').LlmProvider} */
export const ollamaProvider = {
  id: 'ollama',
  async generateText({ prompt, model }) {
    let res;
    try {
      res = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A per-call random seed + non-zero temperature so regenerating on the
        // same topic/level yields fresh questions rather than the same output.
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { temperature: 0.8, top_p: 0.95, seed: Math.floor(Math.random() * 1e9) },
        }),
      });
    } catch {
      throw new Error(`Could not reach Ollama at ${BASE_URL} — is \`ollama serve\` running?`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama request failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data.response ?? '';
  },
};
