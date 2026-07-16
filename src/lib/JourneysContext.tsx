import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listJourneys } from './journeys';
import type { Journey } from '../types/db';
import { useAuth } from './AuthContext';

interface JourneysState {
  journeys: Journey[];
  loading: boolean;
  refresh: () => void;
}

const JourneysContext = createContext<JourneysState>({ journeys: [], loading: true, refresh: () => {} });

export function JourneysProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!session) {
      setJourneys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listJourneys(session.user.id)
      .then(setJourneys)
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <JourneysContext.Provider value={{ journeys, loading, refresh }}>{children}</JourneysContext.Provider>;
}

export function useJourneys() {
  return useContext(JourneysContext);
}
