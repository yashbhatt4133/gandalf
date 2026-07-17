import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getLlmSettings, saveLlmSettings, type LlmSettingsResponse } from '../../lib/api';
import { useProviderBadge } from '../../lib/ProviderBadgeContext';
import type { ProviderId } from '../../types/db';

const CUSTOM = '__custom__';

const PROVIDERS: { id: ProviderId; label: string; models: string[]; needsKey: boolean; localOnly?: boolean; keyUrl?: string }[] = [
  { id: 'ollama', label: 'Ollama (local)', models: ['llama3.1', 'llama3.2', 'llama3', 'mistral', 'qwen2.5', 'phi3'], needsKey: false, localOnly: true },
  { id: 'groq', label: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'], needsKey: true, keyUrl: 'https://console.groq.com/keys' },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'], needsKey: true, keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', label: 'Gemini', models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'], needsKey: true, keyUrl: 'https://aistudio.google.com/apikey' },
];

const isHostedBuild = import.meta.env.VITE_DEPLOYMENT_MODE === 'hosted';

export function AiProviderTab() {
  const { refresh: refreshBadge } = useProviderBadge();
  const [settings, setSettings] = useState<LlmSettingsResponse | null>(null);
  const [provider, setProvider] = useState<ProviderId>('groq');
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    getLlmSettings().then((s) => {
      setSettings(s);
      if (s.provider) {
        setProvider(s.provider);
        const p = PROVIDERS.find((x) => x.id === s.provider);
        const m = s.model || p?.models[0] || '';
        setModel(m);
        setCustomModel(!!m && !p?.models.includes(m));
      }
    });
  }, []);

  const meta = PROVIDERS.find((p) => p.id === provider)!;
  const defaultModel = meta.models[0];

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMsg(false);
    try {
      await saveLlmSettings({ provider, model: model.trim() || defaultModel, apiKey: apiKey.trim() ? apiKey.trim() : undefined });
      setApiKey('');
      const fresh = await getLlmSettings();
      setSettings(fresh);
      refreshBadge();
      setSavedMsg(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your provider settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearKey() {
    setSaving(true);
    try {
      await saveLlmSettings({ provider, model: model.trim() || defaultModel, apiKey: null });
      const fresh = await getLlmSettings();
      setSettings(fresh);
      refreshBadge();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-[640px]">
      <div className="flex flex-col gap-6">
        {settings && (
          <div className="rounded-xl border border-border-soft bg-panel-2 px-4 py-3 text-[13px]">
            <div className="font-semibold">{settings.badgeLabel}</div>
            {settings.usingDefault && <div className="mt-1 text-text-muted">Using the shared default key — add your own below for unlimited use.</div>}
            {settings.usage && (
              <div className="mt-1 text-text-muted">
                {settings.usage.used} / {settings.usage.limit} requests used today
              </div>
            )}
          </div>
        )}

        <div>
          <div className="mb-2 text-[13px] font-semibold text-text-muted">Provider</div>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.filter((p) => !p.localOnly || !isHostedBuild).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProvider(p.id);
                  setModel(p.models[0]);
                  setCustomModel(false);
                }}
                className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
                style={
                  provider === p.id
                    ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--panel-2)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {isHostedBuild && <p className="mt-2 text-[12px] text-text-dim">Ollama is only available when self-hosted — see the README.</p>}
        </div>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-muted">
          Model
          <select
            value={customModel ? CUSTOM : model}
            onChange={(e) => {
              if (e.target.value === CUSTOM) {
                setCustomModel(true);
                setModel('');
              } else {
                setCustomModel(false);
                setModel(e.target.value);
              }
            }}
            className="rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent"
          >
            {meta.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </select>
          {customModel && (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={`exact ${meta.label} model id`}
              autoFocus
              className="mt-1.5 rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent"
            />
          )}
          <span className="text-[12px] text-text-dim">Pick a valid model id — a wrong id (e.g. a plan name) makes every quiz fail to generate.</span>
        </label>

        {meta.needsKey && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-muted">
            API key {settings?.provider === provider && settings?.hasKey ? <span className="text-good">(a key is set)</span> : <span className="text-text-dim">(no key set)</span>}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste a new key to replace it"
              autoComplete="off"
              className="rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent"
            />
            {meta.keyUrl && (
              <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="text-[12px] text-accent-soft underline">
                Get a free {meta.label} key →
              </a>
            )}
          </label>
        )}

        {error && <p className="text-[13px] text-danger">{error}</p>}
        {savedMsg && <p className="text-[13px] text-good">Saved.</p>}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save provider'}
          </Button>
          {meta.needsKey && settings?.provider === provider && settings?.hasKey && (
            <Button variant="ghost" onClick={handleClearKey} disabled={saving}>
              Remove key
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
