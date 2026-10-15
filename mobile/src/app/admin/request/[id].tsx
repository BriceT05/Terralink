import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RequestStatusBadge } from '@/components/cards';
import { Body, Button, Card, ChoiceGroup, Eyebrow, Heading, InfoLine, Loading, Notice, Row, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { getDiagnosticRequest, setRequestStatus } from '@/lib/api';
import { callPhone, openWhatsApp, sendEmail } from '@/lib/contact';
import { errorMessage, farmTypeLabel, formatDate, requestStatusLabel } from '@/lib/format';
import { space } from '@/lib/theme';
import type { RequestStatus } from '@/lib/types';

const statuses: RequestStatus[] = ['new', 'contacted', 'converted', 'closed'];

export default function AdminRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useAsync(() => getDiagnosticRequest(id), [id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (request.loading) return <Loading />;
  if (request.error || !request.data) {
    return (
      <Screen edges={['bottom']}>
        <Notice text={request.error ?? 'Demande introuvable.'} onRetry={request.reload} />
      </Screen>
    );
  }

  const r = request.data;

  async function changeStatus(status: RequestStatus) {
    if (status === r.status) return;
    setSaving(true);
    setError(null);
    try {
      await setRequestStatus(r.id, status);
      await request.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['bottom']} refreshing={request.refreshing} onRefresh={request.refresh}>
      <View style={{ gap: space[2] }}>
        <Eyebrow>Reçue le {formatDate(r.created_at, true)}</Eyebrow>
        <Heading>{r.full_name}</Heading>
        <RequestStatusBadge status={r.status} />
      </View>

      <Card style={{ gap: space[2] }}>
        <InfoLine icon="mail-outline">{r.email}</InfoLine>
        <InfoLine icon="call-outline">{r.phone}</InfoLine>
        <InfoLine icon="home-outline">
          Réside à {r.city}, {r.country}
        </InfoLine>
        <Row gap={space[2]} style={{ marginTop: space[2], flexWrap: 'wrap' }}>
          <Button label="WhatsApp" variant="whatsapp" icon="logo-whatsapp" compact style={{ flexGrow: 1 }} onPress={() => openWhatsApp(r.phone)} />
          <Button label="Appeler" variant="secondary" icon="call-outline" compact style={{ flexGrow: 1 }} onPress={() => callPhone(r.phone)} />
          <Button
            label="E-mail"
            variant="secondary"
            icon="mail-outline"
            compact
            style={{ flexGrow: 1 }}
            onPress={() => sendEmail(r.email, 'Votre demande de diagnostic TerraLink')}
          />
        </Row>
      </Card>

      <SectionHeader title="Exploitation et besoin" />
      <Card style={{ gap: space[2] }}>
        <InfoLine icon="location-outline">{r.farm_location}</InfoLine>
        <InfoLine icon="leaf-outline">{farmTypeLabel[r.farm_type]}</InfoLine>
        <Body>{r.need}</Body>
        {r.message ? (
          <Body small muted>
            « {r.message} »
          </Body>
        ) : null}
      </Card>

      <SectionHeader title="Suivi de la demande" />
      {error ? <Notice text={error} /> : null}
      <ChoiceGroup label="Statut" options={statuses.map((s) => ({ value: s, label: requestStatusLabel[s] }))} value={r.status} onChange={changeStatus} />
      {saving ? <Loading label="Enregistrement…" /> : null}

      <Button
        label="Créer son exploitation"
        icon="add-circle-outline"
        onPress={() => router.push({ pathname: '/admin/farm-form', params: { requestId: r.id } })}
      />
      <Body small muted style={{ textAlign: 'center' }}>
        L’exploitation sera rattachée au compte qui a envoyé la demande, et la demande passera en « {requestStatusLabel.converted} ».
      </Body>
      <Button
        label="Voir son compte"
        variant="ghost"
        icon="person-outline"
        onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: r.user_id } })}
      />
    </Screen>
  );
}
