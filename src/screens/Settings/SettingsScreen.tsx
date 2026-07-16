import { useState } from 'react';
import { ProfileForm } from '../Profile/ProfileForm';
import { AiProviderTab } from './AiProviderTab';

export function SettingsScreen() {
  const [tab, setTab] = useState<'profile' | 'provider'>('profile');

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Profile / Settings</h1>

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
