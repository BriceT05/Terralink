import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions, type ColorValue } from 'react-native';

import { colors, fonts } from '@/lib/theme';

import type { IconName } from './ui';

// Au-delà de cette largeur (tablette paysage, ordinateur), les onglets passent en barre latérale.
const SIDEBAR_MIN_WIDTH = 900;

const baseOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.green,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  sceneStyle: { backgroundColor: colors.sand },
} as const;

export function useTabScreenOptions() {
  const { width } = useWindowDimensions();
  if (width >= SIDEBAR_MIN_WIDTH) {
    return {
      ...baseOptions,
      tabBarPosition: 'left',
      tabBarVariant: 'material',
      tabBarLabelPosition: 'below-icon',
      tabBarStyle: { backgroundColor: colors.white, borderRightColor: colors.sand2 },
    } as const;
  }
  return {
    ...baseOptions,
    tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.sand2, minHeight: 60 },
  } as const;
}

export function tabIcon(icon: IconName, activeIcon: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? activeIcon : icon} size={24} color={color as string} />;
  };
}
