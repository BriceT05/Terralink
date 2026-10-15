import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { RecommendationCard } from '@/components/cards';
import { Body, Button, Card, Heading, InfoLine, LevelBadge, Loading, Notice, Row, Screen, TextField } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { getRecommendation, respondToRecommendation } from '@/lib/api';
import { errorMessage, formatDate } from '@/lib/format';
import { space } from '@/lib/theme';
import type { RecoStatus } from '@/lib/types';

export default function RecommendationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reco = useAsync(() => getRecommendation(id), [id]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState<RecoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: RecoStatus) {
    setSaving(status);
    setError(null);
    try {
      await respondToRecommendation(id, status, comment);
      setComment('');
      await reco.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  if (reco.loading) return <Loading />;
  if (reco.error || !reco.data) return <Screen edges={['bottom']}><Notice text={reco.error ?? 'Introuvable'} onRetry={reco.reload} /></Screen>;

  const r = reco.data;
  // Statuts que le propriétaire peut choisir à partir du statut actuel.
  const actions: { status: RecoStatus; label: string; variant: 'primary' | 'secondary' | 'danger' }[] =
    r.status === 'proposed'
      ? [
          { status: 'accepted', label: 'Accepter', variant: 'primary' },
          { status: 'declined', label: 'Ne pas retenir', variant: 'danger' },
        ]
      : r.status === 'accepted' || r.status === 'in_progress'
        ? [
            { status: 'done', label: 'Marquer comme réalisée', variant: 'primary' },
            ...(r.status === 'accepted' ? [{ status: 'in_progress' as const, label: 'Marquer en cours', variant: 'secondary' as const }] : []),
          ]
        : [];

  return (
    <Screen edges={['bottom']}>
      <RecommendationCard reco={r} />
      <Card style={{ gap: space[2] }}>
        <Row gap={space[2]}>
          <Body small muted>
            Priorité
          </Body>
          <LevelBadge level={r.priority} />
        </Row>
        <InfoLine icon="calendar-outline">Proposée le {formatDate(r.created_at)}</InfoLine>
        {r.visit_id ? (
          <Button
            label="Voir le rapport de visite"
            variant="ghost"
            compact
            onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.visit_id! } })}
          />
        ) : null}
      </Card>

      {actions.length > 0 ? (
        <Card style={{ gap: space[4] }}>
          <Heading level={4}>Votre réponse</Heading>
          <Body small muted>
            Votre décision est transmise à l’équipe TerraLink, qui vérifiera la réalisation lors de la prochaine visite.
          </Body>
          <TextField label="Commentaire" optional value={comment} onChangeText={setComment} multiline placeholder="Ex. : d’accord, le gérant s’en occupe cette semaine." />
          {error ? <Notice text={error} /> : null}
          {actions.map((a) => (
            <Button key={a.status} label={a.label} variant={a.variant} loading={saving === a.status} disabled={saving !== null} onPress={() => respond(a.status)} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
