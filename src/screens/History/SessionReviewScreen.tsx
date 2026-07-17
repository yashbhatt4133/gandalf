import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ModalClose } from '../../components/ui/ModalClose';
import { Skeleton } from '../../components/ui/Skeleton';
import { DomainChip, TierChip } from '../../components/ui/Chip';
import { GandalfMark } from '../../components/ui/GandalfMark';
import { useModal } from '../../lib/useModal';
import { usePageTitle } from '../../lib/PageTitleContext';
import { getSessionWithQuestions } from '../../lib/history';
import { explainQuestion, validateQuestion, type ValidationResult } from '../../lib/api';
import type { QuizQuestion, QuizSession } from '../../types/db';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

const PROVIDER_NAMES: Record<string, string> = { ollama: 'Local', groq: 'Groq', openai: 'OpenAI', gemini: 'Gemini' };

function formatGeneratedBy(providerId: string | null, model: string | null): string | null {
  if (!providerId) return null;
  const name = PROVIDER_NAMES[providerId] ?? providerId;
  return model ? `${name} · ${model}` : name;
}

export function SessionReviewScreen() {
  const { sessionId } = useParams();
  const [data, setData] = useState<{ session: QuizSession; questions: QuizQuestion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePageTitle(data?.session.topic || 'Session review');

  useEffect(() => {
    if (!sessionId) return;
    getSessionWithQuestions(sessionId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this session.'));
  }, [sessionId]);

  if (error) return <Card className="max-w-lg text-danger">{error}</Card>;
  if (!data)
    return (
      <div className="max-w-2xl">
        <Skeleton className="mb-3 h-4 w-28" />
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-4 w-40" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );

  const { session, questions } = data;

  return (
    <div className="max-w-2xl">
      <Link to="/history" className="mb-3 inline-block text-[13px] text-text-muted hover:text-text">
        ← Back to History
      </Link>

      <div className="mb-1 flex items-center gap-2.5">
        {session.domain && <DomainChip domain={session.domain} />}
        <span className="text-[13px] font-semibold text-text-muted">{new Date(session.taken_at).toLocaleString()}</span>
      </div>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{session.topic || 'Untitled session'}</h1>
      <p className="mb-6 text-[14.5px] text-text-muted">
        Score: <b className="text-text">{session.score ?? '—'}%</b> · {questions.length} question{questions.length === 1 ? '' : 's'}
      </p>

      <div className="flex flex-col gap-4">
        {questions.map((initial, i) => (
          <ReviewQuestion key={initial.id} initial={initial} index={i} generatedBy={formatGeneratedBy(session.provider_used, session.model_used)} />
        ))}
      </div>

      <Link to="/history">
        <Button variant="ghost" className="mt-5">
          ← Back to History
        </Button>
      </Link>
    </div>
  );
}

type ModalState =
  | { kind: 'explain'; loading: boolean; error: string | null; text: string | null }
  | { kind: 'validate'; loading: boolean; error: string | null; result: ValidationResult | null };

function ReviewQuestion({ initial, index, generatedBy }: { initial: QuizQuestion; index: number; generatedBy: string | null }) {
  const [q, setQ] = useState<QuizQuestion>(initial);
  const [modal, setModal] = useState<ModalState | null>(null);
  const validated = !!q.validated_at;

  async function handleExplain() {
    setModal({ kind: 'explain', loading: true, error: null, text: null });
    try {
      const { explanation } = await explainQuestion(q.id);
      setModal({ kind: 'explain', loading: false, error: null, text: explanation });
    } catch (err) {
      setModal({ kind: 'explain', loading: false, error: err instanceof Error ? err.message : 'Could not generate an explanation.', text: null });
    }
  }

  async function handleValidate() {
    setModal({ kind: 'validate', loading: true, error: null, result: null });
    try {
      const result = await validateQuestion(q.id);
      // Reflect the persisted correction (or flaw flag) on the card behind the popup.
      setQ((prev) => ({
        ...prev,
        correct_option: result.updatedCorrectOption ?? undefined,
        explanation: result.updatedExplanation,
        is_correct: result.isCorrect,
        flagged_broken: result.flaggedBroken,
        validated_at: result.validatedAt,
      }));
      setModal({ kind: 'validate', loading: false, error: null, result });
    } catch (err) {
      setModal({ kind: 'validate', loading: false, error: err instanceof Error ? err.message : 'Could not validate this question.', result: null });
    }
  }

  return (
    <Card className="predict-card relative">
      <div className="mb-3 flex items-center gap-2.5">
        <TierChip tier={q.difficulty} />
        <span className="text-[12.5px] text-text-muted">Question {index + 1}</span>
        {q.flagged_broken ? (
          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent-2)', background: 'color-mix(in srgb, var(--accent-2) 15%, transparent)' }}>
            Flawed question
          </span>
        ) : (
          validated && (
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--good)', background: 'color-mix(in srgb, var(--good) 12%, transparent)' }}>
              Validated
            </span>
          )
        )}
      </div>

      <p className="mb-4 pr-4 text-[15px] font-medium leading-relaxed">{q.question_text}</p>

      {q.question_type === 'predict_output' && q.code_snippet && <pre className="code-block mono">{q.code_snippet}</pre>}

      {q.flagged_broken && (
        <p className="mb-3 rounded-lg border p-2.5 text-[13px]" style={{ borderColor: 'var(--accent-2)', background: 'color-mix(in srgb, var(--accent-2) 8%, transparent)', color: 'var(--text)' }}>
          None of the options below is actually correct — this question was flagged during validation and excluded from your scores. See the explanation for the true answer.
        </p>
      )}

      <div className="mb-3 flex flex-col gap-2">
        {OPTION_LETTERS.map((letter) => {
          const text = q.options[letter];
          if (!text) return null;
          const isCorrectOption = !q.flagged_broken && letter === q.correct_option;
          const isChosen = letter === q.chosen_option;
          let cls = 'option-row';
          if (isCorrectOption) cls += ' correct';
          else if (isChosen && !q.flagged_broken) cls += ' incorrect';
          return (
            <div key={letter} className={cls}>
              <span className="letter">{letter}</span>
              <span className="flex-1">{text}</span>
              {isCorrectOption && <span className="text-[11.5px] font-bold text-good">Correct</span>}
              {isChosen && !isCorrectOption && <span className={`text-[11.5px] font-bold ${q.flagged_broken ? 'text-text-muted' : 'text-danger'}`}>Your answer</span>}
            </div>
          );
        })}
      </div>

      {q.explanation && (
        <div className="mb-3 border-t border-border-soft pt-3 text-[13.5px] text-text-muted">
          <b className="text-text">Why:</b> {q.explanation}
        </div>
      )}

      {(q.tags.length > 0 || generatedBy) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {q.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
          {generatedBy && <span className="ml-auto text-[11px] text-text-dim">Generated by: {generatedBy}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border-soft pt-3">
        <Button variant="ghost" onClick={handleExplain}>
          Explain more
        </Button>
        <Button variant="ghost" onClick={handleValidate}>
          Validate
        </Button>
      </div>

      {modal && <ReviewModal modal={modal} onClose={() => setModal(null)} />}
    </Card>
  );
}

function ReviewModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useModal(overlayRef, onClose);
  return (
    <div ref={overlayRef} tabIndex={-1} className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card role="dialog" aria-modal="true" className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <ModalClose onClick={onClose} />
        <div className="mb-3 flex items-center justify-between pr-8">
          <div className="flex items-center gap-2.5">
            <GandalfMark size={34} />
            <h2 className="text-[15px] font-bold">{modal.kind === 'explain' ? 'Explanation' : 'Validation'}</h2>
          </div>
        </div>

        {modal.loading && (
          <div className="flex items-center gap-3 py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-border-soft" style={{ borderTopColor: 'var(--accent)' }} />
            <span className="text-[13.5px] text-text-muted">{modal.kind === 'explain' ? 'Writing a clearer explanation…' : 'Independently re-solving and checking the answer key…'}</span>
          </div>
        )}

        {modal.error && <p className="py-2 text-[13.5px] text-danger">{modal.error}</p>}

        {modal.kind === 'explain' && modal.text && <p className="text-[14px] leading-relaxed">{modal.text}</p>}

        {modal.kind === 'validate' && modal.result && (
          <div className="text-[14px] leading-relaxed">
            <div
              className="mb-3 rounded-xl border p-3.5"
              style={
                modal.result.flaggedBroken
                  ? { borderColor: 'var(--accent-2)', background: 'color-mix(in srgb, var(--accent-2) 8%, transparent)' }
                  : modal.result.keyIsCorrect
                  ? { borderColor: 'var(--good)', background: 'color-mix(in srgb, var(--good) 8%, transparent)' }
                  : { borderColor: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 8%, transparent)' }
              }
            >
              <div
                className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide"
                style={{ color: modal.result.flaggedBroken ? 'var(--accent-2)' : modal.result.keyIsCorrect ? 'var(--good)' : 'var(--danger)' }}
              >
                {modal.result.flaggedBroken ? 'Question flagged — no correct option' : modal.result.keyIsCorrect ? 'Answer key verified' : 'Answer key was wrong'}
              </div>
              <p>{modal.result.verdict}</p>
            </div>

            {modal.result.flaggedBroken ? (
              <p className="mb-2 text-[13px] font-semibold text-text">
                None of the four listed options is actually correct{modal.result.correctAnswerText ? ` — the true answer is: ${modal.result.correctAnswerText}` : ''}. This question has been
                flagged and excluded from your session score and topic mastery stats.
              </p>
            ) : (
              modal.result.changed && (
                <p className="mb-2 text-[13px] font-semibold text-text">
                  Corrected: {modal.result.storedCorrectOption} → {modal.result.updatedCorrectOption}. This has been saved to your history.
                </p>
              )
            )}

            {modal.result.updatedExplanation && <p className="text-text-muted">{modal.result.updatedExplanation}</p>}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </Card>
    </div>
  );
}
