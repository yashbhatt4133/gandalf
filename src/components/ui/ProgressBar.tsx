export function ProgressBar({ pct, small, good }: { pct: number; small?: boolean; good?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`progress-track ${small ? 'small' : ''}`}>
      <div className="progress-fill" style={{ width: `${clamped}%`, background: good ? 'var(--good)' : undefined }} />
    </div>
  );
}
