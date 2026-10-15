import * as Crypto from 'expo-crypto';

import { PHOTO_BUCKET, supabase } from './supabase';
import type {
  Alert,
  DiagnosticRequest,
  Farm,
  FarmType,
  Level,
  Observation,
  Photo,
  PhotoWithUrl,
  Profile,
  Recommendation,
  RecoStatus,
  Visit,
  VisitReport,
  VisitWithAgent,
} from './types';

const SIGNED_URL_TTL = 60 * 60;

function check<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------
export async function getProfile(userId: string): Promise<Profile> {
  return check(await supabase.from('profiles').select('*').eq('id', userId).single());
}

export async function updateProfile(
  userId: string,
  fields: Partial<Pick<Profile, 'full_name' | 'phone' | 'country' | 'city'>>,
): Promise<void> {
  check(await supabase.from('profiles').update(fields).eq('id', userId));
}

// ---------------------------------------------------------------------------
// Exploitations (filtrées par la RLS selon le rôle)
// ---------------------------------------------------------------------------
export async function listFarms(): Promise<Farm[]> {
  return check(await supabase.from('farms').select('*').order('name'));
}

export async function getFarm(id: string): Promise<Farm> {
  return check(await supabase.from('farms').select('*').eq('id', id).single());
}

export type FarmSummary = {
  lastReport: Visit | null;
  reportCount: number;
  openAlerts: Alert[];
  pendingRecommendations: Recommendation[];
};

export async function getFarmSummary(farmId: string): Promise<FarmSummary> {
  const [reports, alerts, recos] = await Promise.all([
    supabase
      .from('visits')
      .select('*', { count: 'exact' })
      .eq('farm_id', farmId)
      .eq('status', 'published')
      .order('visited_at', { ascending: false })
      .limit(1),
    supabase.from('alerts').select('*').eq('farm_id', farmId).eq('status', 'open').order('created_at', { ascending: false }),
    supabase
      .from('recommendations')
      .select('*')
      .eq('farm_id', farmId)
      .in('status', ['proposed', 'accepted', 'in_progress'])
      .order('created_at', { ascending: false }),
  ]);
  if (reports.error) throw reports.error;
  return {
    lastReport: (reports.data?.[0] as Visit | undefined) ?? null,
    reportCount: reports.count ?? 0,
    openAlerts: check(alerts) as Alert[],
    pendingRecommendations: check(recos) as Recommendation[],
  };
}

// ---------------------------------------------------------------------------
// Rapports (visites publiées)
// ---------------------------------------------------------------------------
const VISIT_WITH_AGENT = '*, agent:profiles!visits_agent_id_fkey(full_name)';

export async function listReports(farmId: string): Promise<VisitWithAgent[]> {
  return check(
    await supabase
      .from('visits')
      .select(VISIT_WITH_AGENT)
      .eq('farm_id', farmId)
      .eq('status', 'published')
      .order('visited_at', { ascending: false }),
  ) as VisitWithAgent[];
}

async function withSignedUrls(photos: Photo[]): Promise<PhotoWithUrl[]> {
  if (photos.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(photos.map((p) => p.storage_path), SIGNED_URL_TTL);
  if (error) throw error;
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return photos.map((p) => ({ ...p, url: urls.get(p.storage_path) ?? null }));
}

export async function getVisitReport(visitId: string): Promise<VisitReport> {
  const visit = check(
    await supabase
      .from('visits')
      .select(
        `${VISIT_WITH_AGENT}, farm:farms(id, name), observations(*), photos(*), alerts(*), recommendations(*)`,
      )
      .eq('id', visitId)
      .single(),
  ) as Omit<VisitReport, 'photos'> & { photos: Photo[] };

  const byDate = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at);
  return {
    ...visit,
    observations: [...visit.observations].sort(byDate),
    alerts: [...visit.alerts].sort(byDate),
    recommendations: [...visit.recommendations].sort(byDate),
    photos: await withSignedUrls([...visit.photos].sort(byDate)),
  };
}

// ---------------------------------------------------------------------------
// Alertes et recommandations
// ---------------------------------------------------------------------------
export async function listAlerts(farmId: string): Promise<Alert[]> {
  return check(
    await supabase.from('alerts').select('*').eq('farm_id', farmId).order('created_at', { ascending: false }),
  );
}

export async function listRecommendations(farmId: string): Promise<Recommendation[]> {
  return check(
    await supabase.from('recommendations').select('*').eq('farm_id', farmId).order('created_at', { ascending: false }),
  );
}

export async function getRecommendation(id: string): Promise<Recommendation> {
  return check(await supabase.from('recommendations').select('*').eq('id', id).single());
}

export async function respondToRecommendation(id: string, status: RecoStatus, comment?: string): Promise<void> {
  check(await supabase.rpc('respond_to_recommendation', { reco_id: id, new_status: status, comment: comment ?? null }));
}

