// Saisie hors connexion des agents de terrain.
//
// Une visite en brouillon ouverte sur le téléphone a une copie locale, qui fait foi pendant la saisie.
// Chaque modification met à jour cette copie et ajoute une opération à la file d'envoi (outbox).
// La file est rejouée vers Supabase dès que le réseau le permet (voir sync.ts). Les identifiants sont
// générés sur le téléphone, ce qui rend chaque opération rejouable sans créer de doublon.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { Coords } from './api';
import * as photoStore from './photoStore';
import type { Alert, Level, Observation, PhotoWithUrl, Recommendation, VisitReport } from './types';

export type LocalPhoto = PhotoWithUrl & { local?: { uri: string; mimeType: string } };
export type LocalVisit = Omit<VisitReport, 'photos'> & { photos: LocalPhoto[] };

type ChildTable = 'observations' | 'alerts' | 'recommendations';

type OpBase = { id: string; visitId: string };
export type Op = OpBase &
  (
    | { kind: 'createVisit'; row: { id: string; farm_id: string; agent_id: string; visited_at: string; latitude: number | null; longitude: number | null } }
    | { kind: 'updateVisit'; fields: { summary?: string; overall_status?: Level } }
    | { kind: 'insert'; table: ChildTable; row: Record<string, unknown> & { id: string } }
    | { kind: 'delete'; table: ChildTable; rowId: string }
    | { kind: 'uploadPhoto'; photo: { id: string; storage_path: string; latitude: number | null; longitude: number | null; taken_at: string }; local: { uri: string; mimeType: string } }
    | { kind: 'deletePhoto'; rowId: string; storagePath: string }
    | { kind: 'deleteVisit'; photoPaths: string[] }
  );

// Opération sans ses identifiants (Omit appliqué à chaque variante de l'union).
type OpInput = Op extends infer T ? (T extends Op ? Omit<T, 'id' | 'visitId'> : never) : never;

export type OfflineState = {
  userId: string | null;
  ready: boolean;
  visits: Record<string, LocalVisit>;
  ops: Op[];
  syncing: boolean;
  // Erreur du serveur sur la première opération de la file (le réseau, lui, n'est pas une erreur).
  syncError: string | null;
};

const emptyState: OfflineState = { userId: null, ready: false, visits: {}, ops: [], syncing: false, syncError: null };

let state: OfflineState = emptyState;
let readyPromise: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

const storageKey = (userId: string) => `terralink.offline.${userId}`;
const cacheKey = (userId: string, key: string) => `terralink.cache.${userId}.${key}`;
export const profileCacheKey = (userId: string) => `terralink.profile.${userId}`;

export function getOfflineState() {
  return state;
}

export function subscribeOffline(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(next: Partial<OfflineState>, persist = true) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  if (persist && state.userId) {
    AsyncStorage.setItem(storageKey(state.userId), JSON.stringify({ visits: state.visits, ops: state.ops })).catch(() => {});
  }
}

// Charge les données locales du compte connecté (chaque compte a les siennes).
export function loadOfflineStore(userId: string | null) {
  if (state.userId === userId) return readyPromise;
  state = { ...emptyState, userId };
  listeners.forEach((l) => l());
  if (!userId) return (readyPromise = Promise.resolve());
  readyPromise = AsyncStorage.getItem(storageKey(userId))
    .catch(() => null)
    .then((raw) => {
      if (state.userId !== userId) return;
      const saved = raw ? (JSON.parse(raw) as Pick<OfflineState, 'visits' | 'ops'>) : null;
      setState({ visits: saved?.visits ?? {}, ops: saved?.ops ?? [], ready: true }, false);
      photoStore.requestPersistentStorage();
      return refreshPhotoUrls(userId);
    });
  return readyPromise;
}

// À la déconnexion (appareil ou ordinateur partagé) : efface les données consultées et les brouillons
// déjà envoyés. Seules les saisies pas encore envoyées restent, pour partir à la prochaine connexion du compte.
export async function clearPrivateData(userId: string) {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const privateKeys = keys.filter((k) => k.startsWith(cacheKey(userId, '')) || k === profileCacheKey(userId));
  await AsyncStorage.multiRemove(privateKeys).catch(() => {});
  if (state.userId !== userId) return;
  const pending = new Set(state.ops.map((op) => op.visitId));
  for (const visitId of Object.keys(state.visits)) if (!pending.has(visitId)) photoStore.deleteVisitPhotos(visitId);
  setState({ visits: Object.fromEntries(Object.entries(state.visits).filter(([visitId]) => pending.has(visitId))) });
}

export function whenOfflineReady() {
  return readyPromise;
}

export function pendingOps(visitId: string) {
  return state.ops.filter((op) => op.visitId === visitId);
}

// ---------------------------------------------------------------------------
// Cache de lecture : dernière réponse connue, utilisée quand le réseau manque.
// ---------------------------------------------------------------------------
export function isNetworkError(error: unknown): boolean {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  return /network request failed|failed to fetch|network|timed? ?out|aborted/i.test(message);
}

