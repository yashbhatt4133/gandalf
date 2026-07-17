import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DomainChip, StatusPill } from '../../components/ui/Chip';
import { PreQuizFeedback, defaultPreQuizPrefs, preQuizPrefsToParams } from '../../components/PreQuizFeedback';
import { getJourney, listJourneySteps } from '../../lib/journeys';
import { generateQuiz, generateLearningVerticals } from '../../lib/api';
import { useJourneys } from '../../lib/JourneysContext';
import type { Journey, JourneyStep, StepName } from '../../types/db';
import type { QuizRunnerState } from '../Quiz/QuizRunner';
import { MetricsPanel } from './MetricsPanel';

const STEP_LABELS: Record<StepName, string> = {
  quiz: 'Calibration quiz',
  recommended_topics: 'Recommended topics',
  reassessment: 'Reassessment',
};

export function JourneyDetail() {
  const { journeyId } = useParams();
  const navigate = useNavigate();
  const { refresh: refreshJourneys } = useJourneys();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [steps, setSteps] = useState<JourneyStep[]>([]);
  const [busyStep, setBusyStep] = useState<StepName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(defaultPreQuizPrefs());

  const load = useCallback(() => {
    if (!journeyId) return;
    getJourney(journeyId).then(setJourney);
    listJourneySteps(journeyId).then(setSteps);
  }, [journeyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!journey || !journeyId) {
    return <Card className="max-w-lg text-text-muted">Loading journey…</Card>;
  }

  async function startQuiz(sessionType: 'calibration' | 'reassessment') {
    setBusyStep('quiz');
    setError(null);
    try {
      const { sessionId, questions, timeLimitSeconds } = await generateQuiz({
        sessionType,
        topic: journey!.topic,
        domain: journey!.domain,
        questionCount: 5,
        journeyId: journey!.id,
        ...preQuizPrefsToParams(prefs),
      });
      const state: QuizRunnerState = { questions, timeLimitSeconds, sessionType, topic: journey!.topic, domain: journey!.domain, journeyId: journey!.id };
      navigate(`/journeys/${journey!.id}/quiz/${sessionId}`, { state });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the quiz.');
      setBusyStep(null);
    }
  }

  async function generateTopics() {
    setBusyStep('recommended_topics');
    setError(null);
    try {
      await generateLearningVerticals({ journeyId: journey!.id, topic: journey!.topic, domain: journey!.domain });
      load();
      refreshJourneys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate recommended topics.');
    } finally {
      setBusyStep(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex items-center gap-2.5">
        <DomainChip domain={journey.domain} />
        <StatusPill status={journey.status} />
      </div>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">{journey.topic}</h1>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}

      {steps.some((s) => (s.step_name === 'quiz' || s.step_name === 'reassessment') && s.status === 'current') && (
        <Card className="mb-6">
          <PreQuizFeedback prefs={prefs} onChange={setPrefs} />
        </Card>
      )}

      <Card className="mb-6">
        <div className="mb-4 font-mono text-[12.5px] font-bold uppercase tracking-wide text-text-dim">Steps</div>
        <div className="flex flex-col gap-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between rounded-xl border border-border-soft px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{
                    background: step.status === 'done' ? 'var(--good)' : step.status === 'current' ? 'var(--accent)' : 'var(--panel-3)',
                  }}
                />
                <span className="text-[14px] font-semibold">{STEP_LABELS[step.step_name]}</span>
              </div>

              {step.step_name === 'quiz' && step.status !== 'done' && (
                <Button onClick={() => startQuiz('calibration')} disabled={busyStep === 'quiz'}>
                  {busyStep === 'quiz' ? 'Generating…' : 'Take calibration quiz'}
                </Button>
              )}
              {step.step_name === 'recommended_topics' && step.status === 'current' && (
                <Button onClick={generateTopics} disabled={busyStep === 'recommended_topics'}>
                  {busyStep === 'recommended_topics' ? 'Generating…' : 'Generate recommended topics'}
                </Button>
              )}
              {step.step_name === 'recommended_topics' && step.status === 'done' && (
                <Link to={`/journeys/${journey.id}/learning`}>
                  <Button variant="ghost">View learning content →</Button>
                </Link>
              )}
              {step.step_name === 'reassessment' && step.status === 'current' && (
                <Button onClick={() => startQuiz('reassessment')} disabled={busyStep === 'quiz'}>
                  {busyStep === 'quiz' ? 'Generating…' : 'Take reassessment'}
                </Button>
              )}
              {step.step_name === 'reassessment' && step.status === 'done' && <span className="text-[12.5px] text-text-muted">Done</span>}
              {step.status === 'upcoming' && <span className="text-[12.5px] text-text-dim">Upcoming</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <div className="mb-1 text-[14px] font-bold">Simulate the real thing</div>
        <p className="mb-3 text-[13px] text-text-muted">Race the clock on {journey.topic} — same mechanic as an actual OA/OT.</p>
        <Link to={`/timed-test?topic=${encodeURIComponent(journey.topic)}&domain=${encodeURIComponent(journey.domain)}`}>
          <Button variant="ghost">⏱ Start a Time-Bound Test</Button>
        </Link>
      </Card>

      <MetricsPanel userId={journey.user_id} domain={journey.domain} topic={journey.topic} />
    </div>
  );
}
