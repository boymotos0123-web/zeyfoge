// Salvamento automático em IndexedDB (suporta projetos grandes com modelos importados).
const DB = 'zeyforge', STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (e) { console.warn('autosave', e); }
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((res, rej) => { const tx = db.transaction(STORE, 'readonly'); const q = tx.objectStore(STORE).get(key); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); });
  } catch { return undefined; }
}

export function lsGet<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } }
export function lsSet(key: string, v: unknown): void { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ok */ } }
