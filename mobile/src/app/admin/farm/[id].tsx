import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Body,
  Button,
  Card,
  Eyebrow,
  Heading,
  InfoLine,
  LevelBadge,
  Loading,
  Notice,
  Row,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { assignAgent, getFarm, listAssignments, listFarmVisits, listUsers, unassignAgent } from '@/lib/api';
import { callPhone, openWhatsApp } from '@/lib/contact';
import { confirm } from '@/lib/device';
import { errorMessage, farmTypeLabel, formatCoords, formatDate } from '@/lib/format';
import { space } from '@/lib/theme';
import type { AdminUser } from '@/lib/types';

export default function AdminFarmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAsync(async () => {
    const [farm, users, assignments, visits] = await Promise.all([getFarm(id), listUsers(), listAssignments(), listFarmVisits(id)]);
    return { farm, users, assignments, visits };
  }, [id]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  if (data.loading) return <Loading />;
  if (data.error || !data.data) {
    return (
      <Screen edges={['bottom']}>
        <Notice text={data.error ?? 'Exploitation introuvable.'} onRetry={data.reload} />
      </Screen>
    );
  }

  const { farm, users, assignments, visits } = data.data;
  const owner = users.find((u) => u.id === farm.owner_id);
  const assignedIds = new Set(assignments.filter((a) => a.farm_id === farm.id).map((a) => a.agent_id));
  const assigned = users.filter((u) => assignedIds.has(u.id));
  const available = users.filter((u) => u.role === 'agent' && !assignedIds.has(u.id));
  const farmCoords = formatCoords(farm.latitude, farm.longitude);
  const published = visits.filter((v) => v.status === 'published');
  const drafts = visits.length - published.length;

  async function run(key: string, action: () => Promise<void>) {
    setBusyId(key);
    setError(null);
    try {
      await action();
      await data.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(agent: AdminUser) {
    const ok = await confirm(
      'Retirer cet agent ?',
      `${agent.full_name || agent.email} ne verra plus « ${farm.name} ». Ses rapports déjà publiés restent visibles du propriétaire.`,
      'Retirer',
    );
    if (ok) run(agent.id, () => unassignAgent(farm.id, agent.id));
  }

  return (
    <Screen edges={['bottom']} refreshing={data.refreshing} onRefresh={data.refresh}>
      <Stack.Screen options={{ title: farm.name }} />

      <View style={{ gap: space[2] }}>
        <Eyebrow>{farmTypeLabel[farm.type]}</Eyebrow>
        <Heading>{farm.name}</Heading>
      </View>

      <Card style={{ gap: space[2] }}>
        <InfoLine icon="location-outline">
          {[farm.locality, farm.region].filter(Boolean).join(', ')}
          {farm.area_ha ? ` · ${farm.area_ha} ha` : ''}
        </InfoLine>
        {farmCoords ? <InfoLine icon="navigate-outline">GPS : {farmCoords}</InfoLine> : null}
        {farm.description ? <InfoLine icon="information-circle-outline">{farm.description}</InfoLine> : null}
        {farm.manager_name ? <InfoLine icon="person-outline">Gérant : {farm.manager_name}</InfoLine> : null}
        {farm.manager_phone ? <InfoLine icon="call-outline">{farm.manager_phone}</InfoLine> : null}
        <Button
          label="Modifier les informations"
          variant="secondary"
          icon="create-outline"
          compact
          style={{ marginTop: space[2] }}
          onPress={() => router.push({ pathname: '/admin/farm-form', params: { id: farm.id } })}
        />
      </Card>

      <SectionHeader title="Propriétaire" />
      <Card
        onPress={owner ? () => router.push({ pathname: '/admin/user/[id]', params: { id: owner.id } }) : undefined}
        accessibilityLabel={owner ? `Compte de ${owner.full_name || owner.email}` : undefined}
      >
        <Heading level={4}>{owner?.full_name || 'Sans nom'}</Heading>
        {owner ? (
          <Body small muted>
            {owner.email}
          </Body>
        ) : null}
        {owner?.phone ? (
          <Row gap={space[2]} style={{ marginTop: space[2] }}>
            <Button label="Appeler" variant="secondary" icon="call-outline" compact style={{ flex: 1 }} onPress={() => callPhone(owner.phone!)} />
            <Button label="WhatsApp" variant="whatsapp" icon="logo-whatsapp" compact style={{ flex: 1 }} onPress={() => openWhatsApp(owner.phone!)} />
          </Row>
        ) : null}
      </Card>

      <SectionHeader title={`Agents assignés (${assigned.length})`} />
      {error ? <Notice text={error} /> : null}
      {assigned.length === 0 ? (
        <Notice tone="info" text="Aucun agent assigné : personne ne peut encore saisir de visite sur cette exploitation." />
      ) : null}
      {assigned.map((agent) => (
        <Card key={agent.id}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: space[1] }}>
              <Body>{agent.full_name || 'Sans nom'}</Body>
              <Body small muted>
                {agent.email}
              </Body>
            </View>
            <Button label="Retirer" variant="danger" compact loading={busyId === agent.id} onPress={() => remove(agent)} />
          </Row>
        </Card>
      ))}

      {picking ? (
        <Card style={{ gap: space[3] }}>
          <Heading level={4}>Choisir un agent</Heading>
          {available.length === 0 ? (
            <Body small muted>
              Aucun autre agent disponible. Nommez d’abord un agent depuis l’onglet « Comptes ».
            </Body>
          ) : null}
          {available.map((agent) => (
            <Row key={agent.id} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Body>{agent.full_name || 'Sans nom'}</Body>
                <Body small muted>
                  {agent.email}
                </Body>
              </View>
              <Button
                label="Assigner"
                compact
                loading={busyId === agent.id}
                onPress={() => run(agent.id, () => assignAgent(farm.id, agent.id))}
              />
            </Row>
          ))}
          <Button label="Fermer" variant="ghost" compact onPress={() => setPicking(false)} />
        </Card>
      ) : (
        <Button label="Assigner un agent" variant="secondary" icon="person-add-outline" onPress={() => setPicking(true)} />
      )}

      <SectionHeader title="Visites" />
      <Body small muted>
        {published.length} rapport(s) publié(s){drafts > 0 ? ` · ${drafts} brouillon(s) en cours` : ''}
      </Body>
      {published.map((visit) => (
        <Card key={visit.id} onPress={() => router.push({ pathname: '/report/[id]', params: { id: visit.id } })} accessibilityLabel={`Rapport du ${formatDate(visit.visited_at)}`}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Body small>{formatDate(visit.visited_at)}</Body>
            <LevelBadge level={visit.overall_status} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
