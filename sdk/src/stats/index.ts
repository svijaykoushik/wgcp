import { sendRPCMessage, getState, generateUUID } from "../index.js";

interface StatOperation {
  op: 'DELTA' | 'SET';
  value: number;
}

// Active and In-flight queue buffers for stats (P-003 §3.6)
let activeBuffer = new Map<string, StatOperation>();
let inFlightBatch = new Map<string, StatOperation>();
let activeBatchId = "";

const syncedStatsCache = new Map<string, number>();

let gameId = "";
let flushTimeout: any = null;

// Opens and rehydrates stats queue cache from IndexedDB on startup (P-003 §3.6.3)
export function initStats(gid: string): Promise<void> {
  gameId = gid;
  return new Promise((resolve) => {
    // We can open the IndexedDB stores to retrieve cache and queue
    const request = indexedDB.open(`wgcp_storage_${gameId}`);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['stats_cache', 'stats_queue'], 'readonly');
      
      const cacheStore = transaction.objectStore('stats_cache');
      const queueStore = transaction.objectStore('stats_queue');
      
      cacheStore.getAll().onsuccess = (e: any) => {
        const results = e.target.result || [];
        results.forEach((r: any) => syncedStatsCache.set(r.statId, r.syncedValue));
      };

      queueStore.getAll().onsuccess = (e: any) => {
        const results = e.target.result || [];
        results.forEach((r: any) => activeBuffer.set(r.statId, { op: r.op, value: r.value }));
        resolve();
      };
    };
    request.onerror = () => {
      // Graceful fallback to in-memory only if DB fails
      resolve();
    };
  });
}

// Persists stats queue to IndexedDB with debouncing (P-003 §3.6.3)
let debounceTimeout: any = null;
function persistQueueToIndexedDB() {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    const request = indexedDB.open(`wgcp_storage_${gameId}`);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('stats_queue', 'readwrite');
      const store = transaction.objectStore('stats_queue');
      
      // Clear and rewrite current active buffer
      store.clear().onsuccess = () => {
        for (const [statId, op] of activeBuffer.entries()) {
          store.put({ statId, op: op.op, value: op.value, updatedAt: Date.now() });
        }
      };
    };
  }, 100);
}

// Coalescing logic matching P-003 §3.6.2 table
function coalesceStat(statId: string, op: 'DELTA' | 'SET', value: number) {
  const existing = activeBuffer.get(statId);
  if (!existing) {
    activeBuffer.set(statId, { op, value });
    return;
  }

  if (existing.op === 'DELTA') {
    if (op === 'DELTA') {
      existing.value += value;
    } else {
      existing.op = 'SET';
      existing.value = value;
    }
  } else { // SET
    if (op === 'DELTA') {
      existing.value += value;
    } else {
      existing.value = value;
    }
  }
}

// Flushes in-flight queue deltas to the console portal (P-003 §3.6.2)
function flushStatsQueue() {
  if (inFlightBatch.size > 0 || activeBuffer.size === 0) return;

  // Swap buffers (Double-Buffering)
  inFlightBatch = activeBuffer;
  activeBuffer = new Map<string, StatOperation>();
  persistQueueToIndexedDB();

  // Create unique idempotent batch ID
  activeBatchId = generateUUID();

  const operations: Record<string, StatOperation> = {};
  for (const [k, v] of inFlightBatch.entries()) {
    operations[k] = v;
  }

  window.parent.postMessage({
    id: activeBatchId,
    type: 'WGCP_STATS',
    source: 'WGCP_SDK',
    version: '2.0.0',
    payload: {
      batchId: activeBatchId,
      operations
    }
  }, '*');
}

// Triggered when stat postMessage is ACKed by parent portal
export function handleStatsACK(correlationId: string) {
  if (correlationId !== activeBatchId) return;

  // Sync cache records (P-003 §3.6.2)
  const request = indexedDB.open(`wgcp_storage_${gameId}`);
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction('stats_cache', 'readwrite');
    const store = transaction.objectStore('stats_cache');
    
    for (const [statId, op] of inFlightBatch.entries()) {
      let syncedVal = syncedStatsCache.get(statId) || 0;
      if (op.op === 'SET') {
        syncedVal = op.value;
      } else {
        syncedVal += op.value;
      }
      syncedStatsCache.set(statId, syncedVal);
      store.put({ statId, syncedValue: syncedVal, lastSyncedAt: Date.now() });
    }
  };

  inFlightBatch.clear();
  activeBatchId = "";

  // Schedule next queue flush if buffer has items
  if (activeBuffer.size > 0) {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimeout) return;
  // Flush debounce interval 1,500ms (P-003 §3.6.5)
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushStatsQueue();
  }, 1500);
}

// Register flush hooks on tab/page close
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flushStatsQueue();
  });
  window.addEventListener('pagehide', () => flushStatsQueue());
}

export const statsAPI = {
  getStat: function(statId: string): Promise<number> {
    if (getState() === 'UNINITIALIZED') {
      return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
    }

    const synced = syncedStatsCache.get(statId) || 0;
    
    // Coalesce Monotonic Read: value = synced + in-flight + active
    let delta = 0;
    let overrideVal: number | null = null;

    const inFlightOp = inFlightBatch.get(statId);
    if (inFlightOp) {
      if (inFlightOp.op === 'SET') {
        overrideVal = inFlightOp.value;
      } else {
        delta += inFlightOp.value;
      }
    }

    const activeOp = activeBuffer.get(statId);
    if (activeOp) {
      if (activeOp.op === 'SET') {
        overrideVal = activeOp.value;
      } else {
        delta += activeOp.value;
      }
    }

    if (overrideVal !== null) {
      return Promise.resolve(overrideVal + delta);
    }

    return Promise.resolve(synced + delta);
  },

  setStat: function(statId: string, value: number): Promise<void> {
    if (getState() === 'UNINITIALIZED') {
      return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
    }
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return Promise.reject({ code: "ERROR_INVALID_PARAMETER", message: "Stat value must be a finite number" });
    }

    coalesceStat(statId, 'SET', value);
    persistQueueToIndexedDB();
    scheduleFlush();
    return Promise.resolve();
  },

  incrementStat: function(statId: string, amount: number): Promise<number> {
    if (getState() === 'UNINITIALIZED') {
      return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
    }
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      return Promise.reject({ code: "ERROR_INVALID_PARAMETER", message: "Increment amount must be a finite number" });
    }

    coalesceStat(statId, 'DELTA', amount);
    persistQueueToIndexedDB();
    scheduleFlush();

    return this.getStat(statId);
  },

  getStats: function(): Promise<any[]> {
    if (getState() === 'UNINITIALIZED') {
      return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
    }

    // Return current cumulative stats list
    const keys = Array.from(new Set([
      ...syncedStatsCache.keys(),
      ...inFlightBatch.keys(),
      ...activeBuffer.keys()
    ]));

    const promises = keys.map(k => this.getStat(k).then(v => ({ statId: k, value: v })));
    return Promise.all(promises);
  },

  getPersonalBest: function(leaderboardId: string): Promise<any> {
    if (getState() === 'UNINITIALIZED') {
      return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
    }

    // Call portal bridge to query personal best
    return sendRPCMessage('WGCP_LEADERBOARD_PERSONAL_BEST', { leaderboardId });
  }
};
