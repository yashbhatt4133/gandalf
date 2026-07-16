import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getLlmSettings, type LlmSettingsResponse } from './api';
import { useAuth } from './AuthContext';

interface ProviderBadgeState {
  settings: LlmSettingsResponse | null;
  refresh: () => void;
}

const ProviderBadgeContext = createContext<ProviderBadgeState>({ settings: null, refresh: () => {} });

export function ProviderBadgeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [settings, setSettings] = useState<LlmSettingsResponse | null>(null);

  const refresh = useCallback(() => {
    if (!session) {
      setSettings(null);
      return;
    }
    getLlmSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <ProviderBadgeContext.Provider value={{ settings, refresh }}>{children}</ProviderBadgeContext.Provider>;
}

export function useProviderBadge() {
  return useContext(ProviderBadgeContext);
}
