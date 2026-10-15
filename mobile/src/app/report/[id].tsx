import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AlertCard, RecommendationCard } from '@/components/cards';
import { PhotoGrid } from '@/components/PhotoGrid';
import { Body, Card, Eyebrow, Heading, InfoLine, LevelBadge, Loading, Notice, Row, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { getVisitReport } from '@/lib/api';
import { formatCoords, formatDate, overallLabel } from '@/lib/format';
import { colors, space } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const report = useAsync(() => getVisitReport(id), [id]);

  if (report.loading) return <Loading />;
  if (report.error || !report.data) {
    return (
      <Screen edges={['bottom']}>
        <Notice text={report.error ?? 'Rapport introuvable.'} onRetry={report.reload} />
      </Screen>
    );
  }

  const r = report.data;
  const isOwner = profile?.role === 'owner';
  const coords = formatCoords(r.latitude, r.longitude);

  return (
    <Screen edges={['bottom']} refreshing={report.refreshing} onRefresh={report.refresh}>
      <Stack.Screen options={{ title: formatDate(r.visited_at) }} />

      <View style={{ gap: space[2] }}>
        <Eyebrow>{r.farm.name}</Eyebrow>
        <Heading level={2}>Rapport de visite</Heading>
        <LevelBadge level={r.overall_status} label={overallLabel[r.overall_status]} />
      </View>

      <Card style={{ gap: space[2] }}>
        <InfoLine icon="calendar-outline">Visite du {formatDate(r.visited_at, true)}</InfoLine>
        {r.agent?.full_name ? <InfoLine icon="person-outline">Réalisée par {r.agent.full_name}</InfoLine> : null}
        {coords ? <InfoLine icon="location-outline">Position relevée sur place : {coords}</InfoLine> : null}
        {r.published_at ? <InfoLine icon="send-outline">Publié le {formatDate(r.published_at, true)}</InfoLine> : null}
      </Card>

      <SectionHeader title="Synthèse" />
      <Card>
        <Body>{r.summary || 'Aucune synthèse rédigée.'}</Body>
      </Card>

      {r.observations.length > 0 ? (
        <>
          <SectionHeader title={`Observations (${r.observations.length})`} />
          <Card style={{ gap: space[4] }}>
            {r.observations.map((o, index) => (
              <View
                key={o.id}
                style={{ gap: space[1], paddingTop: index > 0 ? space[4] : 0, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.sand2 }}
              >
                <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }} gap={space[2]}>
                  <Eyebrow color={colors.green}>{o.category}</Eyebrow>
                  <LevelBadge level={o.level} />
                </Row>
                <Body>{o.content}</Body>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {r.photos.length > 0 ? (
        <>
          <SectionHeader title={`Photos (${r.photos.length})`} />
          <Body small muted>
            Touchez une photo pour voir sa date et sa position GPS.
          </Body>
          <PhotoGrid photos={r.photos} />
        </>
      ) : null}

      {r.alerts.length > 0 ? (
        <>
          <SectionHeader title="Alertes signalées" />
          {r.alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </>
      ) : null}

      {r.recommendations.length > 0 ? (
        <>
          <SectionHeader title="Recommandations" />
          {r.recommendations.map((reco) => (
            <RecommendationCard
              key={reco.id}
              reco={reco}
              onPress={isOwner ? () => router.push({ pathname: '/recommendation/[id]', params: { id: reco.id } }) : undefined}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
