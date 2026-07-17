import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { ChipSelect } from '../../components/ui/ChipSelect';
import { DomainChip } from '../../components/ui/Chip';
import { Skeleton } from '../../components/ui/Skeleton';
import { usePageTitle } from '../../lib/PageTitleContext';
import { useAuth } from '../../lib/AuthContext';
import { listCompletedSessions, listDistinctTags, listDistinctTopics, listFlaggedSessionIds } from '../../lib/history';
import type { QuizSession, SessionType } from '../../types/db';

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  calibration: 'Calibration quiz',
  reassessment: 'Reassessment',
  adaptive: 'Adaptive Quiz',
  timed_test: 'Time-Bound Test',
};

const ALL = 'All';

export function HistoryScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;

  const [topics, setTopics] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [topic, setTopic] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  usePageTitle('History');

  useEffect(() => {
    Promise.all([listDistinctTopics(userId), listDistinctTags(userId), listFlaggedSessionIds(userId)]).then(([t, g, flagged]) => {
      setTopics(t);
      setTags(g);
      setFlaggedIds(flagged);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listCompletedSessions(userId, { topic: topic === ALL ? null : topic, tag: tag === ALL ? null : tag })
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load history.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, tag]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">History</h1>
      <p className="mb-6 text-[14.5px] text-text-muted">Every past quiz, reassessment, and test — revisit them by topic or tag.</p>

      <Card className="mb-6">
        <div className="mb-4">
          <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-dim">Topic</div>
          <ChipSelect options={[ALL, ...topics]} value={topic} onChange={setTopic} />
        </div>
        <div>
          <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-dim">Tag</div>
          <ChipSelect options={[ALL, ...tags]} value={tag} onChange={setTag} />
        </div>
      </Card>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}
      {loading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[68px] w-full" />
          ))}
        </div>
      )}

      {!loading && sessions.length === 0 && <p className="text-[13px] text-text-muted">No sessions match these filters yet.</p>}

      <div className="flex flex-col gap-3">
        {sessions.map((s) => (
          <Link key={s.id} to={`/history/${s.id}`}>
            <Card className="transition-colors hover:bg-panel-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {s.domain && <DomainChip domain={s.domain} />}
                  <div>
                    <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                      {s.topic || 'Untitled session'}
                      {flaggedIds.has(s.id) && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                          style={{ color: 'var(--accent-2)', background: 'color-mix(in srgb, var(--accent-2) 15%, transparent)' }}
                          title="This session has at least one question flagged as flawed during validation"
                        >
                          Flagged
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-text-muted">
                      {SESSION_TYPE_LABELS[s.session_type]} · {new Date(s.taken_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-[18px] font-extrabold">{s.score ?? '—'}%</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
