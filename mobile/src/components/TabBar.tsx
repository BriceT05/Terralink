import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

import { colors, fonts } from '@/lib/theme';

import type { IconName } from './ui';

export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.green,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.sand2, minHeight: 60 },
  tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  sceneStyle: { backgroundColor: colors.sand },
} as const;

export function tabIcon(icon: IconName, activeIcon: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? activeIcon : icon} size={24} color={color as string} />;
  };
}
