import type { WorkspaceState } from './types';

const DB_NAME = 'va-taxemotor';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const WORKSPACE_KEY = 'workspace';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadWorkspaceState(): Promise<WorkspaceState | null> {
  const db = await openDatabase();

  try {
    return await new Promise<WorkspaceState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(WORKSPACE_KEY);

      request.onsuccess = () => resolve((request.result as WorkspaceState | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveWorkspaceState(state: WorkspaceState): Promise<void> {
  const db = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(state, WORKSPACE_KEY);

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
