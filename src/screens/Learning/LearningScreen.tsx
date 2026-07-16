import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TierChip } from '../../components/ui/Chip';
import { getJourney, listRecommendedTopics, markRecommendedTopicDone, subscribeRecommendedTopics } from '../../lib/journeys';
import type { Journey, RecommendedTopic } from '../../types/db';

export function LearningScreen() {
  const { journeyId } = useParams();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [topics, setTopics] = useState<RecommendedTopic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = topics.find((t) => t.id === selectedId) ?? null;

  async function handleMarkDone(id: string) {
    await markRecommendedTopicDone(id);
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'done' } : t)));
  }

  return (
    <div>
      {journeyId && (
        <Link to={`/journeys/${journeyId}`} className="mb-4 inline-block text-[12.5px] font-semibold text-text-muted hover:text-text">
          ← {journey?.topic ?? 'Journey'}
        </Link>
      )}

      {topics.length === 0 && <Card className="max-w-lg text-text-muted">No recommended topics yet — generate them from the journey page.</Card>}

      {topics.length > 0 && (
        <div className="flex items-start gap-6">
          <div className="w-64 flex-shrink-0">
            <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-text-dim">Recommended for: {journey?.topic}</div>
            <div className="flex flex-col gap-1">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className="flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors"
                  style={{ background: selectedId === t.id ? 'rgba(124,156,255,0.14)' : undefined }}
                >
                  <span
                    className="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold"
                    style={{
                      background: selectedId === t.id ? 'var(--accent)' : 'var(--panel-3)',
                      color: selectedId === t.id ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {t.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <TierChip tier={t.tier} />
                    <div className="mt-1.5 truncate text-[13.5px] font-semibold">{t.title}</div>
                  </div>
                  <span
                    className="mt-2.5 h-[9px] w-[9px] flex-shrink-0 rounded-full"
                    style={t.status === 'done' ? { background: 'var(--good)' } : { border: '2px solid var(--border)' }}
                  />
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="min-w-0 flex-1">
              <div className="mb-5">
                <TierChip tier={selected.tier} />
                <h1 className="mb-2.5 mt-2.5 text-[26px] font-extrabold tracking-tight">{selected.title}</h1>
                {selected.hook_question && <p className="max-w-xl text-[15px] text-text-muted">{selected.hook_question}</p>}
              </div>

              <div className="mb-6 flex flex-col gap-3.5">
                <VBlock label="Definition">{selected.definition}</VBlock>
                {selected.example && <VBlock label="Worked example">{selected.example}</VBlock>}
                {selected.analogy && (
                  <VBlock label={`Analogy${selected.analogy_interest ? ` · personalized to: ${selected.analogy_interest}` : ''}`}>{selected.analogy}</VBlock>
                )}
                {selected.scenario && <VBlock label="Real scenario">{selected.scenario}</VBlock>}
                {selected.sources.length > 0 && (
                  <VBlock label="Sources">
                    <div className="flex flex-wrap gap-2">
                      {selected.sources.map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noreferrer" className="source-chip">
                          ↗ {s.title}
                        </a>
                      ))}
                    </div>
                  </VBlock>
                )}
              </div>

              {selected.status === 'todo' ? (
                <Button onClick={() => handleMarkDone(selected.id)}>Mark as read</Button>
              ) : (
                <span className="text-[13px] font-semibold text-good">✓ Read</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card>
      <h3 className="mb-2.5 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-accent-soft">{label}</h3>
      <div className="text-[14.5px] leading-relaxed">{children}</div>
    </Card>
  );
}
