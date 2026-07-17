import { useState } from 'react';
import { TAXONOMY } from '../lib/taxonomy';

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
}

const CUSTOM_DOMAIN = 'Custom';

const chipStyle = (active: boolean) => ({
  cursor: 'pointer' as const,
  background: active ? 'var(--accent)' : undefined,
  color: active ? '#fff' : undefined,
  borderColor: active ? 'var(--accent)' : undefined,
});

/** Shared domain+topic chip picker (taxonomy tree + free text), used by New Journey / Time-Bound Test / Adaptive Quiz. */
export function TopicPicker({ domain, topic, onChange, enableCustomFocus, onFocusChange }: TopicPickerProps) {
  const [customMode, setCustomMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focus, setFocus] = useState<CustomFocus>({ role: '', company: '', notes: '' });
  const selectedDomainTopics = TAXONOMY.find((d) => d.domain === domain)?.topics ?? [];

  function pickDomain(d: string) {
    setCustomMode(false);
    setFocusMode(false);
    onFocusChange?.(null);
    onChange(d, '');
  }

  function pickCustomFocus() {
    setCustomMode(false);
    setFocusMode(true);
    onFocusChange?.(focus);
    onChange(CUSTOM_DOMAIN, buildTopic(focus));
  }

  function updateFocus(next: CustomFocus) {
    setFocus(next);
    onFocusChange?.(next);
    onChange(CUSTOM_DOMAIN, buildTopic(next));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-[12.5px] font-semibold text-text-muted">Domain</div>
        <div className="flex flex-wrap gap-2">
          {TAXONOMY.map((d) => (
            <button key={d.domain} type="button" onClick={() => pickDomain(d.domain)} className="chip" style={chipStyle(!focusMode && domain === d.domain)}>
              {d.domain}
            </button>
          ))}
          {enableCustomFocus && (
            <button type="button" onClick={pickCustomFocus} className="chip" style={chipStyle(focusMode)}>
              Custom — role &amp; company
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
              <button type="button" onClick={() => setCustomMode(true)} className="chip" style={chipStyle(customMode)}>
                Custom…
              </button>
            </div>
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
