import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function readTheme(): Theme {
  return (document.documentElement.getAttribute('data-theme') as Theme) || 'light';
}

/** Mirrors the inline pre-paint script in index.html — same storage key. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('gandalf-theme', theme);
    } catch {
      /* best-effort persistence only */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
