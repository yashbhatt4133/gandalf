import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TierChip } from '../../components/ui/Chip';
import { answerQuestion, completeSession, generateAdaptiveQuestion } from '../../lib/api';
import { PostQuizFeedback } from '../../components/PostQuizFeedback';
import type { ClientQuizQuestion, SessionType } from '../../types/db';

export interface QuizRunnerState {
  questions: ClientQuizQuestion[];
  timeLimitSeconds: number | null;
  sessionType: SessionType;
  topic: string;
  domain: string;
  journeyId?: string | null;
}

interface AnswerResult {
  isCorrect: boolean;
  correctOption: string;
  chosenOption: string;
  explanation: string;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function QuizRunner() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as QuizRunnerState | undefined;

  const [questions, setQuestions] = useState<ClientQuizQuestion[]>(state?.questions ?? []);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerResult>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [loadingNext, setLoadingNext] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; timeTakenSeconds: number; outcome?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(state?.timeLimitSeconds ?? null);

  const current = questions[index];
  const answered = current ? answers[current.id] : undefined;

  useEffect(() => {
    if (!state || remaining === null || result) return;
    if (remaining <= 0) {
      handleFinish();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r !== null ? r - 1 : r)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, result]);

  if (!state || !sessionId) {
    return (
      <Card className="max-w-lg">
        <p className="text-text-muted">This quiz session isn't available — it may have expired. Start a new one from the dashboard.</p>
        <Button className="mt-4" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </Button>
      </Card>
    );
  }

  async function handleAnswer(letter: string) {
    if (!current || answered) return;
    const timeSpentSeconds = Math.round((Date.now() - questionStartedAt) / 1000);
    try {
      const res = await answerQuestion({ questionId: current.id, chosenOption: letter, timeSpentSeconds });
      setAnswers((prev) => ({ ...prev, [current.id]: { ...res, chosenOption: letter } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your answer.');
    }
  }

  async function handleNext() {
    setError(null);
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setQuestionStartedAt(Date.now());
      return;
    }
    if (state!.sessionType === 'adaptive') {
      setLoadingNext(true);
      try {
        const { question } = await generateAdaptiveQuestion(sessionId!, state!.topic, state!.domain);
        setQuestions((prev) => [...prev, question]);
        setIndex((i) => i + 1);
        setQuestionStartedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not generate the next question.');
      } finally {
        setLoadingNext(false);
      }
      return;
    }
    handleFinish();
  }

  async function handleFinish() {
    setFinishing(true);
    setError(null);
    try {
      const res = await completeSession(sessionId!);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish the session.');
    } finally {
      setFinishing(false);
    }
  }

  if (result) {
    return <ResultsView result={result} state={state} sessionId={sessionId!} onNavigate={navigate} />;
  }

  if (!current) {
    return (
      <Card className="max-w-lg">
        <p className="text-text-muted">No questions to show.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TierChip tier={current.difficulty} />
          <span className="text-[13px] text-text-muted">
            Question {index + 1}
            {state.sessionType !== 'adaptive' ? ` of ${questions.length}` : ''}
          </span>
        </div>
        {remaining !== null && (
          <div className="rounded-full border border-border-soft bg-panel-2 px-3 py-1 font-mono text-[13px] font-semibold" style={{ color: remaining < 30 ? 'var(--danger)' : 'var(--text)' }}>
            ⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </div>
        )}
      </div>

      <Card className="predict-card relative">
        {current.question_type === 'predict_output' && current.language && (
          <span className="absolute right-5 top-5 rounded-full border border-border-soft bg-panel-2 px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wide text-text-dim">
            {current.language}
          </span>
        )}

        <p className="mb-4 pr-20 text-[15px] font-medium leading-relaxed">{current.question_text}</p>

        {current.question_type === 'predict_output' && current.code_snippet && <pre className="code-block mono">{current.code_snippet}</pre>}

        <div className="flex flex-col gap-2">
          {OPTION_LETTERS.map((letter) => {
            const text = current.options[letter];
            if (!text) return null;
            let cls = 'option-row';
            if (answered) {
              if (letter === answered.correctOption) cls += ' correct';
              else if (letter === answered.chosenOption) cls += ' incorrect';
            }
            return (
              <button key={letter} className={cls} disabled={!!answered} onClick={() => handleAnswer(letter)}>
                <span className="letter">{letter}</span>
                <span className="flex-1">{text}</span>
                {answered && letter === answered.correctOption && <span className="text-[11.5px] font-bold text-good">✓ Correct</span>}
                {answered && letter !== answered.correctOption && letter === answered.chosenOption && (
                  <span className="text-[11.5px] font-bold text-danger">✗ Your answer</span>
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-4 border-t border-border-soft pt-4 text-[13.5px] text-text-muted">
            <b className="text-text">Why:</b> {answered.explanation || (answered.isCorrect ? 'Correct!' : `The correct answer was ${answered.correctOption}.`)}
          </div>
        )}
      </Card>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" onClick={handleFinish} disabled={finishing}>
          Finish here
        </Button>
        {answered && (
          <Button onClick={handleNext} disabled={loadingNext}>
            {loadingNext ? 'Generating…' : index + 1 < questions.length ? 'Next question' : state.sessionType === 'adaptive' ? 'Next question' : 'See results'}
          </Button>
        )}
      </div>
    </div>
  );
}

function ResultsView({
  result,
  state,
  sessionId,
  onNavigate,
}: {
  result: { score: number; total: number; timeTakenSeconds: number; outcome?: string | null };
  state: QuizRunnerState;
  sessionId: string;
  onNavigate: ReturnType<typeof useNavigate>;
}) {
  const outcomeCopy: Record<string, string> = {
    mastered: "You've mastered this topic — nice work. This journey is now marked complete.",
    read_more: "You're close — a bit more review before this topic sticks. Check the recommended reading.",
    reset: "This one needs a fresh pass — your completed reading has been reset so you can go through it again.",
  };

  return (
    <Card className="max-w-lg text-center">
      <div className="mb-2 font-mono text-[13px] font-bold uppercase tracking-wide text-text-dim">
        {state.sessionType === 'calibration' && 'Calibration complete'}
        {state.sessionType === 'reassessment' && 'Reassessment complete'}
        {state.sessionType === 'adaptive' && 'Session finished'}
        {state.sessionType === 'timed_test' && 'Time-Bound Test complete'}
      </div>
      <div className="mb-1 text-[42px] font-extrabold tracking-tight">{result.score}%</div>
      <div className="mb-5 text-[13.5px] text-text-muted">
        {result.total} question{result.total === 1 ? '' : 's'} · {Math.round(result.timeTakenSeconds)}s total
      </div>

      {result.outcome && <p className="mb-5 text-[14px] text-text-muted">{outcomeCopy[result.outcome]}</p>}

      <div className="flex justify-center gap-3">
        {state.journeyId ? (
          <Button onClick={() => onNavigate(`/journeys/${state.journeyId}`)}>Go to journey</Button>
        ) : (
          <Button onClick={() => onNavigate('/dashboard')}>Back to dashboard</Button>
        )}
      </div>

      <PostQuizFeedback sessionId={sessionId} />
    </Card>
  );
}
