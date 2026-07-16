import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-[0_3px_12px_rgba(47,111,237,0.32)] hover:bg-accent-soft hover:-translate-y-px',
  ghost: 'bg-transparent border border-border text-text hover:bg-panel-2',
  danger: 'bg-transparent border border-danger text-danger hover:bg-panel-2',
};

export function Button({ variant = 'primary', block, className = '', ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} ${block ? 'w-full' : ''} ${className}`} {...props} />;
}
