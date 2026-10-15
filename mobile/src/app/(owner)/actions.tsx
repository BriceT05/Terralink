import { router } from 'expo-router';

import { FarmSwitcher, RecommendationCard } from '@/components/cards';
import { Body, EmptyState, Heading, Loading, Notice, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listRecommendations } from '@/lib/api';
import type { Recommendation, RecoStatus } from '@/lib/types';
import { useFarm } from '@/providers/FarmProvider';

const groups: { title: string; statuses: RecoStatus[] }[] = [
  { title: 'En attente de votre décision', statuses: ['proposed'] },
  { title: 'En cours', statuses: ['accepted', 'in_progress'] },
  { title: 'Terminées', statuses: ['done', 'declined'] },
];

export default function ActionsScreen() {
  const { farms, farm, selectFarm } = useFarm();
  const recos = useAsync(() => (farm ? listRecommendations(farm.id) : Promise.resolve([] as Recommendation[])), [farm?.id]);

  return (
    <Screen refreshing={recos.refreshing} onRefresh={recos.refresh}>
      <Heading>Actions recommandées</Heading>
      <Body muted>Acceptez ou refusez chaque recommandation, et suivez les actions convenues jusqu’à leur réalisation.</Body>
      <FarmSwitcher farms={farms} selectedId={farm?.id} onSelect={selectFarm} />

      {recos.error ? <Notice text={recos.error} onRetry={recos.reload} /> : null}
      {recos.loading ? <Loading /> : null}
      {recos.data?.length === 0 ? (
        <EmptyState icon="checkbox-outline" title="Aucune recommandation" text="Les recommandations issues des visites apparaîtront ici." />
      ) : null}

      {recos.data && recos.data.length > 0
        ? groups.map((group) => {
            const items = recos.data!.filter((r) => group.statuses.includes(r.status));
            if (items.length === 0) return null;
            return [
              <SectionHeader key={group.title} title={`${group.title} (${items.length})`} />,
              ...items.map((reco) => (
                <RecommendationCard
                  key={reco.id}
                  reco={reco}
                  onPress={() => router.push({ pathname: '/recommendation/[id]', params: { id: reco.id } })}
                />
              )),
            ];
          })
        : null}
    </Screen>
  );
}
