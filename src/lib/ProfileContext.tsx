import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getProfile } from './profile';
import type { Profile } from '../types/db';
import { useAuth } from './AuthContext';

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  refresh: () => void;
}

const ProfileContext = createContext<ProfileState>({ profile: null, loading: true, refresh: () => {} });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getProfile(session.user.id)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <ProfileContext.Provider value={{ profile, loading, refresh }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
