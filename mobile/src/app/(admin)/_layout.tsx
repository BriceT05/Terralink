import { Tabs } from 'expo-router/js-tabs';

import { tabIcon, tabScreenOptions } from '@/components/TabBar';

export default function AdminLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="fermes" options={{ title: 'Exploitations', tabBarIcon: tabIcon('leaf-outline', 'leaf') }} />
      <Tabs.Screen name="utilisateurs" options={{ title: 'Comptes', tabBarIcon: tabIcon('people-outline', 'people') }} />
      <Tabs.Screen name="demandes" options={{ title: 'Demandes', tabBarIcon: tabIcon('mail-outline', 'mail') }} />
      <Tabs.Screen name="parametres" options={{ title: 'Profil', tabBarIcon: tabIcon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
