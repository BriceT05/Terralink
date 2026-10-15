import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getProfile } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  initializing: boolean;
  profileError: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type ProfileLoad = { userId: string; profile: Profile | null; error: boolean };

function fetchProfile(userId: string): Promise<ProfileLoad> {
  return getProfile(userId).then(
    (profile) => ({ userId, profile, error: false }),
    () => ({ userId, profile: null, error: true }),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Dernier chargement du profil, rattaché à l'utilisateur concerné : un changement de compte l'invalide.
  const [loaded, setLoaded] = useState<ProfileLoad | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
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
        await supabase.auth.signOut();
        setLoaded(null);
      },
    }),
    [session, profile, sessionLoaded, userId, current, profileError, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
