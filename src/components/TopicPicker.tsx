import { useState } from 'react';
import { TAXONOMY } from '../lib/taxonomy';
import { suggestTopics } from '../lib/api';

export interface CustomFocus {
  role: string;
  company: string;
  notes: string;
}

interface TopicPickerProps {
  domain: string | null;
  topic: string;
  onChange: (domain: string, topic: string) => void;
  /** When true, adds a "Custom" domain option for a focused role/company journey. */
  enableCustomFocus?: boolean;
  onFocusChange?: (focus: CustomFocus | null) => void;
  /** When true, adds a top-level "Custom topic" option (free-text topic, no preset domain). */
  enableCustomTopic?: boolean;
  /** When true, adds a "Suggest topics" button that appends LLM-generated topic chips. */
  enableSuggest?: boolean;
}

const CUSTOM_DOMAIN = 'Custom';

const chipStyle = (active: boolean) => ({
  cursor: 'pointer' as const,
  background: active ? 'var(--accent)' : undefined,
  color: active ? '#fff' : undefined,
  borderColor: active ? 'var(--accent)' : undefined,
});

// The "Custom …" chips get a distinct accent-tinted, dashed-outline look so
// they read as "make your own" rather than another preset domain — legible in
// both light and dark via the accent token.
const customChipStyle = (active: boolean) => ({
  cursor: 'pointer' as const,
  background: active ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 15%, transparent)',
  color: active ? '#fff' : 'var(--accent)',
  borderColor: 'var(--accent)',
  borderStyle: active ? ('solid' as const) : ('dashed' as const),
});

