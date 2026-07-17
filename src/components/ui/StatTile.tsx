export function StatTile({ label, value, sub, good }: { label: string; value: string; sub?: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-panel p-5">
      <div className="mb-2.5 font-mono text-xs font-bold uppercase tracking-wide text-text-dim">{label}</div>
      <div className="text-[27px] font-extrabold tracking-tight">{value}</div>
      {sub && <div className={`mt-1 text-[12.5px] ${good ? 'font-semibold text-good' : 'text-text-muted'}`}>{sub}</div>}
    </div>
  );
}
