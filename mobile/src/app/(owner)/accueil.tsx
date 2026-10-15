import { router } from 'expo-router';
import { View } from 'react-native';

import { AlertCard, FarmSwitcher, StatTile } from '@/components/cards';
import {
  Body,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Heading,
  InfoLine,
  LevelBadge,
  Loading,
  Logo,
  Notice,
  Row,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { getFarmSummary } from '@/lib/api';
import { openWhatsApp } from '@/lib/contact';
import { daysAgo, farmTypeLabel, formatDate, overallLabel } from '@/lib/format';
import { colors, radius, space, type } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useFarm } from '@/providers/FarmProvider';

export default function OwnerHome() {
  const { profile } = useAuth();
  const { farms, farm, loading: farmsLoading, error: farmsError, selectFarm, reload: reloadFarms } = useFarm();
  const summary = useAsync(() => (farm ? getFarmSummary(farm.id) : Promise.resolve(null)), [farm?.id]);

  const firstName = profile?.full_name.split(' ')[0];

  if (farmsLoading) return <Loading />;

  return (
    <Screen
      refreshing={summary.refreshing}
      onRefresh={() => {
        reloadFarms();
        summary.refresh();
      }}
    >
      <Logo size={32} />
      <Heading level={2}>{firstName ? `Bonjour ${firstName}` : 'Bonjour'}</Heading>

      {farmsError ? <Notice text={farmsError} onRetry={reloadFarms} /> : null}

      {!farmsError && farms.length === 0 ? (
        <Card style={{ padding: space[5] }}>
          <EmptyState
            icon="leaf-outline"
            title="Aucune exploitation suivie pour l’instant"
            text="Décrivez-nous votre exploitation : nous définirons ensemble les informations à recueillir et le rythme des visites."
            action={
              <View style={{ gap: space[3] }}>
                <Button label="Demander un diagnostic de mon exploitation" onPress={() => router.push('/diagnostic')} />
                <Button label="Écrire sur WhatsApp" variant="whatsapp" icon="logo-whatsapp" onPress={() => openWhatsApp()} />
              </View>
            }
          />
        </Card>
      ) : null}

      {farm ? (
        <>
          <FarmSwitcher farms={farms} selectedId={farm.id} onSelect={selectFarm} />

          <View style={{ backgroundColor: colors.greenDark, borderRadius: radius.m, padding: space[5], gap: space[2] }}>
            <Eyebrow color={colors.gold}>{farmTypeLabel[farm.type]}</Eyebrow>
            <Heading level={3} style={{ color: colors.white }}>
              {farm.name}
            </Heading>
            <Body small style={{ color: colors.greenTint }}>
              {[farm.locality, farm.region].filter(Boolean).join(', ')}
              {farm.area_ha ? ` · ${farm.area_ha} ha` : ''}
            </Body>
          </View>

          {summary.error ? <Notice text={summary.error} onRetry={summary.reload} /> : null}
          {summary.loading ? <Loading /> : null}

          {summary.data ? (
            <>
              <Card style={{ gap: space[3] }}>
                <Eyebrow>Dernier rapport</Eyebrow>
                {summary.data.lastReport ? (
                  <>
                    <LevelBadge level={summary.data.lastReport.overall_status} label={overallLabel[summary.data.lastReport.overall_status]} />
                    <Body numberOfLines={3}>{summary.data.lastReport.summary}</Body>
                    <InfoLine icon="calendar-outline">
                      Visite du {formatDate(summary.data.lastReport.visited_at)} ({daysAgo(summary.data.lastReport.visited_at)})
                    </InfoLine>
                    <Button
                      label="Lire le rapport"
                      variant="secondary"
                      onPress={() => router.push({ pathname: '/report/[id]', params: { id: summary.data!.lastReport!.id } })}
                    />
                  </>
                ) : (
                  <Body muted>Votre premier rapport apparaîtra ici après la première visite de terrain.</Body>
                )}
              </Card>

              <Row gap={space[3]} style={{ alignItems: 'stretch' }}>
                <StatTile
                  value={summary.data.openAlerts.length}
                  label="alertes ouvertes"
                  highlight={summary.data.openAlerts.length > 0}
                  onPress={() => router.push('/alertes')}
                />
                <StatTile
                  value={summary.data.pendingRecommendations.length}
                  label="actions à suivre"
                  onPress={() => router.push('/actions')}
                />
                <StatTile value={summary.data.reportCount} label="rapports reçus" onPress={() => router.push('/rapports')} />
              </Row>

              {summary.data.openAlerts.length > 0 ? (
                <>
                  <SectionHeader title="Points d’attention" />
                  {summary.data.openAlerts.slice(0, 2).map((alert) => (
                    <AlertCard key={alert.id} alert={alert} onPress={() => router.push('/alertes')} />
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <Card style={{ backgroundColor: colors.greenTint, borderColor: colors.greenTint, gap: space[3] }}>
        <Heading level={4}>Une question sur votre exploitation ?</Heading>
        <Body small>L’équipe TerraLink vous répond directement sur WhatsApp.</Body>
        <Button
          label="Écrire sur WhatsApp"
          variant="whatsapp"
          icon="logo-whatsapp"
          onPress={() => openWhatsApp(undefined, farm ? `Bonjour TerraLink, je vous écris au sujet de « ${farm.name} ».` : undefined)}
        />
      </Card>

      <Body small muted style={[type.small, { textAlign: 'center' }]}>
        TerraLink documente le terrain et vous recommande des actions. Les décisions restent les vôtres.
      </Body>
    </Screen>
  );
}
