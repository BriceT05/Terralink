import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { listFarms } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import type { Farm } from '@/lib/types';

const STORAGE_KEY = 'terralink.selectedFarm';

type FarmContextValue = {
  farms: Farm[];
  farm: Farm | null;
  loading: boolean;
  error: string | null;
  selectFarm: (id: string) => void;
  reload: () => Promise<void>;
};

const FarmContext = createContext<FarmContextValue | null>(null);

type FarmsLoad = { list: Farm[]; stored: string | null } | { error: string };

async function fetchFarms(): Promise<FarmsLoad> {
  try {
    const [list, stored] = await Promise.all([listFarms(), AsyncStorage.getItem(STORAGE_KEY).catch(() => null)]);
    return { list, stored };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// Exploitation sélectionnée par le propriétaire (il peut en suivre plusieurs).
export function FarmProvider({ children }: { children: ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((result: FarmsLoad) => {
    if ('error' in result) {
      setError(result.error);
    } else {
      const { list, stored } = result;
      setFarms(list);
      setSelectedId((current) => {
        const wanted = current ?? stored;
        return list.some((f) => f.id === wanted) ? wanted : (list[0]?.id ?? null);
      });
      setError(null);
    }
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    apply(await fetchFarms());
  }, [apply]);

  useEffect(() => {
    let active = true;
    fetchFarms().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  const value = useMemo<FarmContextValue>(
    () => ({
      farms,
      farm: farms.find((f) => f.id === selectedId) ?? null,
      loading,
      error,
      reload,
      selectFarm: (id) => {
        setSelectedId(id);
        AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
      },
    }),
    [farms, selectedId, loading, error, reload],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm doit être utilisé dans <FarmProvider>');
  return ctx;
}
