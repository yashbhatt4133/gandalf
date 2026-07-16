import { ollamaProvider } from './ollama.js';
import { groqProvider } from './groq.js';
import { openaiProvider } from './openai.js';
import { geminiProvider } from './gemini.js';
import { decryptApiKey } from '../crypto.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const PROVIDERS = {
  ollama: ollamaProvider,
  groq: groqProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
};

/** @returns {import('./types.js').LlmProvider} */
export function getProvider(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider "${providerId}".`);
  return provider;
}

export class UsageLimitError extends Error {}
export class ProviderConfigError extends Error {}

const DEFAULT_MODELS = {
  ollama: 'llama3.1',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
};

/** True when running as a deployed Netlify Function rather than the local Express server. */
export function isDeployedMode() {
  return process.env.DEPLOYMENT_MODE === 'hosted';
}

async function getUserLlmSettings(userId) {
  const { data, error } = await getSupabaseAdmin().from('user_llm_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function checkAndIncrementUsage(userId) {
  const limit = Number(process.env.DEFAULT_KEY_DAILY_LIMIT || 30);
  const today = new Date().toISOString().slice(0, 10);
  const admin = getSupabaseAdmin();

  const { data: existing } = await admin.from('usage_counters').select('*').eq('user_id', userId).eq('usage_date', today).maybeSingle();

  const currentCount = existing?.request_count ?? 0;
  if (currentCount >= limit) {
    throw new UsageLimitError('Daily shared-demo limit reached — add your own free API key in Settings to keep practicing today.');
  }

  await admin.from('usage_counters').upsert({ user_id: userId, usage_date: today, request_count: currentCount + 1 });
}

export function formatBadgeLabel(providerId, model, usingDefault) {
  const suffix = usingDefault ? ' · shared default' : '';
  switch (providerId) {
    case 'ollama':
      return `Local · ${model}${suffix}`;
    case 'groq':
      return `Groq · ${model} · cloud${suffix}`;
    case 'openai':
      return `OpenAI · ${model} · cloud${suffix}`;
    case 'gemini':
      return `Gemini · ${model} · cloud${suffix}`;
    default:
      return 'No provider configured';
  }
}

export function localFallback() {
  if (process.env.OLLAMA_BASE_URL) {
    return { providerId: 'ollama', model: process.env.OLLAMA_MODEL || DEFAULT_MODELS.ollama, apiKey: undefined };
  }
  if (process.env.GROQ_API_KEY) return { providerId: 'groq', model: DEFAULT_MODELS.groq, apiKey: process.env.GROQ_API_KEY };
  if (process.env.OPENAI_API_KEY) return { providerId: 'openai', model: DEFAULT_MODELS.openai, apiKey: process.env.OPENAI_API_KEY };
  if (process.env.GEMINI_API_KEY) return { providerId: 'gemini', model: DEFAULT_MODELS.gemini, apiKey: process.env.GEMINI_API_KEY };
  return null;
}

/**
 * Resolves which provider/model/key to use for a given user, per
 * PROVIDERS.md's resolution order: personal settings first, then a
 * deployed-mode shared default key (with a usage cap), then a local-mode
 * `.env` fallback, then a clear error.
 */
export async function resolveProviderForUser(userId) {
  const settings = await getUserLlmSettings(userId);

  if (settings && (settings.preferred_provider === 'ollama' || settings.encrypted_api_key)) {
    return {
      provider: getProvider(settings.preferred_provider),
      model: settings.preferred_model || DEFAULT_MODELS[settings.preferred_provider],
      apiKey: settings.encrypted_api_key ? decryptApiKey(settings.encrypted_api_key) : undefined,
      source: 'user',
    };
  }

  if (isDeployedMode()) {
    const providerId = process.env.DEFAULT_LLM_PROVIDER;
    const model = process.env.DEFAULT_LLM_MODEL;
    const apiKey = process.env.DEFAULT_LLM_API_KEY;
    if (!providerId || !apiKey) {
      throw new ProviderConfigError('No default provider is configured for this deployment.');
    }
    await checkAndIncrementUsage(userId);
    return { provider: getProvider(providerId), model, apiKey, source: 'default' };
  }

  const fallback = localFallback();
  if (!fallback) {
    throw new ProviderConfigError('Set up a provider in Settings, or configure one in server/.env (see Initial Setup Guide.md).');
  }
  return { provider: getProvider(fallback.providerId), model: fallback.model, apiKey: fallback.apiKey, source: 'local-default' };
}

export { DEFAULT_MODELS };
