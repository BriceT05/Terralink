import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Eyebrow, Heading, Logo, Notice, Screen, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space, type } from '@/lib/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Renseignez votre adresse e-mail et votre mot de passe.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(errorMessage(error));
  }

  async function resetPassword() {
    setError(null);
    if (!email.trim()) {
      setError('Indiquez votre adresse e-mail pour recevoir le lien de réinitialisation.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) setError(errorMessage(error));
    else setInfo('Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={{ gap: space[5] }}>
        <View style={{ marginTop: space[5] }}>
          <Logo />
        </View>

        <View style={{ gap: space[3] }}>
          <Eyebrow>Suivi d’exploitation à distance</Eyebrow>
          <Heading level={1}>Votre exploitation avance. Même quand vous êtes loin.</Heading>
          <Body muted>
            Rapports de visite, photos localisées, alertes et recommandations : gardez une vision claire de votre exploitation au Sénégal.
          </Body>
        </View>

        <Card style={{ gap: space[4], padding: space[5] }}>
          <Heading level={3}>Connexion</Heading>
          {error ? <Notice text={error} /> : null}
          {info ? <Notice text={info} tone="success" /> : null}
          <TextField
            label="Adresse e-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="vous@exemple.com"
          />
          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={signIn}
          />
          <Button label="Se connecter" onPress={signIn} loading={loading} />
          <Pressable onPress={resetPassword} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type.small, { color: colors.terracottaDark, fontFamily: fonts.bodyMedium }]}>Mot de passe oublié ?</Text>
          </Pressable>
        </Card>

        <View style={{ gap: space[3] }}>
          <Body small muted style={{ textAlign: 'center' }}>
            Pas encore client ? Créez un compte pour demander un diagnostic de votre exploitation.
          </Body>
          <Button label="Créer un compte" variant="secondary" onPress={() => router.push('/sign-up')} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
