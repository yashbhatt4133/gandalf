import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileForm } from '../Profile/ProfileForm';
import { AiProviderTab } from './AiProviderTab';
import { Button } from '../../components/ui/Button';
import { useProfile } from '../../lib/ProfileContext';
import { usePageTitle } from '../../lib/PageTitleContext';
import { signOut } from '../../lib/session';

export function SettingsScreen() {
  const [tab, setTab] = useState<'profile' | 'provider'>('profile');
  const [loggingOut, setLoggingOut] = useState(false);
  const { profile } = useProfile();
  const navigate = useNavigate();
  usePageTitle('Profile / Settings');

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch {
      // The auth listener still clears the session and RequireSession redirects.
      setLoggingOut(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Profile / Settings</h1>
        <div className="flex items-center gap-3">
          {profile?.display_name && <span className="text-[13px] text-text-muted">Signed in as {profile.display_name}</span>}
          <Button variant="danger" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-[10px] border border-border-soft bg-panel-2 p-1" style={{ maxWidth: 280 }}>
        <button
          onClick={() => setTab('profile')}
          className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${tab === 'profile' ? 'bg-panel shadow' : 'text-text-muted'}`}
        >
          Profile
        </button>
        <button
          onClick={() => setTab('provider')}
          className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${tab === 'provider' ? 'bg-panel shadow' : 'text-text-muted'}`}
        >
          AI Provider
        </button>
      </div>

      {tab === 'profile' ? <ProfileForm /> : <AiProviderTab />}
    </div>
  );
}
