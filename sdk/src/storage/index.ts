import { sendRPCMessage, getState, setState, generateUUID } from "../index.js";
import { wasmAPI, setDefaultStorageProvider } from "./wasm.js";
import { calculateChecksum } from "./checksum.js";

export { calculateChecksum };

let db: IDBDatabase | null = null;
let currentGameId = "";
let currentPlayerId = "";
const reloadCallbacks: ((state: any) => void)[] = [];

// Mutex queues for storage operations per slot
const saveMutexes = new Map<string, Promise<any>>();

// Cache of local saves to avoid redundant DB reads
interface LocalSaveRecord {
  slot: string;
  payload: string;
  checksum: string;
  localRevision: number;
  lastSyncedRevision: number;
  dirty: boolean;
  updatedAt: number;
}

// Conflict resolution callbacks deferred until user chooses track
let conflictPromiseResolve: ((val: any) => void) | null = null;
let conflictPromiseReject: ((err: any) => void) | null = null;

// Opens IndexedDB partition (P-002 §3.1)
export function initStorage(gameId: string, playerId: string): Promise<void> {
  currentGameId = gameId;
  currentPlayerId = playerId;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`wgcp_storage_${gameId}`, 2);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const upgradeDb = request.result;
      
      // Partitions (P-002 §3.1)
      if (!upgradeDb.objectStoreNames.contains('game_saves')) {
        upgradeDb.createObjectStore('game_saves', { keyPath: 'slot' });
      }
      if (!upgradeDb.objectStoreNames.contains('stats_cache')) {
        upgradeDb.createObjectStore('stats_cache', { keyPath: 'statId' });
      }
      if (!upgradeDb.objectStoreNames.contains('stats_queue')) {
        upgradeDb.createObjectStore('stats_queue', { keyPath: 'statId' });
      }
    };
  });
}

// Local IndexedDB read/write wrappers
export function getLocalSave(slot: string): Promise<LocalSaveRecord | null> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));
    const transaction = db.transaction('game_saves', 'readonly');
    const store = transaction.objectStore('game_saves');
    const request = store.get(slot);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export function writeLocalSave(record: LocalSaveRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));
    const transaction = db.transaction('game_saves', 'readwrite');
    const store = transaction.objectStore('game_saves');
    const request = store.put(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function deleteLocalSave(slot: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));
    const transaction = db.transaction('game_saves', 'readwrite');
    const store = transaction.objectStore('game_saves');
    const request = store.delete(slot);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Queue for pending sync operations (limited to 10 slot updates)
const cloudSyncQueue = new Map<string, { correlationId: string; record: LocalSaveRecord; onSync?: (err?: any) => void }>();

// Process save ACK from portal wrapper (P-002 §2.4)
export async function handleSaveACK(correlationId: string, serverRevision: number) {
  for (const [slot, syncTask] of cloudSyncQueue.entries()) {
    if (syncTask.correlationId === correlationId) {
      cloudSyncQueue.delete(slot);
      try {
        const local = await getLocalSave(slot);
        if (local && local.localRevision === syncTask.record.localRevision) {
          local.dirty = false;
          local.lastSyncedRevision = serverRevision;
          await writeLocalSave(local);
        }
        if (syncTask.onSync) syncTask.onSync();
      } catch (err) {
        if (syncTask.onSync) syncTask.onSync(err);
      }
      break;
    }
  }
}

