import { Tabs } from 'expo-router/js-tabs';

import { tabIcon, tabScreenOptions } from '@/components/TabBar';
import { FarmProvider } from '@/providers/FarmProvider';

export default function OwnerLayout() {
  return (
    <FarmProvider>
      <Tabs screenOptions={tabScreenOptions}>
        <Tabs.Screen name="accueil" options={{ title: 'Accueil', tabBarIcon: tabIcon('home-outline', 'home') }} />
        <Tabs.Screen name="rapports" options={{ title: 'Rapports', tabBarIcon: tabIcon('document-text-outline', 'document-text') }} />
        <Tabs.Screen name="alertes" options={{ title: 'Alertes', tabBarIcon: tabIcon('notifications-outline', 'notifications') }} />
        <Tabs.Screen name="actions" options={{ title: 'Actions', tabBarIcon: tabIcon('checkbox-outline', 'checkbox') }} />
        <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: tabIcon('person-circle-outline', 'person-circle') }} />
      </Tabs>
    </FarmProvider>
  );
}
