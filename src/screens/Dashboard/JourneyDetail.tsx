import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DomainChip, StatusPill } from '../../components/ui/Chip';
import { PreQuizFeedback, defaultPreQuizPrefs, preQuizPrefsToParams } from '../../components/PreQuizFeedback';
import { GeneratingChecklist } from '../../components/GeneratingChecklist';
import { GandalfMark } from '../../components/ui/GandalfMark';
import { getJourney, listJourneySteps } from '../../lib/journeys';
import { generateQuiz, generateLearningVerticals, completeJourney } from '../../lib/api';
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
  const [calModalOpen, setCalModalOpen] = useState(false);

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

  function openCalModal() {
    setPrefs(defaultPreQuizPrefs());
    setError(null);
    setCalModalOpen(true);
  }

  // `includePrefs` is only true for the calibration quiz (opened via the
  // preference modal). Reassessment re-measures the same topic, so it starts
  // straight away with no preference panel.
  async function startQuiz(sessionType: 'calibration' | 'reassessment', includePrefs = false) {
    setBusyStep('quiz');
    setError(null);
    try {
      const { sessionId, questions, timeLimitSeconds } = await generateQuiz({
        sessionType,
        topic: journey!.topic,
        domain: journey!.domain,
        questionCount: 5,
        journeyId: journey!.id,
        ...(includePrefs ? preQuizPrefsToParams(prefs) : {}),
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

  async function handleContinueAnyway() {
    setError(null);
    try {
      await completeJourney(journey!.id);
      load();
      refreshJourneys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the journey.');
    }
  }

  const quizDone = steps.some((s) => s.step_name === 'quiz' && s.status === 'done');
  const inProgress = journey.status === 'active' && quizDone && steps.some((s) => s.status !== 'done');

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex items-center gap-2.5">
        <DomainChip domain={journey.domain} />
        <StatusPill status={journey.status} />
      </div>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">{journey.topic}</h1>

      {error && !calModalOpen && <p className="mb-4 text-[13px] text-danger">{error}</p>}

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
                <Button onClick={openCalModal} disabled={busyStep === 'quiz'}>
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

        {inProgress && (
          <div className="mt-4 flex items-center justify-between border-t border-border-soft pt-3">
            <span className="text-[12px] text-text-dim">Not clicking with this topic? You can wrap it up without passing the reassessment.</span>
            <button onClick={handleContinueAnyway} className="text-[12.5px] font-semibold text-text-muted underline hover:text-text">
              Continue anyway → mark complete
            </button>
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="mb-1 text-[14px] font-bold">Simulate the real thing</div>
        <p className="mb-3 text-[13px] text-text-muted">Race the clock on {journey.topic} — same mechanic as an actual OA/OT.</p>
        <Link to={`/timed-test?topic=${encodeURIComponent(journey.topic)}&domain=${encodeURIComponent(journey.domain)}`}>
          <Button variant="ghost">Start a Time-Bound Test</Button>
        </Link>
      </Card>

      <MetricsPanel userId={journey.user_id} domain={journey.domain} topic={journey.topic} />

      {calModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={() => !busyStep && setCalModalOpen(false)}>
          <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {busyStep === 'quiz' ? (
              <>
                <GandalfMark size={72} className="mx-auto mb-2 block" />
                <GeneratingChecklist title="Building your calibration quiz…" />
              </>
            ) : (
              <>
                <div className="mb-4 flex flex-col items-center text-center">
                  <GandalfMark size={72} className="mb-2 block" />
                  <h2 className="text-lg font-bold">Calibration quiz</h2>
                  <p className="mt-1 text-[13px] text-text-muted">5 questions on {journey.topic}.</p>
                </div>
                <PreQuizFeedback prefs={prefs} onChange={setPrefs} />
                {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setCalModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => startQuiz('calibration', true)}>Start</Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {busyStep === 'recommended_topics' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg">
            <GandalfMark size={72} className="mx-auto mb-2 block" />
            <GeneratingChecklist title="Curating your learning path…" stages={['Analyzing your weak spots…', 'Selecting targeted sub-topics…', 'Writing explainers…']} />
          </Card>
        </div>
      )}
    </div>
  );
}
