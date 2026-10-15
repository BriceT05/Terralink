import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

// Point d'entrée : oriente vers l'espace correspondant au rôle.
export default function Index() {
  const { session, profile } = useAuth();
  if (!session) return <Redirect href="/sign-in" />;
  if (profile?.role === 'owner') return <Redirect href="/accueil" />;
  return <Redirect href="/exploitations" />;
}
