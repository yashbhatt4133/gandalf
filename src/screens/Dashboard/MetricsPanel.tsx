import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { AccuracyTrendChart } from '../../components/charts/AccuracyTrendChart';
import { MasteryBarList } from '../../components/charts/MasteryBarList';
import { listQuizSessions, listTopicMastery } from '../../lib/journeys';
import type { TopicMastery } from '../../types/db';

export function MetricsPanel({ userId, domain, topic }: { userId: string; domain: string; topic: string }) {
  const [trend, setTrend] = useState<{ label: string; value: number }[]>([]);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [own, setOwn] = useState<TopicMastery | null>(null);

  useEffect(() => {
    listQuizSessions(userId).then((sessions) => {
      const completed = sessions.filter((s) => s.completed && s.score !== null);
      setTrend(
        completed.map((s) => ({
          label: new Date(s.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          value: s.score!,
        }))
      );
    });
    listTopicMastery(userId, domain).then((rows) => {
      setMastery(rows.sort((a, b) => b.mastery_score - a.mastery_score));
      setOwn(rows.find((r) => r.topic === topic) ?? null);
    });
  }, [userId, domain, topic]);

  return (
    <div>
      <div className="mb-3.5 text-[12.5px] font-bold uppercase tracking-wide text-text-dim">Metrics</div>

      <div className="mb-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <StatTile label="Attempts" value={String(own?.attempts_count ?? 0)} />
        <StatTile label="Mastery score" value={`${own?.mastery_score ?? 0}%`} good={(own?.mastery_score ?? 0) >= 80} />
        <StatTile label="Avg. time / question" value={own ? `${Math.round(own.avg_time_seconds)}s` : '—'} />
      </div>

      <Card className="mb-4">
        <div className="mb-3 text-[13px] font-semibold text-text-muted">Accuracy trend across sessions</div>
        <AccuracyTrendChart points={trend} />
      </Card>

      <Card>
        <div className="mb-3 text-[13px] font-semibold text-text-muted">Mastery by topic — {domain}</div>
        <MasteryBarList rows={mastery.map((m) => ({ topic: m.topic, score: m.mastery_score }))} />
      </Card>
    </div>
  );
}
