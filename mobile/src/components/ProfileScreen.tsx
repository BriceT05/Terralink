import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAsync } from '@/hooks/useAsync';
import { listMyDiagnosticRequests } from '@/lib/api';
import { openWhatsApp, sendEmail, TERRALINK_EMAIL } from '@/lib/contact';
import { formatDate, requestStatusLabel } from '@/lib/format';
import { colors, space } from '@/lib/theme';
import type { UserRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

import { Badge, Body, Button, Card, Divider, Heading, InfoLine, Row, Screen, SectionHeader } from './ui';

const roleLabel: Record<UserRole, string> = {
  owner: 'Propriétaire',
  agent: 'Agent de terrain',
  admin: 'Équipe TerraLink',
};

export function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const isOwner = profile?.role === 'owner';
  const requests = useAsync(() => (isOwner ? listMyDiagnosticRequests() : Promise.resolve([])), [isOwner]);

  if (!profile) return null;

  return (
    <Screen>
      <Heading>Profil</Heading>

      <Card style={{ gap: space[3] }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: space[1] }}>
            <Heading level={3}>{profile.full_name || 'Sans nom'}</Heading>
            <Body small muted>
              {session?.user.email}
            </Body>
          </View>
          <Badge label={roleLabel[profile.role]} bg={colors.greenTint} fg={colors.greenDark} />
        </Row>
        {profile.phone ? <InfoLine icon="call-outline">{profile.phone}</InfoLine> : null}
        {profile.city || profile.country ? (
          <InfoLine icon="location-outline">{[profile.city, profile.country].filter(Boolean).join(', ')}</InfoLine>
        ) : null}
        <Button label="Modifier mes informations" variant="secondary" icon="create-outline" onPress={() => router.push('/account')} />
      </Card>

      {isOwner ? (
        <>
          <SectionHeader title="Mes demandes de diagnostic" />
          {requests.data?.length ? (
            requests.data.map((request) => (
              <Card key={request.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body small muted>
                    {formatDate(request.created_at)}
                  </Body>
                  <Badge label={requestStatusLabel[request.status]} />
                </Row>
                <Body>{request.farm_location}</Body>
                <Body small muted numberOfLines={2}>
                  {request.need}
                </Body>
              </Card>
            ))
          ) : (
            <Body muted small>
              Aucune demande envoyée.
            </Body>
          )}
          <Button label="Demander un diagnostic" variant="secondary" onPress={() => router.push('/diagnostic')} />
        </>
      ) : null}

      <SectionHeader title="Contacter TerraLink" />
      <Card style={{ gap: space[3] }}>
        <Button label="Écrire sur WhatsApp" variant="whatsapp" icon="logo-whatsapp" onPress={() => openWhatsApp()} />
        {TERRALINK_EMAIL ? (
          <Button label={TERRALINK_EMAIL} variant="ghost" icon="mail-outline" onPress={() => sendEmail(undefined, 'Question depuis l’application')} />
        ) : null}
      </Card>

      <Divider />
      <Button
        label="Se déconnecter"
        variant="danger"
        icon="log-out-outline"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          await signOut();
        }}
      />
    </Screen>
  );
}
