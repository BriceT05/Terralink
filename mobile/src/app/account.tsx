import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { Button, Card, Notice, Screen, TextField } from '@/components/ui';
import { updateProfile } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { space } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function AccountScreen() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  async function save() {
    if (!fullName.trim()) {
      setError('Indiquez votre nom.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile(profile!.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        country: country.trim() || null,
        city: city.trim() || null,
      });
      await refreshProfile();
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Card style={{ gap: space[4] }}>
          {error ? <Notice text={error} /> : null}
          <TextField label="Nom et prénom" value={fullName} onChangeText={setFullName} autoComplete="name" />
          <TextField label="Numéro WhatsApp ou téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          <TextField label="Pays de résidence" value={country} onChangeText={setCountry} autoComplete="country" />
          <TextField label="Ville de résidence" value={city} onChangeText={setCity} />
          <Button label="Enregistrer" onPress={save} loading={saving} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
