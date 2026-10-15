import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Badge, Body, Card, EmptyState, Heading, LevelBadge, Loading, Notice, Row, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listAgentVisits } from '@/lib/api';
import { formatDate, overallLabel } from '@/lib/format';
import { cachedQuery } from '@/lib/offline';
import { colors, space } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useOfflineState } from '@/providers/OfflineProvider';

export default function AgentVisitsScreen() {
  const { profile } = useAuth();
  const offline = useOfflineState();
  const visits = useAsync(() => cachedQuery('agentVisits', () => listAgentVisits(profile!.id)), [profile?.id]);

  const server = visits.data?.value ?? [];
  const discarded = new Set(offline.ops.filter((op) => op.kind === 'deleteVisit').map((op) => op.visitId));
  // Brouillons du téléphone en premier : ils reflètent les saisies pas encore envoyées.
  const localDrafts = Object.values(offline.visits);
  const drafts = [...localDrafts, ...server.filter((v) => v.status === 'draft' && !offline.visits[v.id])].filter((v) => !discarded.has(v.id));
  const published = server.filter((v) => v.status === 'published');
  const pendingFor = (visitId: string) => offline.ops.filter((op) => op.visitId === visitId).length;

  return (
    <Screen refreshing={visits.refreshing} onRefresh={visits.refresh}>
      <Heading>Mes visites</Heading>

      {visits.data?.fromCache ? <Notice tone="info" text="Hors connexion : rapports publiés de votre dernière consultation." /> : null}
      {visits.error && drafts.length === 0 ? <Notice text={visits.error} onRetry={visits.reload} /> : null}
      {visits.loading ? <Loading /> : null}
      {visits.data && drafts.length === 0 && published.length === 0 ? (
        <EmptyState icon="clipboard-outline" title="Aucune visite" text="Démarrez une visite depuis la fiche d’une exploitation." />
      ) : null}

      {drafts.length > 0 ? <SectionHeader title={`Brouillons à terminer (${drafts.length})`} /> : null}
      {drafts.map((visit) => {
        const pending = pendingFor(visit.id);
        return (
          <Card key={visit.id} onPress={() => router.push({ pathname: '/visit/[id]', params: { id: visit.id } })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={space[2]} style={{ flexWrap: 'wrap', flex: 1 }}>
                <Badge label="Brouillon" bg={colors.terracottaTint} fg={colors.terracottaDark} icon="create-outline" />
                {pending > 0 ? <Badge label="En attente d’envoi" icon="cloud-upload-outline" /> : null}
              </Row>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Row>
            <Heading level={4}>{visit.farm.name}</Heading>
            <Body small muted>
              Commencée le {formatDate(visit.visited_at, true)}
            </Body>
          </Card>
        );
      })}

      {published.length > 0 ? <SectionHeader title="Rapports publiés" /> : null}
      {published.map((visit) => (
        <Card key={visit.id} onPress={() => router.push({ pathname: '/report/[id]', params: { id: visit.id } })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <LevelBadge level={visit.overall_status} label={overallLabel[visit.overall_status]} />
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Row>
          <Heading level={4}>{visit.farm.name}</Heading>
          <Body small muted>
            Visite du {formatDate(visit.visited_at)}
          </Body>
        </Card>
      ))}
    </Screen>
  );
}
