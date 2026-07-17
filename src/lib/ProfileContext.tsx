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
  // Key off the stable user id, not the whole session object — Supabase hands
  // back a fresh session object on every token refresh / tab-focus event, and
  // re-fetching on each of those caused transient nulls that bounced the user
  // to /onboarding (see Timeline v2.2). Same user id = no refetch.
  const userId = session?.user.id ?? null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getProfile(userId)
      // Never clobber a known-good profile with a transient null (e.g. a query
      // that raced an in-flight token refresh and hit RLS with no auth.uid());
      // only replace it with a real row, or keep what we had.
      .then((p) => setProfile((prev) => p ?? prev))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    // On a real user switch (login/logout/different account) drop the old
    // profile so a stale one can't leak across users.
    setProfile(null);
    refresh();
  }, [refresh]);

  return <ProfileContext.Provider value={{ profile, loading, refresh }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
