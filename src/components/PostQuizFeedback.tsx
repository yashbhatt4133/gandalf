import { useState } from 'react';
import { Button } from './ui/Button';
import { submitQuizFeedback } from '../lib/api';

const RATING_LABELS = ['Rough', 'Meh', 'OK', 'Good', 'Great'];

export function PostQuizFeedback({ sessionId }: { sessionId: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (status === 'done') {
    return <p className="mt-5 text-[13px] text-text-muted">Thanks for the feedback.</p>;
  }

  async function handleSubmit() {
    setStatus('submitting');
    setError(null);
    try {
      await submitQuizFeedback(sessionId, { satisfaction: rating, comment: comment.trim() || null });
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.');
      setStatus('idle');
    }
  }

  return (
    <div className="mt-6 border-t border-border-soft pt-5 text-left">
      <div className="mb-2.5 text-[13px] font-semibold">How did that feel?</div>
      <div className="mb-3 flex gap-2">
        {RATING_LABELS.map((label, i) => {
          const value = i + 1;
          const active = rating === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={
                active
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--panel-2)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
              }
            >
              {value} · {label}
            </button>
          );
        })}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything about these questions worth mentioning? (optional)"
        rows={2}
        className="mb-3 w-full rounded-xl border border-border-soft bg-panel-2 px-3 py-2 text-[13px] text-text outline-none placeholder:text-text-dim"
      />
      {error && <p className="mb-2 text-[12.5px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setStatus('done')} disabled={status === 'submitting'}>
          Skip
        </Button>
        <Button onClick={handleSubmit} disabled={status === 'submitting' || rating === null}>
          {status === 'submitting' ? 'Submitting…' : 'Submit feedback'}
        </Button>
      </div>
    </div>
  );
}