// ---------------------------------------------------------------------------
// Agent : saisie des visites
// ---------------------------------------------------------------------------
export type Coords = { latitude: number; longitude: number } | null;

export async function listAgentVisits(agentId: string): Promise<(Visit & { farm: Pick<Farm, 'id' | 'name'> })[]> {
  return check(
    await supabase
      .from('visits')
      .select('*, farm:farms(id, name)')
      .eq('agent_id', agentId)
      .order('visited_at', { ascending: false }),
  ) as (Visit & { farm: Pick<Farm, 'id' | 'name'> })[];
}

export async function listFarmVisits(farmId: string): Promise<Visit[]> {
  return check(
    await supabase.from('visits').select('*').eq('farm_id', farmId).order('visited_at', { ascending: false }),
  );
}

export async function createVisit(farmId: string, agentId: string, coords: Coords): Promise<Visit> {
  return check(
    await supabase
      .from('visits')
      .insert({ farm_id: farmId, agent_id: agentId, latitude: coords?.latitude, longitude: coords?.longitude })
      .select()
      .single(),
  );
}

export async function updateVisit(
  id: string,
  fields: Partial<Pick<Visit, 'summary' | 'overall_status' | 'visited_at'>>,
): Promise<void> {
  check(await supabase.from('visits').update(fields).eq('id', id));
}

export async function publishVisit(id: string): Promise<void> {
  check(await supabase.from('visits').update({ status: 'published' }).eq('id', id));
}

export async function deleteVisit(visit: Pick<Visit, 'id' | 'farm_id'>, photoPaths: string[]): Promise<void> {
  if (photoPaths.length > 0) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(photoPaths);
    if (error) throw error;
  }
  check(await supabase.from('visits').delete().eq('id', visit.id));
}

export async function addObservation(visitId: string, category: string, content: string, level: Level): Promise<Observation> {
  return check(await supabase.from('observations').insert({ visit_id: visitId, category, content, level }).select().single());
}

export async function deleteObservation(id: string): Promise<void> {
  check(await supabase.from('observations').delete().eq('id', id));
}

export async function uploadPhoto(params: {
  farmId: string;
  visitId: string;
  uri: string;
  mimeType?: string | null;
  coords: Coords;
  caption?: string;
}): Promise<void> {
  const mimeType = params.mimeType ?? 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${params.farmId}/${params.visitId}/${Crypto.randomUUID()}.${extension}`;

  const body = await (await fetch(params.uri)).arrayBuffer();
  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, { contentType: mimeType });
  if (upload.error) throw upload.error;

  const insert = await supabase.from('photos').insert({
    visit_id: params.visitId,
    storage_path: path,
    caption: params.caption || null,
    latitude: params.coords?.latitude,
    longitude: params.coords?.longitude,
    taken_at: new Date().toISOString(),
  });
  if (insert.error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw insert.error;
  }
}

export async function deletePhoto(photo: Pick<Photo, 'id' | 'storage_path'>): Promise<void> {
  check(await supabase.from('photos').delete().eq('id', photo.id));
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
}

export async function addAlert(params: {
  farmId: string;
  visitId: string | null;
  title: string;
  description: string;
  level: Exclude<Level, 'normal'>;
}): Promise<void> {
  check(
    await supabase.from('alerts').insert({
      farm_id: params.farmId,
      visit_id: params.visitId,
      title: params.title,
      description: params.description,
      level: params.level,
    }),
  );
}

export async function setAlertStatus(id: string, status: Alert['status']): Promise<void> {
  check(await supabase.from('alerts').update({ status }).eq('id', id));
}

export async function deleteAlert(id: string): Promise<void> {
  check(await supabase.from('alerts').delete().eq('id', id));
}

export async function addRecommendation(params: {
  farmId: string;
  visitId: string | null;
  title: string;
  details: string;
  priority: Level;
  dueDate: string | null;
}): Promise<void> {
  check(
    await supabase.from('recommendations').insert({
      farm_id: params.farmId,
      visit_id: params.visitId,
      title: params.title,
      details: params.details,
      priority: params.priority,
      due_date: params.dueDate,
    }),
  );
}

export async function setRecommendationStatus(id: string, status: RecoStatus): Promise<void> {
  check(await supabase.from('recommendations').update({ status }).eq('id', id));
}

export async function deleteRecommendation(id: string): Promise<void> {
  check(await supabase.from('recommendations').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Demande de diagnostic
// ---------------------------------------------------------------------------
export type DiagnosticInput = {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  farm_location: string;
  farm_type: FarmType;
  need: string;
  message: string | null;
};

export async function createDiagnosticRequest(input: DiagnosticInput): Promise<void> {
  check(await supabase.from('diagnostic_requests').insert(input));
}

export async function listMyDiagnosticRequests(): Promise<DiagnosticRequest[]> {
  return check(await supabase.from('diagnostic_requests').select('*').order('created_at', { ascending: false }));
}
