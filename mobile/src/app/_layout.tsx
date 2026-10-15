import { Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Body, Button, EmptyState, Logo, Screen } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lora_600SemiBold,
    Lora_700Bold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isSupabaseConfigured ? (
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      ) : (
        <MissingConfig />
      )}
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, profile, initializing, profileError, refreshProfile, signOut } = useAuth();

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync().catch(() => {});
  }, [initializing]);

  if (initializing) return <View style={{ flex: 1, backgroundColor: colors.sand }} />;

  if (session && !profile) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Profil indisponible"
          text={profileError ? 'Impossible de charger votre profil. Vérifiez votre connexion.' : 'Chargement du profil…'}
          action={
            <View style={{ gap: 12 }}>
              <Button label="Réessayer" onPress={refreshProfile} />
              <Button label="Se déconnecter" variant="ghost" onPress={signOut} />
            </View>
          }
        />
      </Screen>
    );
  }

  const isOwner = profile?.role === 'owner';
  const isAgent = profile?.role === 'agent';
  const isAdmin = profile?.role === 'admin';

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.sand },
        headerShadowVisible: false,
        headerTintColor: colors.green,
        headerTitleStyle: { fontFamily: fonts.titleSemi, fontSize: 18, color: colors.green },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.sand },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(session) && isOwner}>
        <Stack.Screen name="(owner)" options={{ headerShown: false }} />
        <Stack.Screen name="recommendation/[id]" options={{ title: 'Recommandation' }} />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(session) && isAgent}>
        <Stack.Screen name="(agent)" options={{ headerShown: false }} />
        <Stack.Screen name="farm/[id]" options={{ title: 'Exploitation' }} />
        <Stack.Screen name="visit/[id]" options={{ title: 'Visite de terrain' }} />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(session) && isAdmin}>
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="admin/farm/[id]" options={{ title: 'Exploitation' }} />
        <Stack.Screen name="admin/farm-form" options={{ title: 'Exploitation', presentation: 'modal' }} />
        <Stack.Screen name="admin/user/[id]" options={{ title: 'Compte' }} />
        <Stack.Screen name="admin/request/[id]" options={{ title: 'Demande de diagnostic' }} />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="report/[id]" options={{ title: 'Rapport de visite' }} />
        <Stack.Screen name="diagnostic" options={{ title: 'Demande de diagnostic', presentation: 'modal' }} />
        <Stack.Screen name="account" options={{ title: 'Mes informations' }} />
      </Stack.Protected>
    </Stack>
  );
}

function MissingConfig() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <Screen>
      <Logo />
      <EmptyState
        icon="construct-outline"
        title="Configuration Supabase manquante"
        text="Copiez mobile/.env.example en .env.local, renseignez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY, puis relancez « npx expo start -c »."
      />
      <Body small muted style={{ textAlign: 'center' }}>
        Voir le README pour la mise en place complète.
      </Body>
    </Screen>
  );
}
