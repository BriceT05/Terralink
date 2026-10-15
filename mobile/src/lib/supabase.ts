import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Sur le web, les liens reçus par e-mail (confirmation, mot de passe oublié) ouvrent une session.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Page ouverte par les liens envoyés par e-mail : le site lui-même sur le web, sinon l'adresse
// de la version web (EXPO_PUBLIC_WEB_URL) pour finir l'opération dans le navigateur.
export const authRedirectUrl: string | undefined =
  Platform.OS === 'web' ? window.location.origin : process.env.EXPO_PUBLIC_WEB_URL || undefined;

// Le rafraîchissement du jeton ne tourne que lorsque l'app est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const PHOTO_BUCKET = 'visit-photos';