// Process user choice from the Conflict Modal (P-002 §2.3)
export async function handleConflictResolution(choice: 'CLOUD' | 'LOCAL', serverState: { payload: string; checksum: string; revision: number; updatedAt: number }) {
  if (!conflictPromiseResolve || !conflictPromiseReject) return;

  const resolve = conflictPromiseResolve;
  const reject = conflictPromiseReject;
  conflictPromiseResolve = null;
  conflictPromiseReject = null;

  try {
    if (choice === 'CLOUD') {
      // Overwrite local IndexedDB with cloud state (Section 2.3 State Invalidation Protocol)
      const record: LocalSaveRecord = {
        slot: 'gameState', // Default main slot
        payload: serverState.payload,
        checksum: serverState.checksum,
        localRevision: serverState.revision,
        lastSyncedRevision: serverState.revision,
        dirty: false,
        updatedAt: serverState.updatedAt
      };
      await writeLocalSave(record);

      // Abort all in-flight syncs
      for (const [slot, task] of cloudSyncQueue.entries()) {
        if (task.onSync) task.onSync({ code: "ERROR_SYNC_ABORTED", message: "User rejected local progress" });
      }
      cloudSyncQueue.clear();

      setState('READY_IDLE');
      
      // Fire live rehydration or force reload
      if (reloadCallbacks.length > 0) {
        let parsedPayload = serverState.payload;
        try { parsedPayload = JSON.parse(serverState.payload); } catch(e) {}
        reloadCallbacks.forEach(cb => cb(parsedPayload));
      } else {
        window.location.reload();
      }

      resolve(parsedPayloadJSON(serverState.payload));
    } else {
      // Keep local: Bump local revision and force remote save overrides
      const local = await getLocalSave('gameState');
      if (local) {
        local.localRevision = serverState.revision + 1;
        local.dirty = true;
        await writeLocalSave(local);

        setState('READY_IDLE');

        // Queue force upload to portal
        sendSaveToCloud('gameState', local, () => {});
      }
      resolve(local ? parsedPayloadJSON(local.payload) : null);
    }
  } catch (err) {
    reject(err);
  }
}

function parsedPayloadJSON(payload: string) {
  try {
    return JSON.parse(payload);
  } catch (e) {
    return payload;
  }
}

// Sends storage writes up to the portal parent
function sendSaveToCloud(slot: string, record: LocalSaveRecord, onSync?: (err?: any) => void) {
  if (cloudSyncQueue.size >= 10) {
    if (onSync) onSync({ code: "ERROR_QUEUE_FULL", message: "Cloud synchronization queue is full" });
    return;
  }

  // Generate correlation ID
  const correlationId = generateUUID();

  cloudSyncQueue.set(slot, { correlationId, record, onSync });

  window.parent.postMessage({
    id: correlationId,
    type: 'WGCP_SAVE',
    source: 'WGCP_SDK',
    version: '2.0.0',
    payload: {
      slot,
      payload: record.payload,
      checksum: record.checksum,
      revision: record.localRevision,
      updatedAt: record.updatedAt
    }
  }, '*'); // targetOrigin resolves securely in LauncherView wrapper
}

