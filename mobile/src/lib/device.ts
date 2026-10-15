import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

import type { Coords } from './api';

// Position actuelle pour géolocaliser une visite ou une photo ; null si refusée ou indisponible.
export async function getCurrentCoords(): Promise<Coords> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
    const fallback = position ?? (await Location.getLastKnownPositionAsync());
    return fallback ? { latitude: fallback.coords.latitude, longitude: fallback.coords.longitude } : null;
  } catch {
    return null;
  }
}

export function confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
