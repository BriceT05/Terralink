import { router } from 'expo-router';
import { useState } from 'react';

import { AlertCard, FarmSwitcher } from '@/components/cards';
import { Body, Button, ChoiceGroup, EmptyState, Heading, Loading, Notice, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listAlerts } from '@/lib/api';
import type { AlertStatus } from '@/lib/types';
import { useFarm } from '@/providers/FarmProvider';

export default function AlertsScreen() {
  const { farms, farm, selectFarm } = useFarm();
  const [filter, setFilter] = useState<AlertStatus>('open');
  const alerts = useAsync(() => (farm ? listAlerts(farm.id) : Promise.resolve([])), [farm?.id]);
  const visible = alerts.data?.filter((a) => a.status === filter) ?? [];
  const openCount = alerts.data?.filter((a) => a.status === 'open').length ?? 0;

  return (
    <Screen refreshing={alerts.refreshing} onRefresh={alerts.refresh}>
      <Heading>Alertes</Heading>
      <Body muted>Les anomalies constatées sur le terrain et les points nécessitant votre attention.</Body>
      <FarmSwitcher farms={farms} selectedId={farm?.id} onSelect={selectFarm} />

      <ChoiceGroup
        label="Afficher"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: `En cours (${openCount})` },
          { value: 'resolved', label: 'Résolues' },
        ]}
      />

      {alerts.error ? <Notice text={alerts.error} onRetry={alerts.reload} /> : null}
      {alerts.loading ? <Loading /> : null}
      {alerts.data && visible.length === 0 ? (
        <EmptyState
          icon={filter === 'open' ? 'shield-checkmark-outline' : 'archive-outline'}
          title={filter === 'open' ? 'Aucune alerte en cours' : 'Aucune alerte résolue'}
          text={filter === 'open' ? 'Rien d’anormal n’a été signalé sur votre exploitation.' : undefined}
        />
      ) : null}
      {visible.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          footer={
            alert.visit_id ? (
              <Button
                label="Voir le rapport associé"
                variant="ghost"
                compact
                onPress={() => router.push({ pathname: '/report/[id]', params: { id: alert.visit_id! } })}
              />
            ) : null
          }
        />
      ))}
    </Screen>
  );
}