export const storageAPI = {
  // Main save API (P-002 §2.4 / P-002 §5.3)
  save: function(slot: string, data: any, onSync?: (err?: any) => void): Promise<void> {
    const state = getState();
    if (state === 'UNINITIALIZED') {
      return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
    }
    if (state === 'CONFLICT_RESOLVING') {
      return Promise.reject({ code: "ERROR_SYNC_PENDING_RESOLUTION", message: "Sync conflict resolving in portal" });
    }
    if (state === 'MIGRATING') {
      return Promise.reject({ code: "ERROR_MIGRATION_IN_PROGRESS", message: "Identity migration in progress" });
    }

    const payloadStr = typeof data === 'string' ? data : JSON.stringify(data);

    // FIFO Mutex wrapping per slot (P-002 §2.4)
    let currentSave = saveMutexes.get(slot) || Promise.resolve();

    const nextSave = currentSave.then(async () => {
      const checksum = await calculateChecksum(payloadStr);
      const now = Date.now();
      const local = await getLocalSave(slot);

      const localRevision = local ? local.localRevision + 1 : 1;
      const lastSyncedRevision = local ? local.lastSyncedRevision : 0;

      const record: LocalSaveRecord = {
        slot,
        payload: payloadStr,
        checksum,
        localRevision,
        lastSyncedRevision,
        dirty: true,
        updatedAt: now
      };

      // 1. Local IndexedDB write always resolves immediately (P-002 §2.4)
      await writeLocalSave(record);

      // 2. Trigger background sync to portal cloud
      sendSaveToCloud(slot, record, onSync);
    });

    saveMutexes.set(slot, nextSave);
    return nextSave;
  },

  // Main load API (P-002 §5.3)
  load: function(slot: string): Promise<any> {
    const state = getState();
    if (state === 'UNINITIALIZED') {
      return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
    }
    if (state === 'CONFLICT_RESOLVING') {
      return Promise.reject({ code: "ERROR_SYNC_PENDING_RESOLUTION", message: "Sync conflict resolving in portal" });
    }

    return getLocalSave(slot).then(async (record) => {
      if (record) {
        return parsedPayloadJSON(record.payload);
      }

      // On local cache miss (e.g. fresh private session or new device), fetch from cloud
      try {
        const cloudData: any = await sendRPCMessage('WGCP_LOAD', { slot });
        if (cloudData && cloudData.payload !== undefined && cloudData.payload !== null) {
          const cloudRecord: LocalSaveRecord = {
            slot,
            payload: typeof cloudData.payload === 'string' ? cloudData.payload : JSON.stringify(cloudData.payload),
            checksum: cloudData.checksum || '',
            localRevision: cloudData.revision || 1,
            lastSyncedRevision: cloudData.revision || 1,
            dirty: false,
            updatedAt: cloudData.updatedAt || Date.now()
          };
          await writeLocalSave(cloudRecord);
          return parsedPayloadJSON(cloudRecord.payload);
        }
      } catch (err) {
        console.warn(`Failed to fetch cloud save for slot '${slot}':`, err);
      }

      return null;
    });
  },

  // Main delete API
  delete: function(slot: string): Promise<void> {
    const state = getState();
    if (state === 'UNINITIALIZED') {
      return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
    }

    return deleteLocalSave(slot).then(() => {
      return sendRPCMessage('WGCP_DELETE', { slot });
    });
  },

  onStateReloaded: function(callback: (state: any) => void) {
    reloadCallbacks.push(callback);
  },

  // Core Startup synchronization revision matcher (P-002 §2.2)
  syncRevisions: function(cloudRevision: number, cloudState?: any): Promise<any> {
    return getLocalSave('gameState').then((local) => {
      // Case D: Both empty or perfectly in sync
      if (!local && !cloudState) {
        return Promise.resolve(null);
      }

      const localDirty = local ? local.dirty : false;
      const localRev = local ? local.localRevision : 0;
      const lastSyncedRev = local ? local.lastSyncedRevision : 0;

      // Case A: Clean local database, cloud is newer
      if (!localDirty && cloudRevision > lastSyncedRev) {
        if (!cloudState) return Promise.resolve(null);
        
        const record: LocalSaveRecord = {
          slot: 'gameState',
          payload: cloudState.payload,
          checksum: cloudState.checksum,
          localRevision: cloudRevision,
          lastSyncedRevision: cloudRevision,
          dirty: false,
          updatedAt: cloudState.updatedAt
        };
        return writeLocalSave(record).then(() => parsedPayloadJSON(cloudState.payload));
      }

      // Case B: Dirty local database, cloud revision matches last synced revision
      if (localDirty && cloudRevision === lastSyncedRev) {
        if (local) {
          sendSaveToCloud('gameState', local);
        }
        return Promise.resolve(local ? parsedPayloadJSON(local.payload) : null);
      }

      // Case C: Dirty local database AND Cloud has moved independently (CONFLICT GATING)
      if (localDirty && cloudRevision > lastSyncedRev) {
        setState('CONFLICT_RESOLVING');
        
        // Return a pending promise that blocks WGCP.init() resolution (P-002 §2.2)
        return new Promise((resolve, reject) => {
          conflictPromiseResolve = resolve;
          conflictPromiseReject = reject;
          
          // Request portal parent to open the Resolution overlay
          window.parent.postMessage({
            type: 'WGCP_CONFLICT_TRIGGER',
            source: 'WGCP_SDK',
            version: '2.0.0',
            payload: {
              localState: {
                revision: localRev,
                updatedAt: local.updatedAt
              },
              cloudState: {
                revision: cloudRevision,
                updatedAt: cloudState.updatedAt
              }
            }
          }, '*');
        });
      }

      // Case D (otherwise): Local is clean and matches cloud
      return Promise.resolve(local ? parsedPayloadJSON(local.payload) : null);
    });
  },

  wasm: wasmAPI
};

setDefaultStorageProvider(storageAPI);

export * from "./wasm.js";
