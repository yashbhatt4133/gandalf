import { useEffect, useState } from 'react';
import { listJourneySteps } from './journeys';

/** % of a journey's 3 steps (quiz / recommended_topics / reassessment) marked done. */
export function useJourneyProgress(journeyId: string): number {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listJourneySteps(journeyId).then((steps) => {
      if (cancelled || steps.length === 0) return;
      const done = steps.filter((s) => s.status === 'done').length;
      setPct(Math.round((done / steps.length) * 100));
    });
    return () => {
      cancelled = true;
    };
  }, [journeyId]);

  return pct;
}
