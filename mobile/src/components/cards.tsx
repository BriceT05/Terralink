import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';

import { daysAgo, formatDate, formatShortDate, overallLabel, recoStatusLabel } from '@/lib/format';
import { colors, fonts, radius, space, type } from '@/lib/theme';
import type { Alert, Farm, Recommendation, RecoStatus, VisitWithAgent } from '@/lib/types';

import { Badge, Body, Card, ChoiceGroup, Heading, LevelBadge, levelColor, Row } from './ui';

export function ReportCard({ report, onPress }: { report: VisitWithAgent; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Rapport du ${formatDate(report.visited_at)}`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[type.label, { color: colors.muted }]}>{formatDate(report.visited_at)}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Row>
      <LevelBadge level={report.overall_status} label={overallLabel[report.overall_status]} />
      <Body numberOfLines={3}>{report.summary || 'Aucune synthèse rédigée.'}</Body>
      {report.agent?.full_name ? (
        <Body small muted>
          Visite réalisée par {report.agent.full_name}
        </Body>
      ) : null}
    </Card>
  );
}

export function AlertCard({ alert, onPress, footer }: { alert: Alert; onPress?: () => void; footer?: React.ReactNode }) {
  const tone = levelColor(alert.level);
  const resolved = alert.status === 'resolved';
  return (
    <Card onPress={onPress} style={{ borderLeftWidth: 4, borderLeftColor: resolved ? colors.border : tone.fg }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }} gap={space[2]}>
        {resolved ? <Badge label="Résolue" bg={colors.greenTint} fg={colors.greenDark} icon="checkmark-done" /> : <LevelBadge level={alert.level} />}
        <Body small muted>
          {resolved && alert.resolved_at ? `Résolue le ${formatShortDate(alert.resolved_at)}` : `Signalée ${daysAgo(alert.created_at)}`}
        </Body>
      </Row>
      <Heading level={4}>{alert.title}</Heading>
      {alert.description ? <Body small>{alert.description}</Body> : null}
      {footer}
    </Card>
  );
}

const recoStatusTone: Record<RecoStatus, { bg: string; fg: string }> = {
  proposed: { bg: colors.terracottaTint, fg: colors.terracottaDark },
  accepted: { bg: colors.greenTint, fg: colors.greenDark },
  in_progress: { bg: colors.greenTint, fg: colors.greenDark },
  done: { bg: colors.green, fg: colors.white },
  declined: { bg: colors.sand2, fg: colors.muted },
};

export function RecoStatusBadge({ status }: { status: RecoStatus }) {
  const tone = recoStatusTone[status];
  return <Badge label={recoStatusLabel[status]} bg={tone.bg} fg={tone.fg} />;
}

export function RecommendationCard({ reco, onPress, footer }: { reco: Recommendation; onPress?: () => void; footer?: React.ReactNode }) {
  return (
    <Card onPress={onPress}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }} gap={space[2]}>
        <RecoStatusBadge status={reco.status} />
        {reco.due_date ? (
          <Body small muted>
            Échéance : {formatShortDate(reco.due_date)}
          </Body>
        ) : null}
      </Row>
      <Heading level={4}>{reco.title}</Heading>
      {reco.details ? (
        <Body small numberOfLines={onPress ? 3 : undefined}>
          {reco.details}
        </Body>
      ) : null}
      {reco.owner_comment ? (
        <View style={{ backgroundColor: colors.sand, borderRadius: radius.s, padding: space[3] }}>
          <Body small muted>
            Votre réponse : « {reco.owner_comment} »
          </Body>
        </View>
      ) : null}
      {footer}
    </Card>
  );
}

export function FarmSwitcher({ farms, selectedId, onSelect }: { farms: Farm[]; selectedId: string | undefined; onSelect: (id: string) => void }) {
  if (farms.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }} style={{ marginHorizontal: -20 }}>
      <View style={{ width: 12 }} />
      <ChoiceGroup label="" options={farms.map((f) => ({ value: f.id, label: f.name }))} value={selectedId ?? null} onChange={onSelect} />
      <View style={{ width: 12 }} />
    </ScrollView>
  );
}

export function StatTile({ value, label, onPress, highlight }: { value: number; label: string; onPress: () => void; highlight?: boolean }) {
  return (
    <Card onPress={onPress} style={{ flex: 1, alignItems: 'flex-start', gap: space[1], padding: space[3] }} accessibilityLabel={`${value} ${label}`}>
      <Text style={{ fontFamily: fonts.title, fontSize: 28, lineHeight: 32, color: highlight ? colors.terracottaDark : colors.green }}>{value}</Text>
      <Text style={[type.small, { fontSize: 13, lineHeight: 18, color: colors.muted }]}>{label}</Text>
    </Card>
  );
}
