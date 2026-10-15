// Rejoue la file d'envoi hors connexion vers Supabase, dans l'ordre, une opération à la fois.
// Une coupure réseau arrête l'envoi sans erreur : il reprendra au prochain déclenchement.
// Une erreur du serveur bloque la file et s'affiche à l'agent, qui peut réessayer ou abandonner l'opération.
import { File } from 'expo-file-system';

import { deleteVisit, getVisitReport } from './api';
import { errorMessage } from './format';
import {
  completeOp,
  forgetVisit,
  getOfflineState,
  isNetworkError,
  pendingOps,
  setSyncStatus,
  storeServerVisit,
  whenOfflineReady,
  type LocalVisit,
  type Op,
} from './offline';
import { PHOTO_BUCKET, supabase } from './supabase';
import type { VisitReport } from './types';

function check({ error }: { error: unknown }) {
  if (error) throw error;
}

async function run(op: Op) {
  switch (op.kind) {
    case 'createVisit':
      // ignoreDuplicates : une visite déjà créée lors d'un envoi interrompu n'est pas recréée.
      return check(await supabase.from('visits').upsert(op.row, { onConflict: 'id', ignoreDuplicates: true }));
    case 'updateVisit':
      return check(await supabase.from('visits').update(op.fields).eq('id', op.visitId));
    case 'insert':
      return check(await supabase.from(op.table).upsert(op.row, { onConflict: 'id', ignoreDuplicates: true }));
    case 'delete':
      return check(await supabase.from(op.table).delete().eq('id', op.rowId));
    case 'uploadPhoto': {
      const body = await new File(op.local.uri).arrayBuffer();
      const upload = await supabase.storage.from(PHOTO_BUCKET).upload(op.photo.storage_path, body, { contentType: op.local.mimeType });
      // Fichier déjà déposé lors d'un envoi interrompu : on passe à l'enregistrement.
      if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error;
      return check(
        await supabase
          .from('photos')
          .upsert({ ...op.photo, visit_id: op.visitId }, { onConflict: 'id', ignoreDuplicates: true }),
      );
    }
    case 'deletePhoto':
      check(await supabase.from('photos').delete().eq('id', op.rowId));
      await supabase.storage.from(PHOTO_BUCKET).remove([op.storagePath]);
      return;
    case 'deleteVisit':
      return deleteVisit({ id: op.visitId }, op.photoPaths);
  }
}

let running: Promise<void> | null = null;
let again = false;

// Lance l'envoi ; si un envoi est déjà en cours, il sera relancé à la fin pour prendre les nouvelles opérations.
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    await whenOfflineReady();
    do {
      again = false;
      await drain();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

// Coupure réseau, ou session expirée pendant la coupure et pas encore renouvelée : on réessaiera plus tard.
function isTransient(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
  return isNetworkError(error) || /jwt expired|invalid jwt/i.test(message);
}

async function drain() {
  if (getOfflineState().ops.length === 0) return;
  setSyncStatus({ syncing: true });
  try {
    // Renouvelle la session si elle a expiré pendant la coupure.
    await supabase.auth.getSession();
    for (let op = getOfflineState().ops[0]; op; op = getOfflineState().ops[0]) {
      try {
        await run(op);
      } catch (e) {
        if (isTransient(e)) {
          setSyncStatus({ syncError: null });
        } else {
          setSyncStatus({ syncError: errorMessage(e) });
        }
        return;
      }
      completeOp(op.id);
    }
  } finally {
    setSyncStatus({ syncing: false });
  }
}

// Brouillon à ouvrir dans l'éditeur : la copie locale tant qu'elle a des modifications non envoyées,
// sinon la version du serveur (qui rafraîchit aussi les liens des photos).
export async function loadVisitForEditing(visitId: string): Promise<LocalVisit | VisitReport> {
  await whenOfflineReady();
  const local = getOfflineState().visits[visitId];
  if (local && pendingOps(visitId).length > 0) return local;
  try {
    const server = await getVisitReport(visitId);
    // Saisie faite pendant le chargement : la copie locale reste la référence.
    const current = getOfflineState().visits[visitId];
    if (current && pendingOps(visitId).length > 0) return current;
    if (server.status === 'published') forgetVisit(visitId);
    else storeServerVisit(server);
    return server;
  } catch (e) {
    if (local && isNetworkError(e)) return local;
    throw e;
  }
}

// Publication : uniquement en ligne, une fois toutes les saisies de la visite envoyées.
export async function publishVisit(visitId: string) {
  await syncNow();
  if (pendingOps(visitId).length > 0) {
    const { syncError } = getOfflineState();
    throw new Error(syncError ?? 'Connexion nécessaire pour publier. Vos saisies sont enregistrées sur le téléphone : réessayez une fois le réseau revenu.');
  }
  check(await supabase.from('visits').update({ status: 'published' }).eq('id', visitId));
  forgetVisit(visitId);
}
