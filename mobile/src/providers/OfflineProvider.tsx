import * as Network from 'expo-network';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getOfflineState, loadOfflineStore, subscribeOffline } from '@/lib/offline';
import { syncNow } from '@/lib/sync';
import { useAuth } from '@/providers/AuthProvider';

const RETRY_INTERVAL = 60_000;

// Active la saisie hors connexion pour les agents : charge leurs données locales
// et relance l'envoi au retour du réseau, au retour dans l'app et à intervalle régulier.
export function OfflineProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const agentId = profile?.role === 'agent' ? profile.id : null;
  const hasPending = useOfflineState().ops.length > 0;

  useEffect(() => {
    loadOfflineStore(agentId).then(() => {
      if (agentId) syncNow();
    });
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;
    const network = Network.addNetworkStateListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) syncNow();
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncNow();
    });
    return () => {
      network.remove();
      appState.remove();
    };
  }, [agentId]);

  useEffect(() => {
    if (!agentId || !hasPending) return;
    const timer = setInterval(() => syncNow(), RETRY_INTERVAL);
    return () => clearInterval(timer);
  }, [agentId, hasPending]);

  return children;
}

export function useOfflineState() {
  return useSyncExternalStore(subscribeOffline, getOfflineState);
}

// Hors ligne quand l'appareil sait qu'il n'a pas de connexion ; inconnu = en ligne.
export function useIsOffline() {
  const network = Network.useNetworkState();
  return network.isConnected === false || network.isInternetReachable === false;
}