export async function cachedQuery<T>(key: string, load: () => Promise<T>): Promise<{ value: T; fromCache: boolean }> {
  await readyPromise;
  const userId = state.userId;
  try {
    const value = await load();
    if (userId) AsyncStorage.setItem(cacheKey(userId, key), JSON.stringify(value)).catch(() => {});
    return { value, fromCache: false };
  } catch (e) {
    if (!userId || !isNetworkError(e)) throw e;
    const raw = await AsyncStorage.getItem(cacheKey(userId, key)).catch(() => null);
    if (!raw) throw e;
    return { value: JSON.parse(raw) as T, fromCache: true };
  }
}

// ---------------------------------------------------------------------------
// Copie locale des visites
// ---------------------------------------------------------------------------
// Enregistre la version serveur d'un brouillon, en gardant les photos déjà présentes sur l'appareil.
export function storeServerVisit(visit: VisitReport) {
  const previous = state.visits[visit.id];
  const photos: LocalPhoto[] = visit.photos.map((p) => {
    const kept = previous?.photos.find((lp) => lp.id === p.id);
    return kept?.local && photoStore.photoExists(kept.local.uri) ? { ...p, url: kept.url, local: kept.local } : p;
  });
  setState({ visits: { ...state.visits, [visit.id]: { ...visit, photos } } });
}

// Recalcule les adresses d'affichage des photos locales (sur le web, elles ne survivent pas à un rechargement).
async function refreshPhotoUrls(userId: string) {
  const entries = Object.values(state.visits).flatMap((v) => v.photos.filter((p) => p.local).map((p) => [v.id, p] as const));
  if (entries.length === 0) return;
  const urls = new Map(await Promise.all(entries.map(async ([, p]) => [p.id, await photoStore.displayUri(p.local!.uri)] as const)));
  if (state.userId !== userId) return;
  const visits = Object.fromEntries(
    Object.entries(state.visits).map(([id, v]) => [id, { ...v, photos: v.photos.map((p) => (urls.has(p.id) ? { ...p, url: urls.get(p.id) ?? null } : p)) }]),
  );
  setState({ visits }, false);
}

// Oublie la copie locale (après publication ou suppression) et ses photos.
export function forgetVisit(visitId: string) {
  if (!state.visits[visitId]) return;
  const visits = { ...state.visits };
  delete visits[visitId];
  setState({ visits, ops: state.ops.filter((op) => op.visitId !== visitId) });
  photoStore.deleteVisitPhotos(visitId);
}

function mutateVisit(visitId: string, update: (v: LocalVisit) => LocalVisit, op?: OpInput) {
  const visit = state.visits[visitId];
  if (!visit) throw new Error('Visite introuvable sur ce téléphone.');
  const ops = op ? enqueue(state.ops, { ...op, id: Crypto.randomUUID(), visitId } as Op) : state.ops;
  setState({ visits: { ...state.visits, [visitId]: update(visit) }, ops, syncError: null });
}

// Ajoute une opération en simplifiant la file : supprimer un élément pas encore envoyé annule son ajout.
function enqueue(ops: Op[], op: Op): Op[] {
  if (op.kind === 'delete' || op.kind === 'deletePhoto') {
    const pendingInsert = ops.find(
      (o) => (o.kind === 'insert' && o.row.id === op.rowId) || (o.kind === 'uploadPhoto' && o.photo.id === op.rowId),
    );
    if (pendingInsert) return ops.filter((o) => o !== pendingInsert);
  }
  if (op.kind === 'updateVisit') {
    const index = ops.findIndex((o) => o.kind === 'updateVisit' && o.visitId === op.visitId);
    if (index >= 0) {
      const merged = { ...ops[index], fields: { ...(ops[index] as typeof op).fields, ...op.fields } } as Op;
      return ops.map((o, i) => (i === index ? merged : o));
    }
  }
  return [...ops, op];
}

const now = () => new Date().toISOString();

export function createLocalVisit(params: { farm: { id: string; name: string }; agentId: string; agentName: string; coords: Coords }): string {
  const id = Crypto.randomUUID();
  const row = {
    id,
    farm_id: params.farm.id,
    agent_id: params.agentId,
    visited_at: now(),
    latitude: params.coords?.latitude ?? null,
    longitude: params.coords?.longitude ?? null,
  };
  const visit: LocalVisit = {
    ...row,
    overall_status: 'normal',
    summary: '',
    status: 'draft',
    published_at: null,
    created_at: row.visited_at,
    agent: { full_name: params.agentName },
    farm: params.farm,
    observations: [],
    photos: [],
    alerts: [],
    recommendations: [],
  };
  setState({ visits: { ...state.visits, [id]: visit }, ops: [...state.ops, { id: Crypto.randomUUID(), visitId: id, kind: 'createVisit', row }] });
  return id;
}

export function saveSummary(visitId: string, fields: { summary: string; overall_status: Level }) {
  mutateVisit(visitId, (v) => ({ ...v, ...fields }), { kind: 'updateVisit', fields });
}

