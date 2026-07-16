/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        panel: 'var(--panel)',
        'panel-2': 'var(--panel-2)',
        'panel-3': 'var(--panel-3)',
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-glow': 'var(--accent-glow)',
        'accent-2': 'var(--accent-2)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
        good: 'var(--good)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'monospace'],
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
      },
    },
  },
  plugins: [],
};
