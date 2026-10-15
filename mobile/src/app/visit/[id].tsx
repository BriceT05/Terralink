import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { PhotoGrid } from '@/components/PhotoGrid';
import {
  Body,
  Button,
  Card,
  ChoiceGroup,
  Eyebrow,
  Heading,
  IconButton,
  InfoLine,
  LevelBadge,
  Loading,
  Notice,
  Row,
  Screen,
  SectionHeader,
  TextField,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { confirm, getCurrentCoords } from '@/lib/device';
import { errorMessage, formatCoords, formatDate, levelLabel, observationCategories, overallLabel } from '@/lib/format';
import * as local from '@/lib/offline';
import { loadVisitForEditing, publishVisit, syncNow } from '@/lib/sync';
import { colors, space } from '@/lib/theme';
import type { Level } from '@/lib/types';
import { useIsOffline, useOfflineState } from '@/providers/OfflineProvider';

const levels: Level[] = ['normal', 'attention', 'urgent'];
const levelOptions = levels.map((l) => ({ value: l, label: levelLabel[l] }));
const alertLevelOptions = (['attention', 'urgent'] as const).map((l) => ({ value: l, label: levelLabel[l] }));
const dueOptions = [
  { value: '7', label: 'Sous 7 jours' },
  { value: '15', label: 'Sous 15 jours' },
  { value: '30', label: 'Sous 30 jours' },
  { value: 'none', label: 'Sans échéance' },
];

// Les saisies sont enregistrées sur le téléphone puis envoyées en arrière-plan (voir lib/offline.ts).
export default function VisitEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useAsync(() => loadVisitForEditing(id), [id]);
  const offline = useOfflineState();
  const isOffline = useIsOffline();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Synthèse : tant qu'elle n'est pas modifiée, on affiche la version enregistrée.
  const [draft, setDraft] = useState<{ summary: string; overall: Level } | null>(null);
  const summaryDirty = draft !== null;

  const v = offline.visits[id];
  if (load.data?.status === 'published') return <Redirect href={{ pathname: '/report/[id]', params: { id } }} />;
  if (!v) {
    if (load.loading || !offline.ready) return <Loading />;
    return (
      <Screen edges={['bottom']}>
        <Notice text={load.error ?? 'Visite introuvable.'} onRetry={load.reload} />
      </Screen>
    );
  }

  const summary = draft?.summary ?? v.summary;
  const overall = draft?.overall ?? v.overall_status;
  const pending = offline.ops.filter((op) => op.visitId === id).length;

  // Modification locale immédiate, envoyée ensuite en arrière-plan.
  function act(action: () => void) {
    setError(null);
    try {
      action();
      syncNow();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }

  function saveSummary() {
    if (act(() => local.saveSummary(v.id, { summary: summary.trim(), overall_status: overall }))) setDraft(null);
  }

  async function addPhoto(source: 'camera' | 'library') {
    const permission =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === 'camera' ? 'Autorisez l’accès à l’appareil photo dans les réglages.' : 'Autorisez l’accès aux photos dans les réglages.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setBusy('photo');
    setError(null);
    try {
      await local.addPhoto(v.id, { uri: asset.uri, mimeType: asset.mimeType }, await getCurrentCoords());
      syncNow();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (summaryDirty) {
      setError('Enregistrez d’abord la synthèse modifiée.');
      return;
    }
    if (!v.summary.trim()) {
      setError('Rédigez et enregistrez une synthèse avant de publier.');
      return;
    }
    if (isOffline) {
      setError('La publication demande une connexion. Vos saisies restent enregistrées sur le téléphone.');
      return;
    }
    const ok = await confirm(
      'Publier le rapport ?',
      'Le propriétaire recevra ce rapport. Il ne pourra plus être modifié.',
      'Publier',
    );
    if (!ok) return;
    setBusy('publish');
    setError(null);
    try {
      await publishVisit(v.id);
      router.replace({ pathname: '/report/[id]', params: { id: v.id } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  async function discard() {
    const ok = await confirm('Supprimer ce brouillon ?', 'Les observations, photos, alertes et recommandations saisies seront supprimées.', 'Supprimer');
    if (!ok) return;
    local.discardVisit(v.id);
    syncNow();
    router.back();
  }

  async function dropFailed() {
    const ok = await confirm(
      'Abandonner cette modification ?',
      'Elle ne sera jamais envoyée. Les modifications suivantes reprendront leur envoi.',
      'Abandonner',
    );
    if (ok) {
      local.dropFailedOp();
      syncNow();
    }
  }

  const coords = formatCoords(v.latitude, v.longitude);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen edges={['bottom']}>
        <View style={{ gap: space[2] }}>
          <Eyebrow>Brouillon · {v.farm.name}</Eyebrow>
          <Heading>Visite du {formatDate(v.visited_at)}</Heading>
          {coords ? (
            <InfoLine icon="location-outline">Position relevée : {coords}</InfoLine>
          ) : (
            <InfoLine icon="warning-outline">Position non relevée au démarrage.</InfoLine>
          )}
        </View>

        <SyncStatus
          pending={pending}
          isOffline={isOffline}
          syncing={offline.syncing}
          syncError={offline.syncError}
          onRetry={() => syncNow()}
          onDrop={dropFailed}
        />
        {error ? <Notice text={error} /> : null}

        {/* 1. Synthèse */}
        <SectionHeader title="1. Synthèse" />
        <Card style={{ gap: space[4] }}>
          <ChoiceGroup
            label="État général de l’exploitation"
            value={overall}
            onChange={(value) => setDraft({ summary, overall: value })}
            options={levels.map((l) => ({ value: l, label: overallLabel[l] }))}
          />
          <TextField
            label="Synthèse pour le propriétaire"
            hint="Langage simple : ce qui a été vu, ce qui va bien, ce qui demande attention."
            value={summary}
            onChangeText={(text) => setDraft({ summary: text, overall })}
            multiline
          />
          <Button
            label={summaryDirty ? 'Enregistrer la synthèse' : 'Synthèse enregistrée'}
            variant="secondary"
            icon={summaryDirty ? 'save-outline' : 'checkmark'}
            disabled={!summaryDirty}
            onPress={saveSummary}
          />
        </Card>

        {/* 2. Observations */}
        <SectionHeader title={`2. Observations (${v.observations.length})`} />
        {v.observations.map((o) => (
          <Card key={o.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Eyebrow color={colors.green}>{o.category}</Eyebrow>
              <Row gap={space[1]}>
                <LevelBadge level={o.level} />
                <IconButton icon="trash-outline" label="Supprimer l’observation" color={colors.danger} onPress={() => act(() => local.removeObservation(v.id, o.id))} />
              </Row>
            </Row>
            <Body>{o.content}</Body>
          </Card>
        ))}
        <ObservationForm busy={false} onSubmit={async (c, content, level) => act(() => local.addObservation(v.id, c, content, level))} />

        {/* 3. Photos */}
        <SectionHeader title={`3. Photos (${v.photos.length})`} />
        <Body small muted>
          Chaque photo est datée et localisée automatiquement.
        </Body>
        {v.photos.length > 0 ? (
          <PhotoGrid
            photos={v.photos}
            onDelete={(photo) => {
              const target = v.photos.find((p) => p.id === photo.id);
              if (target) act(() => local.removePhoto(v.id, target));
            }}
          />
        ) : null}
        <Row gap={space[2]}>
          <Button label="Prendre une photo" variant="secondary" icon="camera-outline" compact style={{ flex: 1 }} loading={busy === 'photo'} onPress={() => addPhoto('camera')} />
          <Button label="Galerie" variant="secondary" icon="images-outline" compact style={{ flex: 1 }} disabled={busy === 'photo'} onPress={() => addPhoto('library')} />
        </Row>

        {/* 4. Alertes */}
        <SectionHeader title={`4. Alertes (${v.alerts.length})`} />
        {v.alerts.map((a) => (
          <Card key={a.id} style={{ borderLeftWidth: 4, borderLeftColor: a.level === 'urgent' ? colors.danger : colors.gold }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <LevelBadge level={a.level} />
              <IconButton icon="trash-outline" label="Supprimer l’alerte" color={colors.danger} onPress={() => act(() => local.removeAlert(v.id, a.id))} />
            </Row>
            <Heading level={4}>{a.title}</Heading>
            {a.description ? <Body small>{a.description}</Body> : null}
          </Card>
        ))}
        <AlertForm busy={false} onSubmit={async (title, description, level) => act(() => local.addAlert(v.id, { title, description, level }))} />

        {/* 5. Recommandations */}
        <SectionHeader title={`5. Recommandations (${v.recommendations.length})`} />
        {v.recommendations.map((r) => (
          <Card key={r.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <LevelBadge level={r.priority} />
              <IconButton icon="trash-outline" label="Supprimer la recommandation" color={colors.danger} onPress={() => act(() => local.removeRecommendation(v.id, r.id))} />
            </Row>
            <Heading level={4}>{r.title}</Heading>
            {r.details ? <Body small>{r.details}</Body> : null}
            {r.due_date ? <InfoLine icon="calendar-outline">Échéance : {formatDate(r.due_date)}</InfoLine> : null}
          </Card>
        ))}
        <RecommendationForm
          busy={false}
          onSubmit={async (title, details, priority, dueDate) =>
            act(() => local.addRecommendation(v.id, { title, details, priority, due_date: dueDate }))
          }
        />

        {/* Publication */}
        <Card style={{ gap: space[3], marginTop: space[5], backgroundColor: colors.greenTint, borderColor: colors.greenTint }}>
          <Row gap={space[2]}>
            <Ionicons name="send-outline" size={20} color={colors.green} />
            <Heading level={4}>Publier le rapport</Heading>
          </Row>
          <Body small>
            Une fois publié, le rapport est visible par le propriétaire et ne peut plus être modifié.
            {isOffline ? ' La publication sera possible au retour du réseau.' : ''}
          </Body>
          <Button label="Publier le rapport" onPress={publish} loading={busy === 'publish'} disabled={isOffline || (busy !== null && busy !== 'publish')} />
        </Card>
        <Button label="Supprimer le brouillon" variant="danger" icon="trash-outline" onPress={discard} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function SyncStatus({
  pending,
  isOffline,
  syncing,
  syncError,
  onRetry,
  onDrop,
}: {
  pending: number;
  isOffline: boolean;
  syncing: boolean;
  syncError: string | null;
  onRetry: () => void;
  onDrop: () => void;
}) {
  const count = pending === 1 ? '1 modification' : `${pending} modifications`;
  if (pending > 0 && syncError && !isOffline) {
    return (
      <Card style={{ gap: space[3], borderColor: colors.danger }}>
        <Notice text={`Envoi bloqué par le serveur : ${syncError}`} />
        <Row gap={space[2]}>
          <Button label="Réessayer" variant="secondary" compact style={{ flex: 1 }} onPress={onRetry} />
          <Button label="Abandonner" variant="danger" compact style={{ flex: 1 }} onPress={onDrop} />
        </Row>
      </Card>
    );
  }
  if (isOffline) {
    return (
      <Notice
        tone="info"
        text={`Hors connexion. Vos saisies sont enregistrées sur ce téléphone${pending > 0 ? ` (${count} en attente)` : ''} et partiront automatiquement au retour du réseau.`}
      />
    );
  }
  if (pending > 0) {
    return <Notice tone="info" text={syncing ? `Envoi de ${count}…` : `${count} en attente d’envoi.`} onRetry={syncing ? undefined : onRetry} />;
  }
  return (
    <Row gap={space[1]}>
      <Ionicons name="cloud-done-outline" size={18} color={colors.green} />
      <Body small muted>
        Toutes vos saisies sont envoyées.
      </Body>
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Formulaires d'ajout
// ---------------------------------------------------------------------------
function ObservationForm({ busy, onSubmit }: { busy: boolean; onSubmit: (category: string, content: string, level: Level) => Promise<boolean> }) {
  const [category, setCategory] = useState<string>(observationCategories[0]);
  const [level, setLevel] = useState<Level>('normal');
  const [content, setContent] = useState('');
  return (
    <Card style={{ gap: space[4], backgroundColor: colors.sand }}>
      <ChoiceGroup label="Catégorie" value={category} onChange={setCategory} options={observationCategories.map((c) => ({ value: c, label: c }))} />
      <ChoiceGroup label="Niveau" value={level} onChange={setLevel} options={levelOptions} />
      <TextField label="Observation" value={content} onChangeText={setContent} multiline placeholder="Ce que vous avez constaté, de façon factuelle." />
      <Button
        label="Ajouter l’observation"
        variant="secondary"
        icon="add"
        loading={busy}
        disabled={!content.trim()}
        onPress={async () => {
          if (await onSubmit(category, content.trim(), level)) {
            setContent('');
            setLevel('normal');
          }
        }}
      />
    </Card>
  );
}

function AlertForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (title: string, description: string, level: 'attention' | 'urgent') => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<'attention' | 'urgent'>('attention');
  if (!open) return <Button label="Signaler une anomalie" variant="ghost" icon="warning-outline" onPress={() => setOpen(true)} />;
  return (
    <Card style={{ gap: space[4], backgroundColor: colors.sand }}>
      <TextField label="Titre de l’alerte" value={title} onChangeText={setTitle} placeholder="Ex. : Fuite sur l’irrigation" />
      <ChoiceGroup label="Gravité" value={level} onChange={setLevel} options={alertLevelOptions} />
      <TextField label="Description" optional value={description} onChangeText={setDescription} multiline placeholder="Conséquences possibles, délai d’intervention…" />
      <Row gap={space[2]}>
        <Button label="Annuler" variant="ghost" compact style={{ flex: 1 }} onPress={() => setOpen(false)} />
        <Button
          label="Ajouter"
          variant="secondary"
          compact
          style={{ flex: 1 }}
          loading={busy}
          disabled={!title.trim()}
          onPress={async () => {
            if (await onSubmit(title.trim(), description.trim(), level)) {
              setTitle('');
              setDescription('');
              setOpen(false);
            }
          }}
        />
      </Row>
    </Card>
  );
}

function RecommendationForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (title: string, details: string, priority: Level, dueDate: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<Level>('attention');
  const [due, setDue] = useState('7');
  if (!open) return <Button label="Ajouter une recommandation" variant="ghost" icon="bulb-outline" onPress={() => setOpen(true)} />;
  return (
    <Card style={{ gap: space[4], backgroundColor: colors.sand }}>
      <TextField label="Action recommandée" value={title} onChangeText={setTitle} placeholder="Ex. : Remplacer le raccord défectueux" />
      <TextField label="Détails" optional value={details} onChangeText={setDetails} multiline placeholder="Pourquoi, comment, coût estimé…" />
      <ChoiceGroup label="Priorité" value={priority} onChange={setPriority} options={levelOptions} />
      <ChoiceGroup label="Échéance" value={due} onChange={setDue} options={dueOptions} />
      <Row gap={space[2]}>
        <Button label="Annuler" variant="ghost" compact style={{ flex: 1 }} onPress={() => setOpen(false)} />
        <Button
          label="Ajouter"
          variant="secondary"
          compact
          style={{ flex: 1 }}
          loading={busy}
          disabled={!title.trim()}
          onPress={async () => {
            const dueDate = due === 'none' ? null : new Date(Date.now() + Number(due) * 86_400_000).toISOString().slice(0, 10);
            if (await onSubmit(title.trim(), details.trim(), priority, dueDate)) {
              setTitle('');
              setDetails('');
              setOpen(false);
            }
          }}
        />
      </Row>
    </Card>
  );
}
