import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { errorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

import { Body, Button, Card, Heading, Logo, Notice, Screen, TextField } from './ui';

// Affiché après le lien « mot de passe oublié » reçu par e-mail.
export function NewPasswordScreen() {
  const { endPasswordRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save() {
    if (password.length < 8) {
      setError('Au moins 8 caractères.');
      return;
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) setError(errorMessage(updateError));
    else setDone(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Logo />
        <Heading>Nouveau mot de passe</Heading>
        {done ? (
          <>
            <Notice tone="success" text="Votre mot de passe a été modifié." />
            <Button label="Continuer" onPress={endPasswordRecovery} />
          </>
        ) : (
          <Card style={{ gap: space[4] }}>
            <Body muted>Choisissez le mot de passe que vous utiliserez désormais pour vous connecter.</Body>
            <TextField label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="Au moins 8 caractères." />
            <TextField label="Confirmez le mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" />
            {error ? <Notice text={error} /> : null}
            <Button label="Enregistrer" onPress={save} loading={saving} />
            <Button label="Annuler et se déconnecter" variant="ghost" onPress={signOut} />
          </Card>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
