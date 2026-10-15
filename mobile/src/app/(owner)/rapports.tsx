import { router } from 'expo-router';

import { FarmSwitcher, ReportCard } from '@/components/cards';
import { Body, EmptyState, Heading, Loading, Notice, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listReports } from '@/lib/api';
import { useFarm } from '@/providers/FarmProvider';

export default function ReportsScreen() {
  const { farms, farm, selectFarm } = useFarm();
  const reports = useAsync(() => (farm ? listReports(farm.id) : Promise.resolve([])), [farm?.id]);

  return (
    <Screen refreshing={reports.refreshing} onRefresh={reports.refresh}>
      <Heading>Rapports de suivi</Heading>
      <Body muted>Chaque visite de terrain donne lieu à un rapport daté, avec photos localisées et recommandations.</Body>
      <FarmSwitcher farms={farms} selectedId={farm?.id} onSelect={selectFarm} />

      {reports.error ? <Notice text={reports.error} onRetry={reports.reload} /> : null}
      {reports.loading ? <Loading /> : null}
      {reports.data?.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Aucun rapport pour l’instant" text="Les rapports apparaissent ici dès qu’une visite est publiée." />
      ) : null}
      {reports.data?.map((report) => (
        <ReportCard key={report.id} report={report} onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })} />
      ))}
    </Screen>
  );
}
