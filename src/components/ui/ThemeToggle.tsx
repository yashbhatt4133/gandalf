import { useTheme } from '../../lib/theme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      title="Toggle dark / light theme"
      className="relative h-7 w-[52px] flex-shrink-0 rounded-full border border-border-soft bg-panel-3 p-0 before:absolute before:left-[7px] before:top-1/2 before:-translate-y-1/2 before:text-[11px] before:opacity-55 before:content-['☀'] after:absolute after:right-[7px] after:top-1/2 after:-translate-y-1/2 after:text-[11px] after:opacity-55 after:content-['☾']"
    >
      <span
        className="absolute top-0.5 left-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs text-white transition-transform duration-200"
        style={{
          transform: theme === 'dark' ? 'translateX(24px)' : 'translateX(0)',
          background: theme === 'dark' ? 'var(--accent-2)' : 'var(--accent)',
        }}
      >
        {theme === 'dark' ? '☾' : '☀'}
      </span>
    </button>
  );
}
