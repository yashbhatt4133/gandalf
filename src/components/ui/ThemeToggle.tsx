import { useTheme } from '../../lib/theme';

function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      title="Toggle dark / light theme"
      className="relative h-7 w-[52px] flex-shrink-0 rounded-full border border-border-soft bg-panel-3 p-0"
    >
      <span
        className="absolute top-0.5 left-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-white transition-transform duration-200"
        style={{
          transform: theme === 'dark' ? 'translateX(24px)' : 'translateX(0)',
          background: theme === 'dark' ? 'var(--accent-2)' : 'var(--accent)',
        }}
      >
        {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}
