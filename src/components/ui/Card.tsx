import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-border-soft bg-panel p-5 shadow ${className}`} {...props} />;
}
