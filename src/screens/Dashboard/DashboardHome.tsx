import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatTile } from '../../components/ui/StatTile';
import { DomainChip } from '../../components/ui/Chip';
import { StatusPill } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../lib/AuthContext';
import { useProfile } from '../../lib/ProfileContext';
import { useJourneys } from '../../lib/JourneysContext';
import { listQuizSessions, listTopicMastery } from '../../lib/journeys';
import { computeCurrentStreak, computeLongestStreak } from '../../lib/stats';
import { useJourneyProgress } from '../../lib/useJourneyProgress';
import type { TopicMastery } from '../../types/db';

function JourneyCard({ id, topic, domain, status }: { id: string; topic: string; domain: string; status: 'active' | 'mastered' | 'abandoned' }) {
  const pct = useJourneyProgress(id);
  return (
    <Link to={`/journeys/${id}`}>
      <div className="cursor-pointer rounded-2xl border border-border-soft bg-panel p-[18px] shadow transition-transform hover:-translate-y-0.5">
        <div className="mb-3 flex items-center justify-between">
          <DomainChip domain={domain} />
          <StatusPill status={status} />
        </div>
        <h3 className="mb-3 text-[15.5px] font-bold">{topic}</h3>
        <ProgressBar pct={pct} good={status === 'mastered'} />
        <div className="mt-2 flex justify-between text-xs text-text-muted">
          <span>{pct}% complete</span>
        </div>
      </div>
    </Link>
  );
}

export function DashboardHome() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { journeys, loading } = useJourneys();
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [streaks, setStreaks] = useState({ current: 0, longest: 0 });

  useEffect(() => {
    if (!session) return;
    listTopicMastery(session.user.id).then(setMastery);
    listQuizSessions(session.user.id).then((sessions) => {
      const dates = sessions.filter((s) => s.completed).map((s) => s.taken_at);
      setStreaks({ current: computeCurrentStreak(dates), longest: computeLongestStreak(dates) });
    });
  }, [session]);

  const activeJourneys = journeys.filter((j) => j.status !== 'mastered');
  const completedJourneys = journeys.filter((j) => j.status === 'mastered');
  const activeCount = journeys.filter((j) => j.status === 'active').length;
  const masteredCount = journeys.filter((j) => j.status === 'mastered').length;
  const totalAttempts = mastery.reduce((s, m) => s + m.attempts_count, 0);
  const totalCorrect = mastery.reduce((s, m) => s + m.correct_count, 0);
  const overallAccuracy = totalAttempts > 0 ? Math.round((100 * totalCorrect) / totalAttempts) : 0;
  const topicsMastered = mastery.filter((m) => m.mastery_score >= 80).length;

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}</h1>
      <p className="mb-7 mt-1.5 text-[14.5px] text-text-muted">Here's where your practice stands today.</p>

      <div className="mb-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile label="Active journeys" value={String(activeCount)} sub={`${masteredCount} mastered · ${journeys.length} total`} />
        <StatTile label="Current streak" value={`${streaks.current} day${streaks.current === 1 ? '' : 's'}`} sub={`longest: ${streaks.longest} days`} good />
        <StatTile label="Overall accuracy" value={`${overallAccuracy}%`} sub={totalAttempts > 0 ? `across ${totalAttempts} questions` : 'no data yet'} />
        <StatTile label="Topics mastered" value={String(topicsMastered)} sub={`of ${mastery.length} attempted`} />
      </div>

      <div className="mb-3.5 font-mono text-[12.5px] font-bold uppercase tracking-wide text-text-dim">Active journeys</div>
      {!loading && journeys.length === 0 && (
        <Card className="text-center text-text-muted">No journeys yet — click "+ Start new practice" in the sidebar to begin one.</Card>
      )}
      {activeJourneys.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeJourneys.map((j) => (
            <JourneyCard key={j.id} id={j.id} topic={j.topic} domain={j.domain} status={j.status} />
          ))}
        </div>
      )}
      {!loading && journeys.length > 0 && activeJourneys.length === 0 && (
        <Card className="text-text-muted">All caught up — every journey is complete. Start a new one from the sidebar.</Card>
      )}

      {completedJourneys.length > 0 && (
        <>
          <div className="mb-3.5 mt-8 font-mono text-[12.5px] font-bold uppercase tracking-wide text-text-dim">Completed · {completedJourneys.length}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completedJourneys.map((j) => (
              <JourneyCard key={j.id} id={j.id} topic={j.topic} domain={j.domain} status={j.status} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
