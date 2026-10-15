// Photos de visite gardées sur le téléphone jusqu'à leur envoi (version mobile : système de fichiers).
// La version web (photoStore.web.ts) utilise IndexedDB, expo-file-system n'existant pas dans le navigateur.
import { Directory, File, Paths } from 'expo-file-system';

function visitDir(visitId: string) {
  return new Directory(Paths.document, 'terralink-photos', visitId);
}

// Copie la photo choisie (le cache de l'appareil photo peut être vidé) et renvoie son adresse locale.
export async function savePhoto(visitId: string, fileName: string, sourceUri: string): Promise<string> {
  const dir = visitDir(visitId);
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, fileName);
  await new File(sourceUri).copy(file);
  return file.uri;
}

export function readPhoto(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}

export function photoExists(uri: string): boolean {
  return new File(uri).exists;
}

// Adresse affichable par <Image>. Sur mobile, l'adresse du fichier suffit.
export async function displayUri(uri: string): Promise<string | null> {
  return photoExists(uri) ? uri : null;
}

export function deletePhoto(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // Déjà supprimée.
  }
}

export function deleteVisitPhotos(visitId: string) {
  try {
    const dir = visitDir(visitId);
    if (dir.exists) dir.delete();
  } catch {
    // Fichiers déjà absents.
  }
}

// Le stockage de l'app n'est pas effacé par le système : rien à demander.
export async function requestPersistentStorage() {}
