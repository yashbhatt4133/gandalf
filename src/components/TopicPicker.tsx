import { useState } from 'react';
import { TAXONOMY } from '../lib/taxonomy';

interface TopicPickerProps {
  domain: string | null;
  topic: string;
  onChange: (domain: string, topic: string) => void;
}

/** Shared domain+topic chip picker (taxonomy tree + free text), used by New Journey / Time-Bound Test / Adaptive Quiz. */
export function TopicPicker({ domain, topic, onChange }: TopicPickerProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const selectedDomainTopics = TAXONOMY.find((d) => d.domain === domain)?.topics ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-[12.5px] font-semibold text-text-muted">Domain</div>
        <div className="flex flex-wrap gap-2">
          {TAXONOMY.map((d) => (
            <button
              key={d.domain}
              type="button"
              onClick={() => {
                setCustomMode(false);
                onChange(d.domain, '');
              }}
              className="chip"
              style={{
                cursor: 'pointer',
                background: domain === d.domain ? 'var(--accent)' : undefined,
                color: domain === d.domain ? '#fff' : undefined,
                borderColor: domain === d.domain ? 'var(--accent)' : undefined,
              }}
            >
              {d.domain}
            </button>
          ))}
        </div>
      </div>

      {domain && (
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
                style={{
                  cursor: 'pointer',
                  background: !customMode && topic === t ? 'var(--accent)' : undefined,
                  color: !customMode && topic === t ? '#fff' : undefined,
                  borderColor: !customMode && topic === t ? 'var(--accent)' : undefined,
                }}
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomMode(true)}
              className="chip"
              style={{
                cursor: 'pointer',
                background: customMode ? 'var(--accent)' : undefined,
                color: customMode ? '#fff' : undefined,
                borderColor: customMode ? 'var(--accent)' : undefined,
              }}
            >
              ✏️ Custom…
            </button>
          </div>
          {customMode && (
            <input
              autoFocus
              value={customTopic}
              onChange={(e) => {
                setCustomTopic(e.target.value);
                onChange(domain, e.target.value);
              }}
              placeholder="Type your own topic"
              className="mt-2 w-full rounded-[10px] border border-border bg-panel px-3.5 py-2 text-[13.5px] text-text outline-none focus:border-accent"
            />
          )}
        </div>
      )}
    </div>
  );
}
