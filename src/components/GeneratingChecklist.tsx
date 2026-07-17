import { useEffect, useState } from 'react';

// A cosmetic staged checklist shown while a single generation call is awaited.
// There's no realtime status backend (cut from this project), so stages advance
// on a timer to give the wait visible structure; the last stage holds until the
// caller unmounts this on completion.
const DEFAULT_STAGES = ['Preparing questions…', 'Calibrating difficulty…', 'Finalizing…'];

export function GeneratingChecklist({ title = 'Generating…', stages = DEFAULT_STAGES, stepMs = 1600 }: { title?: string; stages?: string[]; stepMs?: number }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Advance through stages but never tick the last one "done" — it stays
    // in-progress until generation actually resolves and this unmounts.
    if (active >= stages.length - 1) return;
    const t = setTimeout(() => setActive((i) => Math.min(i + 1, stages.length - 1)), stepMs);
    return () => clearTimeout(t);
  }, [active, stages.length, stepMs]);

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <p className="text-[14px] font-semibold">{title}</p>
      <div className="flex flex-col gap-2.5">
        {stages.map((stage, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div key={stage} className="flex items-center gap-2.5 text-left text-[13px]">
              {done ? (
                <span className="h-[18px] w-[18px] rounded-full" style={{ background: 'var(--good)' }} />
              ) : current ? (
                <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-border-soft" style={{ borderTopColor: 'var(--accent)' }} />
              ) : (
                <span className="h-[18px] w-[18px] rounded-full border-2 border-border-soft" />
              )}
              <span style={{ color: done || current ? 'var(--text)' : 'var(--text-dim)' }}>{stage}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
