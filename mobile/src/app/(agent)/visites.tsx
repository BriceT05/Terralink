import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Badge, Body, Card, EmptyState, Heading, LevelBadge, Loading, Notice, Row, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listAgentVisits } from '@/lib/api';
import { formatDate, overallLabel } from '@/lib/format';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function AgentVisitsScreen() {
  const { profile } = useAuth();
  const visits = useAsync(() => listAgentVisits(profile!.id), [profile?.id]);
  const drafts = visits.data?.filter((v) => v.status === 'draft') ?? [];
  const published = visits.data?.filter((v) => v.status === 'published') ?? [];

  return (
    <Screen refreshing={visits.refreshing} onRefresh={visits.refresh}>
      <Heading>Mes visites</Heading>

      {visits.error ? <Notice text={visits.error} onRetry={visits.reload} /> : null}
      {visits.loading ? <Loading /> : null}
      {visits.data?.length === 0 ? (
        <EmptyState icon="clipboard-outline" title="Aucune visite" text="Démarrez une visite depuis la fiche d’une exploitation." />
      ) : null}

      {drafts.length > 0 ? <SectionHeader title={`Brouillons à terminer (${drafts.length})`} /> : null}
      {drafts.map((visit) => (
        <Card key={visit.id} onPress={() => router.push({ pathname: '/visit/[id]', params: { id: visit.id } })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Badge label="Brouillon" bg={colors.terracottaTint} fg={colors.terracottaDark} icon="create-outline" />
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Row>
          <Heading level={4}>{visit.farm.name}</Heading>
          <Body small muted>
            Commencée le {formatDate(visit.visited_at, true)}
          </Body>
        </Card>
      ))}

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
