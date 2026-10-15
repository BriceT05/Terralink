import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';

import { Badge, Body, Button, Card, EmptyState, Eyebrow, Heading, InfoLine, Loading, Logo, Notice, Row, Screen, TextField } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listAssignments, listFarms, listUsers } from '@/lib/api';
import { farmTypeLabel } from '@/lib/format';
import { colors } from '@/lib/theme';

export default function AdminFarmsScreen() {
  const data = useAsync(async () => {
    const [farms, users, assignments] = await Promise.all([listFarms(), listUsers(), listAssignments()]);
    return { farms, users, assignments };
  }, []);
  const [search, setSearch] = useState('');

  const users = new Map(data.data?.users.map((u) => [u.id, u]));
  const query = search.trim().toLowerCase();
  const farms = (data.data?.farms ?? []).filter((farm) => {
    if (!query) return true;
    const owner = users.get(farm.owner_id);
    return [farm.name, farm.region, farm.locality, owner?.full_name, owner?.email].some((v) => v?.toLowerCase().includes(query));
  });

  return (
    <Screen refreshing={data.refreshing} onRefresh={data.refresh}>
      <Logo size={32} />
      <Heading>Exploitations</Heading>
      <Body muted>Toutes les exploitations suivies par TerraLink.</Body>

      <Button label="Nouvelle exploitation" icon="add-circle-outline" onPress={() => router.push('/admin/farm-form')} />

      {data.error ? <Notice text={data.error} onRetry={data.reload} /> : null}
      {data.loading ? <Loading /> : null}

      {data.data && data.data.farms.length > 0 ? (
        <TextField label="Rechercher" value={search} onChangeText={setSearch} placeholder="Nom, région, propriétaire…" autoCapitalize="none" />
      ) : null}

      {data.data?.farms.length === 0 ? (
        <EmptyState icon="leaf-outline" title="Aucune exploitation" text="Créez la première exploitation et rattachez-la à son propriétaire." />
      ) : null}
      {data.data && data.data.farms.length > 0 && farms.length === 0 ? <Body muted>Aucune exploitation ne correspond.</Body> : null}

      {farms.map((farm) => {
        const owner = users.get(farm.owner_id);
        const agentCount = data.data!.assignments.filter((a) => a.farm_id === farm.id).length;
        return (
          <Card key={farm.id} onPress={() => router.push({ pathname: '/admin/farm/[id]', params: { id: farm.id } })} accessibilityLabel={farm.name}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Eyebrow>{farmTypeLabel[farm.type]}</Eyebrow>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Row>
            <Heading level={4}>{farm.name}</Heading>
            <InfoLine icon="location-outline">{[farm.locality, farm.region].filter(Boolean).join(', ')}</InfoLine>
            <InfoLine icon="person-outline">Propriétaire : {owner?.full_name || owner?.email || '—'}</InfoLine>
            {agentCount === 0 ? (
              <Badge label="Aucun agent assigné" bg={colors.terracottaTint} fg={colors.terracottaDark} icon="alert-circle-outline" />
            ) : (
              <Badge label={agentCount === 1 ? '1 agent assigné' : `${agentCount} agents assignés`} bg={colors.greenTint} fg={colors.greenDark} />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
