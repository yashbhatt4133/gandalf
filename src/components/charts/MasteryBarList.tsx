interface Row {
  topic: string;
  score: number; // 0-100
}

/** Magnitude comparison across topics — sequential single hue, value labeled at the tip. */
export function MasteryBarList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <div className="py-6 text-center text-[13px] text-text-dim">No topics attempted yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.topic} className="flex items-center gap-3">
          <div className="w-36 flex-shrink-0 truncate text-[12.5px] font-medium text-text-muted" title={row.topic}>
            {row.topic}
          </div>
          <div className="relative h-[18px] flex-1 overflow-hidden rounded-full bg-panel-3">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(row.score, 3)}%`, background: 'var(--accent)' }}
            />
          </div>
          <div className="w-9 flex-shrink-0 text-right text-[12.5px] font-semibold">{row.score}%</div>
        </div>
      ))}
    </div>
  );
}
