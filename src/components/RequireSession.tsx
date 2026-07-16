import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export function RequireSession() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted">
        <span>Loading…</span>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return <Outlet />;
}
