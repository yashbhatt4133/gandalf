import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TierChip } from '../../components/ui/Chip';
import { getJourney, listRecommendedTopics, markRecommendedTopicDone, subscribeRecommendedTopics } from '../../lib/journeys';
import { usePageTitle } from '../../lib/PageTitleContext';
import type { Journey, RecommendedTopic } from '../../types/db';

export function LearningScreen() {
  const { journeyId } = useParams();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [topics, setTopics] = useState<RecommendedTopic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  usePageTitle(journey?.topic ? `${journey.topic} · Learning` : 'Learning');

  useEffect(() => {
    if (!journeyId) return;
    getJourney(journeyId).then(setJourney);
    listRecommendedTopics(journeyId).then((rows) => {
      setTopics(rows);
      if (rows.length > 0) setSelectedId(rows[0].id);
    });
    return subscribeRecommendedTopics(journeyId, (row) => {
      setTopics((prev) => (prev.some((t) => t.id === row.id) ? prev : [...prev, row].sort((a, b) => a.rank - b.rank)));
    });
  }, [journeyId]);

  const selectedIndex = topics.findIndex((t) => t.id === selectedId);
  const selected = selectedIndex >= 0 ? topics[selectedIndex] : null;

  function select(id: string) {
    setSelectedId(id);
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function step(delta: number) {
    const next = topics[selectedIndex + delta];
    if (next) select(next.id);
  }

  async function handleMarkDone(id: string) {
    await markRecommendedTopicDone(id);
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'done' } : t)));
  }

  return (
    <div className="max-w-4xl">
      {journeyId && (
        <Link to={`/journeys/${journeyId}`} className="mb-4 inline-block font-mono text-[12px] font-semibold text-text-muted hover:text-text">
          ← All steps
        </Link>
      )}

      <div className="mb-1 font-mono text-[11.5px] font-bold uppercase tracking-wide text-accent-soft">Curated learning path</div>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">{journey?.topic ?? 'Learning'}</h1>

      {topics.length === 0 && <Card className="max-w-lg text-text-muted">No recommended topics yet — generate them from the journey page.</Card>}

      {topics.length > 0 && (
        <>
          {/* Numbered-card carousel navigation */}
          <div className="mb-6 flex items-stretch gap-2">
            <CarouselArrow dir="left" disabled={selectedIndex <= 0} onClick={() => step(-1)} />
            <div className="flex flex-1 gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {topics.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    ref={(el) => {
                      cardRefs.current[t.id] = el;
                    }}
                    onClick={() => select(t.id)}
                    className="flex w-[220px] flex-shrink-0 flex-col rounded-2xl border p-4 text-left transition-colors"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--border-soft)',
                      background: active ? 'rgba(139,92,246,0.10)' : 'var(--panel)',
                    }}
                  >
                    <div className="mb-2 text-[26px] font-extrabold leading-none" style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {String(t.rank).padStart(2, '0')}
                    </div>
                    <div className="mb-2">
                      <TierChip tier={t.tier} />
                    </div>
                    <div className="mb-1.5 text-[13.5px] font-semibold leading-snug">{t.title}</div>
                    {t.hook_question && <div className="line-clamp-3 text-[12px] italic text-text-muted">{t.hook_question}</div>}
                    <span
                      className="mt-2 h-[9px] w-[9px] rounded-full"
                      style={t.status === 'done' ? { background: 'var(--good)' } : { border: '2px solid var(--border)' }}
                    />
                  </button>
                );
              })}
            </div>
            <CarouselArrow dir="right" disabled={selectedIndex >= topics.length - 1} onClick={() => step(1)} />
          </div>

          {/* Selected vertical content */}
          {selected && (
            <Card>
              <div className="mb-2 font-mono text-[11.5px] font-bold uppercase tracking-wide text-text-dim">
                {selected.tier} · {selected.title}
              </div>
              <h2 className="mb-5 text-[22px] font-extrabold leading-tight tracking-tight">{selected.hook_question || selected.title}</h2>

              {selected.analogy && (
                <div className="mb-5 rounded-xl bg-panel-2 p-4" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-accent-soft">Gandalf's take</span>
                    {selected.analogy_interest && <span className="chip">via your interest: {selected.analogy_interest}</span>}
                  </div>
                  <p className="text-[14.5px] leading-relaxed">{selected.analogy}</p>
                </div>
              )}

              <Section label="Definition">{selected.definition}</Section>

              {selected.example && (
                <div className="mb-5 rounded-xl border border-border-soft bg-panel-2 p-4">
                  <div className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-text-dim">Worked example</div>
                  <p className="text-[14px] leading-relaxed">{selected.example}</p>
                </div>
              )}

              {selected.scenario && <Section label="Real scenario">{selected.scenario}</Section>}

              {selected.sources.length > 0 && (
                <div className="mb-5 border-t border-border-soft pt-4">
                  <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wide text-text-dim">Sources</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.sources.map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noreferrer" className="source-chip">
                        {s.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
                {selected.status === 'todo' ? (
                  <Button onClick={() => handleMarkDone(selected.id)}>Mark as read</Button>
                ) : (
                  <span className="mr-1 text-[13px] font-semibold text-good">Read</span>
                )}
                <div className="flex-1" />
                <Button variant="ghost" onClick={() => step(-1)} disabled={selectedIndex <= 0}>
                  ← Previous
                </Button>
                <Button variant="ghost" onClick={() => step(1)} disabled={selectedIndex >= topics.length - 1}>
                  Next →
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function CarouselArrow({ dir, disabled, onClick }: { dir: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Previous' : 'Next'}
      className="flex w-9 flex-shrink-0 items-center justify-center rounded-xl border border-border-soft bg-panel text-text-muted transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-accent-soft">{label}</div>
      <div className="text-[14.5px] leading-relaxed">{children}</div>
    </div>
  );
}
