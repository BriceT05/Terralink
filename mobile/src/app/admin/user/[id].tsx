import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RoleBadge } from '@/components/cards';
import { Body, Button, Card, ChoiceGroup, Heading, InfoLine, Loading, Notice, Row, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listAssignments, listFarms, listUsers, setUserRole } from '@/lib/api';
import { callPhone, openWhatsApp } from '@/lib/contact';
import { confirm } from '@/lib/device';
import { errorMessage, formatDate, roleLabel } from '@/lib/format';
import { colors, space } from '@/lib/theme';
import type { Farm, UserRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

const roles: UserRole[] = ['owner', 'agent', 'admin'];

const roleHelp: Record<UserRole, string> = {
  owner: 'Consulte les rapports, alertes et recommandations de ses exploitations.',
  agent: 'Saisit les visites sur les exploitations qui lui sont assignées.',
  admin: 'Accès complet : comptes, exploitations, assignations et demandes.',
};

export default function AdminUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const data = useAsync(async () => {
    const [users, farms, assignments] = await Promise.all([listUsers(), listFarms(), listAssignments()]);
    return { user: users.find((u) => u.id === id) ?? null, farms, assignments };
  }, [id]);
  const [draftRole, setDraftRole] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (data.loading) return <Loading />;
  if (data.error || !data.data?.user) {
    return (
      <Screen edges={['bottom']}>
        <Notice text={data.error ?? 'Compte introuvable.'} onRetry={data.reload} />
      </Screen>
    );
  }

  const { user, farms, assignments } = data.data;
  const isSelf = user.id === profile?.id;
  const role = draftRole ?? user.role;
  const owned = farms.filter((f) => f.owner_id === user.id);
  const assignedIds = new Set(assignments.filter((a) => a.agent_id === user.id).map((a) => a.farm_id));
  const assigned = farms.filter((f) => assignedIds.has(f.id));

  async function saveRole() {
    const consequences = [
      user.role === 'agent' && assigned.length > 0 ? `Ce compte sera retiré de ${assigned.length} exploitation(s).` : null,
      role !== 'owner' && owned.length > 0 ? `Ce compte n’aura plus accès à l’espace propriétaire de ses ${owned.length} exploitation(s).` : null,
      role === 'admin' ? 'Ce compte aura accès à tous les comptes et toutes les exploitations.' : null,
    ].filter(Boolean);
    const ok = await confirm(
      `Passer en « ${roleLabel[role]} » ?`,
      [`${user.full_name || user.email} devra se déconnecter puis se reconnecter pour voir son nouvel espace.`, ...consequences].join('\n\n'),
      'Confirmer',
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await setUserRole(user.id, role);
      await data.reload();
      setDraftRole(null);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['bottom']} refreshing={data.refreshing} onRefresh={data.refresh}>
      <View style={{ gap: space[2] }}>
        <Heading>{user.full_name || 'Sans nom'}</Heading>
        <RoleBadge role={user.role} />
      </View>

      <Card style={{ gap: space[2] }}>
        <InfoLine icon="mail-outline">{user.email}</InfoLine>
        {user.phone ? <InfoLine icon="call-outline">{user.phone}</InfoLine> : null}
        {user.city || user.country ? <InfoLine icon="home-outline">{[user.city, user.country].filter(Boolean).join(', ')}</InfoLine> : null}
        <InfoLine icon="calendar-outline">Inscrit le {formatDate(user.created_at)}</InfoLine>
        {user.phone ? (
          <Row gap={space[2]} style={{ marginTop: space[2] }}>
            <Button label="Appeler" variant="secondary" icon="call-outline" compact style={{ flex: 1 }} onPress={() => callPhone(user.phone!)} />
            <Button label="WhatsApp" variant="whatsapp" icon="logo-whatsapp" compact style={{ flex: 1 }} onPress={() => openWhatsApp(user.phone!)} />
          </Row>
        ) : null}
      </Card>

      <SectionHeader title="Rôle" />
      <Card style={{ gap: space[3] }}>
        {isSelf ? (
          <Body small muted>
            C’est votre compte. Un autre membre de l’équipe TerraLink doit modifier votre rôle.
          </Body>
        ) : (
          <>
            <ChoiceGroup
              label=""
              options={roles.map((r) => ({ value: r, label: roleLabel[r] }))}
              value={role}
              onChange={(value) => {
                setSaved(false);
                setDraftRole(value === user.role ? null : value);
              }}
            />
            <Body small muted>
              {roleHelp[role]}
            </Body>
            {error ? <Notice text={error} /> : null}
            {saved ? <Notice tone="success" text="Rôle mis à jour." /> : null}
            {draftRole ? <Button label="Enregistrer le rôle" onPress={saveRole} loading={saving} /> : null}
          </>
        )}
      </Card>

      {owned.length > 0 || user.role === 'owner' ? (
        <>
          <SectionHeader title={`Exploitations possédées (${owned.length})`} />
          {owned.length === 0 ? <Body small muted>Aucune exploitation pour l’instant.</Body> : null}
          {owned.map((farm) => (
            <FarmRow key={farm.id} farm={farm} />
          ))}
          <Button
            label="Créer une exploitation"
            variant="secondary"
            icon="add-circle-outline"
            onPress={() => router.push({ pathname: '/admin/farm-form', params: { ownerId: user.id } })}
          />
        </>
      ) : null}

      {user.role === 'agent' ? (
        <>
          <SectionHeader title={`Exploitations assignées (${assigned.length})`} />
          {assigned.length === 0 ? <Body small muted>Assignez-le depuis la fiche d’une exploitation.</Body> : null}
          {assigned.map((farm) => (
            <FarmRow key={farm.id} farm={farm} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function FarmRow({ farm }: { farm: Farm }) {
  return (
    <Card onPress={() => router.push({ pathname: '/admin/farm/[id]', params: { id: farm.id } })} accessibilityLabel={farm.name}>
      <Row>
        <View style={{ flex: 1 }}>
          <Body>{farm.name}</Body>
          <Body small muted>
            {[farm.locality, farm.region].filter(Boolean).join(', ')}
          </Body>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Row>
    </Card>
  );
}
