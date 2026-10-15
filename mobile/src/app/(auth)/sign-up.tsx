import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Body, Button, Card, Heading, IconButton, Logo, Notice, Row, Screen, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function signUp() {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = 'Indiquez votre nom.';
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Adresse e-mail incomplète.';
    if (password.length < 8) next.password = 'Au moins 8 caractères.';
    setErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), phone: phone.trim() || null } },
    });
    setLoading(false);
    if (error) setError(errorMessage(error));
    // Sans session, Supabase attend la confirmation de l'adresse e-mail.
    else if (!data.session) setDone(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <Row>
          <IconButton icon="arrow-back" label="Retour" onPress={() => router.back()} />
          <Logo size={32} />
        </Row>

        <Heading>Créer un compte</Heading>
        <Body muted>
          Votre compte vous permet de demander un diagnostic, puis de recevoir les rapports de suivi de votre exploitation.
        </Body>

        {done ? (
          <Card style={{ gap: space[4] }}>
            <Notice tone="success" text={`Un e-mail de confirmation a été envoyé à ${email.trim()}. Cliquez sur le lien reçu, puis connectez-vous.`} />
            <Button label="Retour à la connexion" onPress={() => router.replace('/sign-in')} />
          </Card>
        ) : (
          <Card style={{ gap: space[4], padding: space[5] }}>
            {error ? <Notice text={error} /> : null}
            <TextField label="Nom et prénom" value={fullName} onChangeText={setFullName} autoComplete="name" error={errors.fullName} />
            <TextField
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              error={errors.email}
            />
            <TextField
              label="Numéro WhatsApp"
              optional
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+33 6 12 34 56 78"
            />
            <TextField
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              error={errors.password}
              hint="Au moins 8 caractères."
            />
            <Button label="Créer mon compte" onPress={signUp} loading={loading} />
          </Card>
        )}

        <View style={{ height: space[5] }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
