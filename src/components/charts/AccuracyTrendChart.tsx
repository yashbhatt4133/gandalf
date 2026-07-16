import { useState } from 'react';

interface Point {
  label: string;
  value: number; // 0-100
}

const WIDTH = 560;
const HEIGHT = 160;
const PAD_L = 32;
const PAD_R = 28;
const PAD_T = 14;
const PAD_B = 24;

/** Single-series accuracy-over-time trend — sequential accent hue, no legend needed (one series). */
export function AccuracyTrendChart({ points }: { points: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return <div className="flex h-40 items-center justify-center text-[13px] text-text-dim">Complete a session to see your trend.</div>;
  }

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xAt = (i: number) => PAD_L + i * stepX;
  const yAt = (v: number) => PAD_T + innerH * (1 - v / 100);

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.value)}`).join(' ');
  const areaPath = `${linePath} L ${xAt(points.length - 1)} ${PAD_T + innerH} L ${xAt(0)} ${PAD_T + innerH} Z`;
  const last = points[points.length - 1];
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
          const i = Math.round((relX - PAD_L) / (stepX || 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} x2={WIDTH - PAD_R} y1={yAt(tick)} y2={yAt(tick)} stroke="var(--border-soft)" strokeWidth={1} />
            <text x={PAD_L - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle" fontSize={10.5} fill="var(--text-dim)">
              {tick}%
            </text>
          </g>
        ))}

        <path d={areaPath} fill="var(--accent)" opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD_T} y2={PAD_T + innerH} stroke="var(--text-dim)" strokeWidth={1} strokeDasharray="2 3" />}

        {points.map((p, i) => {
          const isEnd = i === points.length - 1;
          const isHover = hover === i;
          if (!isEnd && !isHover) return null;
          return (
            <circle key={i} cx={xAt(i)} cy={yAt(p.value)} r={5} fill="var(--accent)" stroke="var(--panel)" strokeWidth={2} />
          );
        })}

        <text x={xAt(points.length - 1)} y={yAt(last.value) - 12} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--text)">
          {last.value}%
        </text>
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute rounded-lg border border-border-soft bg-panel px-2.5 py-1.5 text-[11.5px] shadow"
          style={{ left: `${(xAt(hover!) / WIDTH) * 100}%`, top: 0, transform: 'translate(-50%, -100%)' }}
        >
          <div className="font-semibold">{active.value}%</div>
          <div className="text-text-dim">{active.label}</div>
        </div>
      )}
    </div>
  );
}
