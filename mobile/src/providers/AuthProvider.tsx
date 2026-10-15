import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getProfile } from '@/lib/api';
import { clearPrivateData, isNetworkError, profileCacheKey } from '@/lib/offline';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  initializing: boolean;
  profileError: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  // Ouvert depuis le lien « mot de passe oublié » : l'utilisateur doit choisir un nouveau mot de passe.
  recoveringPassword: boolean;
  endPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type ProfileLoad = { userId: string; profile: Profile | null; error: boolean };

// Sans réseau, on repart du dernier profil connu pour que l'app reste utilisable sur le terrain.
async function fetchProfile(userId: string): Promise<ProfileLoad> {
  try {
    const profile = await getProfile(userId);
    AsyncStorage.setItem(profileCacheKey(userId), JSON.stringify(profile)).catch(() => {});
    return { userId, profile, error: false };
  } catch (e) {
    const cached = isNetworkError(e) ? await AsyncStorage.getItem(profileCacheKey(userId)).catch(() => null) : null;
    return cached ? { userId, profile: JSON.parse(cached) as Profile, error: false } : { userId, profile: null, error: true };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Dernier chargement du profil, rattaché à l'utilisateur concerné : un changement de compte l'invalide.
  const [loaded, setLoaded] = useState<ProfileLoad | null>(null);
  const [recoveringPassword, setRecoveringPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchProfile(userId).then((result) => {
      if (active) setLoaded(result);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setLoaded((prev) => (prev?.userId === userId ? { ...prev, error: false } : prev));
    const result = await fetchProfile(userId);
    // En cas d'échec, on garde le profil déjà affiché.
    setLoaded((prev) => (result.error && prev?.userId === userId ? { ...prev, error: true } : result));
  }, [userId]);

  const current = userId && loaded?.userId === userId ? loaded : null;
  const profile = current?.profile ?? null;
  const profileError = current?.error ?? false;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      initializing: !sessionLoaded || (Boolean(userId) && !current),
      profileError,
      refreshProfile,
      signOut: async () => {
        if (userId) await clearPrivateData(userId);
        await supabase.auth.signOut();
        setLoaded(null);
        setRecoveringPassword(false);
      },
      recoveringPassword,
      endPasswordRecovery: () => setRecoveringPassword(false),
    }),
    [session, profile, sessionLoaded, userId, current, profileError, refreshProfile, recoveringPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
