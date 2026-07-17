import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { CosmicBackground } from '../../components/ui/CosmicBackground';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { GandalfMark } from '../../components/ui/GandalfMark';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { signIn, signUp } from '../../lib/session';
import { useAuth } from '../../lib/AuthContext';

export function AuthScreen() {
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <CosmicBackground />
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-[380px]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-border-soft bg-panel-2">
            <GandalfMark size={34} />
          </span>
          <div>
            <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent">Step 01 · Enter the platform</p>
            <h1 className="text-xl font-extrabold tracking-tight">Gandalf</h1>
            <p className="mt-1 text-[13px] text-text-muted">Practice for the round that gates the rest.</p>
          </div>
        </div>

        <div className="mb-6 flex rounded-[10px] border border-border-soft bg-panel-2 p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${mode === 'signin' ? 'bg-panel shadow' : 'text-text-muted'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${mode === 'signup' ? 'bg-panel shadow' : 'text-text-muted'}`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-muted">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-muted">
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent"
            />
          </label>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <Button type="submit" block disabled={submitting}>
            {submitting ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
