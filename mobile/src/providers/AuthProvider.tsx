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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(false);
    try {
      setProfile(await getProfile(userId));
    } catch {
      setProfileError(true);
    } finally {
      setProfileLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      initializing: !sessionLoaded || (Boolean(userId) && !profile && profileLoading),
      profileError,
      refreshProfile: loadProfile,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [session, profile, sessionLoaded, userId, profileLoading, profileError, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
