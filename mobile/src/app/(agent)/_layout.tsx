import { Tabs } from 'expo-router/js-tabs';

import { tabIcon, tabScreenOptions } from '@/components/TabBar';

export default function AgentLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="exploitations" options={{ title: 'Exploitations', tabBarIcon: tabIcon('leaf-outline', 'leaf') }} />
      <Tabs.Screen name="visites" options={{ title: 'Mes visites', tabBarIcon: tabIcon('clipboard-outline', 'clipboard') }} />
      <Tabs.Screen name="moi" options={{ title: 'Profil', tabBarIcon: tabIcon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
