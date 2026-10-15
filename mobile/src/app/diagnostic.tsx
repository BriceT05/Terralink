import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { Body, Button, Card, ChoiceGroup, EmptyState, Notice, Screen, TextField } from '@/components/ui';
import { createDiagnosticRequest } from '@/lib/api';
import { openWhatsApp } from '@/lib/contact';
import { errorMessage, farmTypeLabel } from '@/lib/format';
import { space } from '@/lib/theme';
import type { FarmType } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

const farmTypes: FarmType[] = ['agriculture', 'elevage', 'mixte', 'autre'];

// Champs repris du cahier des charges (page « Contact et demande de diagnostic »).
export default function DiagnosticScreen() {
  const { session, profile } = useAuth();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    email: session?.user.email ?? '',
    phone: profile?.phone ?? '',
    country: profile?.country ?? '',
    city: profile?.city ?? '',
    farm_location: '',
    need: '',
    message: '',
  });
  const [farmType, setFarmType] = useState<FarmType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    const required: (keyof typeof form)[] = ['full_name', 'email', 'phone', 'country', 'city', 'farm_location', 'need'];
    const next: Record<string, string> = {};
    for (const key of required) if (!form[key].trim()) next[key] = 'Ce champ est requis.';
    if (!farmType) next.farm_type = 'Choisissez un type d’exploitation.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setError('Certains champs sont à compléter.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await createDiagnosticRequest({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        city: form.city.trim(),
        farm_location: form.farm_location.trim(),
        farm_type: farmType!,
        need: form.need.trim(),
        message: form.message.trim() || null,
      });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="checkmark-circle-outline"
          title="Demande envoyée"
          text="Merci. L’équipe TerraLink vous recontacte pour convenir d’un premier échange. Vous pouvez suivre votre demande depuis votre profil."
          action={<Button label="Fermer" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Body muted>
          Décrivez votre exploitation et votre besoin de suivi. Nous définirons ensemble les informations à recueillir et les modalités d’intervention.
        </Body>
        <Card style={{ gap: space[4] }}>
          <TextField label="Nom ou prénom" value={form.full_name} onChangeText={set('full_name')} error={errors.full_name} />
          <TextField label="Adresse e-mail" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
          <TextField label="Numéro WhatsApp ou téléphone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} />
          <TextField label="Pays de résidence" value={form.country} onChangeText={set('country')} error={errors.country} />
          <TextField label="Ville de résidence" value={form.city} onChangeText={set('city')} error={errors.city} />
          <TextField
            label="Localisation de l’exploitation au Sénégal"
            value={form.farm_location}
            onChangeText={set('farm_location')}
            placeholder="Ex. : Pout, région de Thiès"
            error={errors.farm_location}
          />
          <ChoiceGroup
            label="Type d’exploitation"
            value={farmType}
            onChange={setFarmType}
            options={farmTypes.map((t) => ({ value: t, label: farmTypeLabel[t] }))}
          />
          {errors.farm_type ? <Notice text={errors.farm_type} /> : null}
          <TextField
            label="Besoin principal"
            value={form.need}
            onChangeText={set('need')}
            multiline
            placeholder="Ex. : savoir si les travaux avancent comme prévu, vérifier l’état du cheptel…"
            error={errors.need}
          />
          <TextField label="Message complémentaire" optional value={form.message} onChangeText={set('message')} multiline />
          {error ? <Notice text={error} /> : null}
          <Button label="Envoyer ma demande" onPress={submit} loading={sending} />
        </Card>
        <Button label="Préférer WhatsApp" variant="whatsapp" icon="logo-whatsapp" onPress={() => openWhatsApp()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
