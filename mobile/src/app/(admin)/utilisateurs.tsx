import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RoleBadge } from '@/components/cards';
import { Body, Card, ChoiceGroup, Heading, Loading, Notice, Row, Screen, TextField } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { listUsers } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { colors, space } from '@/lib/theme';
import type { UserRole } from '@/lib/types';

type Filter = 'all' | UserRole;

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'owner', label: 'Propriétaires' },
  { value: 'agent', label: 'Agents' },
  { value: 'admin', label: 'Équipe' },
];

export default function AdminUsersScreen() {
  const users = useAsync(listUsers, []);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const visible = (users.data ?? []).filter(
    (u) =>
      (filter === 'all' || u.role === filter) &&
      (!query || [u.full_name, u.email, u.phone].some((v) => v?.toLowerCase().includes(query))),
  );

  return (
    <Screen refreshing={users.refreshing} onRefresh={users.refresh}>
      <Heading>Comptes</Heading>
      <Body muted>Chaque inscription crée un compte propriétaire. Ouvrez un compte pour en faire un agent de terrain.</Body>

      {users.error ? <Notice text={users.error} onRetry={users.reload} /> : null}
      {users.loading ? <Loading /> : null}

      {users.data ? (
        <>
          <TextField label="Rechercher" value={search} onChangeText={setSearch} placeholder="Nom, e-mail, téléphone…" autoCapitalize="none" />
          <ChoiceGroup label="" options={filters} value={filter} onChange={setFilter} />
          {visible.length === 0 ? <Body muted>Aucun compte ne correspond.</Body> : null}
        </>
      ) : null}

      {visible.map((user) => (
        <Card
          key={user.id}
          onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: user.id } })}
          accessibilityLabel={user.full_name || user.email}
        >
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: space[1] }}>
              <Heading level={4}>{user.full_name || 'Sans nom'}</Heading>
              <Body small muted>
                {user.email}
              </Body>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Row>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }} gap={space[2]}>
            <RoleBadge role={user.role} />
            <Body small muted>
              Inscrit le {formatDate(user.created_at)}
            </Body>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
