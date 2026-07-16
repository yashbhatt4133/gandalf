import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TopicPicker } from '../../components/TopicPicker';
import { useAuth } from '../../lib/AuthContext';
import { createJourney } from '../../lib/journeys';
import { generateQuiz } from '../../lib/api';
import type { QuizRunnerState } from '../Quiz/QuizRunner';

export function NewJourneyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (journeyId: string) => void }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [domain, setDomain] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!domain || !topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const journey = await createJourney(session!.user.id, topic.trim(), domain);
      const { sessionId, questions, timeLimitSeconds } = await generateQuiz({
        sessionType: 'calibration',
        topic: topic.trim(),
        domain,
        questionCount: 5,
        journeyId: journey.id,
      });

      const state: QuizRunnerState = { questions, timeLimitSeconds, sessionType: 'calibration', topic: topic.trim(), domain, journeyId: journey.id };
      onCreated(journey.id);
      navigate(`/journeys/${journey.id}/quiz/${sessionId}`, { state });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start this journey.');
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {generating ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-border-soft" style={{ borderTopColor: 'var(--accent)' }} />
            <p className="text-[14px] font-semibold">Building your calibration quiz…</p>
            <p className="text-[12.5px] text-text-muted">Generating 5 questions on {topic}</p>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-lg font-bold">Start a new practice journey</h2>
            <p className="mb-5 text-[13px] text-text-muted">Pick a domain and topic — you'll take a 5-question calibration quiz to kick it off.</p>

            <TopicPicker
              domain={domain}
              topic={topic}
              onChange={(d, t) => {
                setDomain(d);
                setTopic(t);
              }}
            />

            {error && <p className="mb-3 mt-4 text-[13px] text-danger">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleStart} disabled={!domain || !topic.trim()}>
                Start journey
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