export function addObservation(visitId: string, category: string, content: string, level: Level) {
  const row: Observation = { id: Crypto.randomUUID(), visit_id: visitId, category, content, level, created_at: now() };
  mutateVisit(visitId, (v) => ({ ...v, observations: [...v.observations, row] }), {
    kind: 'insert',
    table: 'observations',
    row: { id: row.id, visit_id: visitId, category, content, level },
  });
}

export function removeObservation(visitId: string, id: string) {
  mutateVisit(visitId, (v) => ({ ...v, observations: v.observations.filter((o) => o.id !== id) }), { kind: 'delete', table: 'observations', rowId: id });
}

export function addAlert(visitId: string, input: { title: string; description: string; level: Exclude<Level, 'normal'> }) {
  const visit = state.visits[visitId];
  const row: Alert = {
    id: Crypto.randomUUID(),
    farm_id: visit.farm_id,
    visit_id: visitId,
    ...input,
    status: 'open',
    created_by: visit.agent_id,
    created_at: now(),
    resolved_at: null,
  };
  mutateVisit(visitId, (v) => ({ ...v, alerts: [...v.alerts, row] }), {
    kind: 'insert',
    table: 'alerts',
    row: { id: row.id, farm_id: row.farm_id, visit_id: visitId, ...input },
  });
}

export function removeAlert(visitId: string, id: string) {
  mutateVisit(visitId, (v) => ({ ...v, alerts: v.alerts.filter((a) => a.id !== id) }), { kind: 'delete', table: 'alerts', rowId: id });
}

export function addRecommendation(visitId: string, input: { title: string; details: string; priority: Level; due_date: string | null }) {
  const visit = state.visits[visitId];
  const row: Recommendation = {
    id: Crypto.randomUUID(),
    farm_id: visit.farm_id,
    visit_id: visitId,
    ...input,
    status: 'proposed',
    owner_comment: null,
    created_by: visit.agent_id,
    created_at: now(),
    updated_at: now(),
  };
  mutateVisit(visitId, (v) => ({ ...v, recommendations: [...v.recommendations, row] }), {
    kind: 'insert',
    table: 'recommendations',
    row: { id: row.id, farm_id: row.farm_id, visit_id: visitId, ...input },
  });
}

export function removeRecommendation(visitId: string, id: string) {
  mutateVisit(visitId, (v) => ({ ...v, recommendations: v.recommendations.filter((r) => r.id !== id) }), {
    kind: 'delete',
    table: 'recommendations',
    rowId: id,
  });
}

// Garde une copie de la photo sur l'appareil (voir photoStore) jusqu'à son envoi.
export async function addPhoto(visitId: string, source: { uri: string; mimeType?: string | null }, coords: Coords) {
  const visit = state.visits[visitId];
  const mimeType = source.mimeType ?? 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const id = Crypto.randomUUID();

  const uri = await photoStore.savePhoto(visitId, `${id}.${extension}`, source.uri);
  const url = (await photoStore.displayUri(uri)) ?? uri;

  const local = { uri, mimeType };
  const photo = {
    id,
    storage_path: `${visit.farm_id}/${visitId}/${id}.${extension}`,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    taken_at: now(),
  };
  mutateVisit(
    visitId,
    (v) => ({ ...v, photos: [...v.photos, { ...photo, visit_id: visitId, caption: null, created_at: photo.taken_at, url, local }] }),
    { kind: 'uploadPhoto', photo, local },
  );
}

export function removePhoto(visitId: string, photo: LocalPhoto) {
  mutateVisit(visitId, (v) => ({ ...v, photos: v.photos.filter((p) => p.id !== photo.id) }), {
    kind: 'deletePhoto',
    rowId: photo.id,
    storagePath: photo.storage_path,
  });
  if (photo.local) photoStore.deletePhoto(photo.local.uri);
}

// Supprime le brouillon. S'il n'a jamais atteint le serveur, rien à envoyer.
export function discardVisit(visitId: string) {
  const visit = state.visits[visitId];
  const neverSent = state.ops.some((o) => o.visitId === visitId && o.kind === 'createVisit');
  const uploaded = visit?.photos.filter((p) => !state.ops.some((o) => o.kind === 'uploadPhoto' && o.photo.id === p.id)) ?? [];
  forgetVisit(visitId);
  if (!neverSent) {
    setState({
      ops: [...state.ops, { id: Crypto.randomUUID(), visitId, kind: 'deleteVisit', photoPaths: uploaded.map((p) => p.storage_path) }],
    });
  }
}

// ---------------------------------------------------------------------------
// Utilisé par la synchronisation
// ---------------------------------------------------------------------------
export function completeOp(opId: string) {
  setState({ ops: state.ops.filter((o) => o.id !== opId), syncError: null });
}

export function setSyncStatus(status: Partial<Pick<OfflineState, 'syncing' | 'syncError'>>) {
  setState(status, false);
}

// Abandonne l'opération refusée par le serveur pour débloquer la file.
export function dropFailedOp() {
  const [first] = state.ops;
  if (!first) return;
  // Sans la création de la visite, ses autres opérations échoueraient aussi.
  const ops = first.kind === 'createVisit' ? state.ops.filter((o) => o.visitId !== first.visitId) : state.ops.slice(1);
  setState({ ops, syncError: null });
}
