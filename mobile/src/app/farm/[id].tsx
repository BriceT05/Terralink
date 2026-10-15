import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AlertCard, RecommendationCard } from '@/components/cards';
import {
  Badge,
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
import { getFarm, listAlerts, listFarmVisits, listRecommendations, setAlertStatus, setRecommendationStatus } from '@/lib/api';
import { callPhone, openWhatsApp } from '@/lib/contact';
import { getCurrentCoords } from '@/lib/device';
import { errorMessage, farmTypeLabel, formatCoords, formatDate } from '@/lib/format';
import { cachedQuery, createLocalVisit } from '@/lib/offline';
import { syncNow } from '@/lib/sync';
import { colors, space } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useOfflineState } from '@/providers/OfflineProvider';

export default function AgentFarmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  // Dernière version connue gardée sur le téléphone pour pouvoir démarrer une visite sans réseau.
  const data = useAsync(
    () =>
      cachedQuery(`farm.${id}`, async () => {
        const [farm, visits, alerts, recos] = await Promise.all([getFarm(id), listFarmVisits(id), listAlerts(id), listRecommendations(id)]);
        return { farm, visits, alerts, recos };
      }),
    [id],
  );
  const offline = useOfflineState();
  const [starting, setStarting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (data.loading) return <Loading />;
  if (data.error || !data.data) {
    return (
      <Screen edges={['bottom']}>
        <Notice text={data.error ?? 'Exploitation introuvable.'} onRetry={data.reload} />
      </Screen>
    );
  }

  const { farm, visits: serverVisits, alerts, recos } = data.data.value;
  const fromCache = data.data.fromCache;
  // Brouillons créés sur ce téléphone et pas encore arrivés sur le serveur.
  const localDrafts = Object.values(offline.visits).filter((v) => v.farm_id === farm.id && !serverVisits.some((s) => s.id === v.id));
  const discarded = new Set(offline.ops.filter((op) => op.kind === 'deleteVisit').map((op) => op.visitId));
  const visits = [...localDrafts, ...serverVisits].filter((v) => !discarded.has(v.id));
  const myDraft = visits.find((v) => v.status === 'draft' && v.agent_id === profile?.id);
  const openAlerts = alerts.filter((a) => a.status === 'open');
  const activeRecos = recos.filter((r) => r.status === 'accepted' || r.status === 'in_progress' || r.status === 'proposed');
  const farmCoords = formatCoords(farm.latitude, farm.longitude);

  async function startVisit() {
    if (myDraft) {
      router.push({ pathname: '/visit/[id]', params: { id: myDraft.id } });
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const visitId = createLocalVisit({
        farm: { id: farm.id, name: farm.name },
        agentId: profile!.id,
        agentName: profile!.full_name,
        coords: await getCurrentCoords(),
      });
      syncNow();
      router.push({ pathname: '/visit/[id]', params: { id: visitId } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  async function run(itemId: string, action: () => Promise<void>) {
    setBusyId(itemId);
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

  return (
    <Screen edges={['bottom']} refreshing={data.refreshing} onRefresh={data.refresh}>
      <Stack.Screen options={{ title: farm.name }} />

      <View style={{ gap: space[2] }}>
        <Eyebrow>{farmTypeLabel[farm.type]}</Eyebrow>
        <Heading>{farm.name}</Heading>
      </View>
      {fromCache ? (
        <Notice tone="info" text="Hors connexion : informations de votre dernière consultation. Vous pouvez quand même saisir une visite." />
      ) : null}

      <Card style={{ gap: space[2] }}>
        <InfoLine icon="location-outline">
          {[farm.locality, farm.region].filter(Boolean).join(', ')}
          {farm.area_ha ? ` · ${farm.area_ha} ha` : ''}
        </InfoLine>
        {farmCoords ? <InfoLine icon="navigate-outline">GPS : {farmCoords}</InfoLine> : null}
        {farm.description ? <InfoLine icon="information-circle-outline">{farm.description}</InfoLine> : null}
        {farm.manager_name ? <InfoLine icon="person-outline">Gérant : {farm.manager_name}</InfoLine> : null}
        {farm.manager_phone ? (
          <Row gap={space[2]} style={{ marginTop: space[2] }}>
            <Button label="Appeler" variant="secondary" icon="call-outline" compact style={{ flex: 1 }} onPress={() => callPhone(farm.manager_phone!)} />
            <Button label="WhatsApp" variant="whatsapp" icon="logo-whatsapp" compact style={{ flex: 1 }} onPress={() => openWhatsApp(farm.manager_phone!)} />
          </Row>
        ) : null}
      </Card>

      {error ? <Notice text={error} /> : null}
      <Button
        label={myDraft ? 'Reprendre la visite en cours' : 'Commencer une visite'}
        icon={myDraft ? 'create-outline' : 'add-circle-outline'}
        onPress={startVisit}
        loading={starting}
      />
      {!myDraft ? (
        <Body small muted style={{ textAlign: 'center' }}>
          Votre position est relevée au démarrage pour attester de la présence sur le terrain. La saisie fonctionne aussi sans réseau.
        </Body>
      ) : null}

      <SectionHeader title={`Alertes en cours (${openAlerts.length})`} />
      {openAlerts.length === 0 ? <Body small muted>Aucune alerte en cours.</Body> : null}
      {openAlerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          footer={
            <Button
              label="Marquer comme résolue"
              variant="secondary"
              compact
              icon="checkmark-done"
              loading={busyId === alert.id}
              onPress={() => run(alert.id, () => setAlertStatus(alert.id, 'resolved'))}
            />
          }
        />
      ))}

      <SectionHeader title={`Recommandations à suivre (${activeRecos.length})`} />
      {activeRecos.length === 0 ? <Body small muted>Aucune recommandation en cours.</Body> : null}
      {activeRecos.map((reco) => (
        <RecommendationCard
          key={reco.id}
          reco={reco}
          footer={
            reco.status === 'proposed' ? (
              <Body small muted>
                En attente de la décision du propriétaire.
              </Body>
            ) : (
              <Button
                label="Constater la réalisation"
                variant="secondary"
                compact
                icon="checkmark-circle-outline"
                loading={busyId === reco.id}
                onPress={() => run(reco.id, () => setRecommendationStatus(reco.id, 'done'))}
              />
            )
          }
        />
      ))}

      <SectionHeader title="Historique des visites" />
      {visits.length === 0 ? <Body small muted>Aucune visite pour l’instant.</Body> : null}
      {visits.map((visit) => (
        <Card
          key={visit.id}
          onPress={() =>
            visit.status === 'published'
              ? router.push({ pathname: '/report/[id]', params: { id: visit.id } })
              : visit.agent_id === profile?.id
                ? router.push({ pathname: '/visit/[id]', params: { id: visit.id } })
                : undefined
          }
        >
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Body small>{formatDate(visit.visited_at)}</Body>
            {visit.status === 'draft' ? (
              <Badge label="Brouillon" bg={colors.terracottaTint} fg={colors.terracottaDark} />
            ) : (
              <LevelBadge level={visit.overall_status} />
            )}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
