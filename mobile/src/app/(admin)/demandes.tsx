import { router } from 'expo-router';
import { useState } from 'react';

import { RequestStatusBadge } from '@/components/cards';
import { Body, Card, ChoiceGroup, EmptyState, Heading, InfoLine, Loading, Notice, Row, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listDiagnosticRequests } from '@/lib/api';
import { farmTypeLabel, formatDate } from '@/lib/format';
import { space } from '@/lib/theme';

type Filter = 'open' | 'all';

export default function AdminRequestsScreen() {
  const requests = useAsync(listDiagnosticRequests, []);
  const [filter, setFilter] = useState<Filter>('open');

  const all = requests.data ?? [];
  const openCount = all.filter((r) => r.status === 'new' || r.status === 'contacted').length;
  const visible = filter === 'open' ? all.filter((r) => r.status === 'new' || r.status === 'contacted') : all;

  return (
    <Screen refreshing={requests.refreshing} onRefresh={requests.refresh}>
      <Heading>Demandes de diagnostic</Heading>
      <Body muted>Envoyées depuis l’app par les futurs clients.</Body>

      {requests.error ? <Notice text={requests.error} onRetry={requests.reload} /> : null}
      {requests.loading ? <Loading /> : null}

      {requests.data ? (
        <ChoiceGroup
          label=""
          options={[
            { value: 'open', label: `À traiter (${openCount})` },
            { value: 'all', label: `Toutes (${all.length})` },
          ]}
          value={filter}
          onChange={setFilter}
        />
      ) : null}

      {requests.data && visible.length === 0 ? (
        <EmptyState icon="mail-open-outline" title="Aucune demande" text={filter === 'open' ? 'Toutes les demandes ont été traitées.' : undefined} />
      ) : null}

      {visible.map((request) => (
        <Card
          key={request.id}
          onPress={() => router.push({ pathname: '/admin/request/[id]', params: { id: request.id } })}
          accessibilityLabel={`Demande de ${request.full_name}`}
        >
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }} gap={space[2]}>
            <RequestStatusBadge status={request.status} />
            <Body small muted>
              {formatDate(request.created_at)}
            </Body>
          </Row>
          <Heading level={4}>{request.full_name}</Heading>
          <InfoLine icon="location-outline">
            {request.farm_location} · {farmTypeLabel[request.farm_type]}
          </InfoLine>
          <Body small numberOfLines={2}>
            {request.need}
          </Body>
        </Card>
      ))}
    </Screen>
  );
}
