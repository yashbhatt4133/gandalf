import { Navigate, Outlet } from 'react-router-dom';
import { useProfile } from '../lib/ProfileContext';

export function RequireOnboarded() {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted">
        <span>Loading…</span>
      </div>
    );
  }

  if (!profile?.target_role) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
