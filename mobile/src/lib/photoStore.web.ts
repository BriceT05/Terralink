// Photos de visite gardées dans le navigateur jusqu'à leur envoi (IndexedDB).
// Même interface que photoStore.ts ; les adresses locales ont la forme « idb://<visitId>/<nom du fichier> ».
const DB_NAME = 'terralink';
const STORE = 'photos';
const PREFIX = 'idb://';

type StoredPhoto = { key: string; visitId: string; blob: Blob };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'key' });
      store.createIndex('visitId', 'visitId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const keyOf = (uri: string) => uri.slice(PREFIX.length);

// Adresses d'affichage (blob:) créées à la demande, valables le temps de la session.
const objectUrls = new Map<string, string>();

export async function savePhoto(visitId: string, fileName: string, sourceUri: string): Promise<string> {
  // L'image choisie dans le navigateur est une adresse data: ou blob: ; on en garde une copie.
  const blob = await (await fetch(sourceUri)).blob();
  const key = `${visitId}/${fileName}`;
  await run('readwrite', (store) => store.put({ key, visitId, blob } satisfies StoredPhoto));
  return PREFIX + key;
}

async function getBlob(uri: string): Promise<Blob | null> {
  const stored = await run<StoredPhoto | undefined>('readonly', (store) => store.get(keyOf(uri)));
  return stored?.blob ?? null;
}

export async function readPhoto(uri: string): Promise<ArrayBuffer> {
  const blob = await getBlob(uri);
  if (!blob) throw new Error('Photo introuvable dans ce navigateur.');
  return blob.arrayBuffer();
}

// La présence réelle est vérifiée au moment de l'affichage ou de l'envoi.
export function photoExists(uri: string): boolean {
  return uri.startsWith(PREFIX);
}

export async function displayUri(uri: string): Promise<string | null> {
  const cached = objectUrls.get(uri);
  if (cached) return cached;
  const blob = await getBlob(uri);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrls.set(uri, url);
  return url;
}

function forget(uri: string) {
  const url = objectUrls.get(uri);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(uri);
}

export function deletePhoto(uri: string) {
  forget(uri);
  run('readwrite', (store) => store.delete(keyOf(uri))).catch(() => {});
}

export function deleteVisitPhotos(visitId: string) {
  for (const uri of [...objectUrls.keys()]) if (keyOf(uri).startsWith(`${visitId}/`)) forget(uri);
  openDb()
    .then((db) => {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const request = store.index('visitId').openKeyCursor(IDBKeyRange.only(visitId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
    })
    .catch(() => {});
}

// Demande au navigateur de ne pas effacer ces données en cas de manque de place.
export async function requestPersistentStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Non pris en charge : les données restent, sans garantie.
  }
}
