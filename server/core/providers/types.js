/**
 * @typedef {Object} GenerateTextParams
 * @property {string} prompt
 * @property {string} model
 * @property {string} [apiKey] - required for groq/openai/gemini, ignored by ollama
 */

/**
 * @typedef {Object} LlmProvider
 * @property {'ollama'|'groq'|'openai'|'gemini'} id
 * @property {(params: GenerateTextParams) => Promise<string>} generateText
 */

export {};