/** Shared domain+topic chip picker (taxonomy tree + free text), used by New Journey / Time-Bound Test / Adaptive Quiz. */
export function TopicPicker({ domain, topic, onChange, enableCustomFocus, onFocusChange, enableCustomTopic, enableSuggest }: TopicPickerProps) {
  const [customMode, setCustomMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [customTopicMode, setCustomTopicMode] = useState(false);
  const [focus, setFocus] = useState<CustomFocus>({ role: '', company: '', notes: '' });
  const [suggested, setSuggested] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const selectedDomainTopics = TAXONOMY.find((d) => d.domain === domain)?.topics ?? [];

  function pickDomain(d: string) {
    setCustomMode(false);
    setFocusMode(false);
    setCustomTopicMode(false);
    setSuggested([]);
    setSuggestError(null);
    onFocusChange?.(null);
    onChange(d, '');
  }

  function pickCustomFocus() {
    setCustomMode(false);
    setCustomTopicMode(false);
    setFocusMode(true);
    onFocusChange?.(focus);
    onChange(CUSTOM_DOMAIN, buildTopic(focus));
  }

  function pickCustomTopic() {
    setCustomMode(false);
    setFocusMode(false);
    setSuggested([]);
    setSuggestError(null);
    setCustomTopicMode(true);
    onFocusChange?.(null);
    onChange(CUSTOM_DOMAIN, '');
  }

  function updateFocus(next: CustomFocus) {
    setFocus(next);
    onFocusChange?.(next);
    onChange(CUSTOM_DOMAIN, buildTopic(next));
  }

  async function handleSuggest() {
    if (!domain || suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const { topics } = await suggestTopics({ domain, existing: [...selectedDomainTopics, ...suggested] });
      setSuggested((prev) => Array.from(new Set([...prev, ...topics])));
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Could not suggest more topics.');
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-[12.5px] font-semibold text-text-muted">Domain</div>
        <div className="flex flex-wrap gap-2">
          {TAXONOMY.map((d) => (
            <button
              key={d.domain}
              type="button"
              onClick={() => pickDomain(d.domain)}
              className="chip"
              style={chipStyle(!focusMode && !customTopicMode && domain === d.domain)}
            >
              {d.domain}
            </button>
          ))}
          {enableCustomTopic && (
            <button type="button" onClick={pickCustomTopic} className="chip" style={customChipStyle(customTopicMode)}>
              + Custom topic
            </button>
          )}
          {enableCustomFocus && (
            <button type="button" onClick={pickCustomFocus} className="chip" style={customChipStyle(focusMode)}>
              + Custom — role &amp; company
            </button>
          )}
        </div>
      </div>

      {focusMode ? (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-text-muted">Target a specific opening — Gandalf will focus the whole journey on it.</p>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-text-muted">
            Job role
            <input
              autoFocus
              value={focus.role}
              onChange={(e) => updateFocus({ ...focus, role: e.target.value })}
              placeholder="e.g. Backend Software Engineer"
              className="rounded-[10px] border border-border bg-panel px-3.5 py-2 text-[13.5px] text-text outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-text-muted">
            Company <span className="font-normal text-text-dim">(optional)</span>
            <input
              value={focus.company}
              onChange={(e) => updateFocus({ ...focus, company: e.target.value })}
              placeholder="e.g. Amazon"
              className="rounded-[10px] border border-border bg-panel px-3.5 py-2 text-[13.5px] text-text outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-text-muted">
            Focus / description <span className="font-normal text-text-dim">(optional)</span>
            <textarea
              value={focus.notes}
              onChange={(e) => updateFocus({ ...focus, notes: e.target.value })}
              rows={2}
              placeholder="e.g. 'the OA is heavy on DSA + system design', 'new-grad SDE loop'…"
              className="resize-y rounded-[10px] border border-border bg-panel px-3.5 py-2 text-[13.5px] text-text outline-none focus:border-accent"
            />
          </label>
        </div>
      ) : customTopicMode ? (
        <div>
          <div className="mb-2 text-[12.5px] font-semibold text-text-muted">Topic</div>
          <input
            autoFocus
            value={topic}
            onChange={(e) => onChange(CUSTOM_DOMAIN, e.target.value)}
            placeholder="Write any topic — e.g. “Dijkstra's algorithm”, “TCP congestion control”"
            className="w-full rounded-[10px] border border-border bg-panel px-3.5 py-2 text-[13.5px] text-text outline-none focus:border-accent"
          />
          <p className="mt-2 text-[12px] text-text-dim">Anything you want to practice — it doesn't have to be in the preset list.</p>
        </div>
      ) : (
        domain && (
          <div>
            <div className="mb-2 text-[12.5px] font-semibold text-text-muted">Topic</div>
            <div className="flex flex-wrap gap-2">
              {selectedDomainTopics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    onChange(domain, t);
                  }}
                  className="chip"
                  style={chipStyle(!customMode && topic === t)}
                >
                  {t}
                </button>
              ))}
              {suggested
                .filter((t) => !selectedDomainTopics.includes(t))
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setCustomMode(false);
                      onChange(domain, t);
                    }}
                    className="chip"
                    style={chipStyle(!customMode && topic === t)}
                  >
                    {t}
                  </button>
                ))}
              {enableSuggest && (
                <button type="button" onClick={handleSuggest} disabled={suggesting} className="chip" style={{ cursor: suggesting ? 'default' : 'pointer' }}>
                  {suggesting ? 'Suggesting…' : '+ Suggest topics'}
                </button>
              )}
              <button type="button" onClick={() => setCustomMode(true)} className="chip" style={chipStyle(customMode)}>
                Custom…
              </button>
            </div>
            {suggestError && <p className="mt-2 text-[12px] text-danger">{suggestError}</p>}
            {customMode && (
              <input
                autoFocus
                value={topic}
                onChange={(e) => onChange(domain, e.target.value)}
                placeholder="Type your own topic"
                className="mt-2 w-full rounded-[10px] border border-border bg-panel px-3.5 py-2 text-[13.5px] text-text outline-none focus:border-accent"
              />
            )}
          </div>
        )
      )}
    </div>
  );
}

function buildTopic(f: CustomFocus): string {
  const role = f.role.trim();
  const company = f.company.trim();
  if (!role) return '';
  return company ? `${role} @ ${company}` : role;
}
