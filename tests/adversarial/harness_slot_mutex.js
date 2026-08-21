/**
 * Harness 2: Per-Slot Mutex, Latest-Wins Coalescing & Soft Sync Locking
 * Tests:
 * 1. 100 rapid concurrent save calls to a single slot.
 * 2. Verification that intermediate saves are coalesced into a trailing-edge write (total physical writes = 2).
 * 3. Multi-slot independent mutex concurrency (slot_1 does not block slot_2).
 * 4. Client sequence number monotonicity (clientSeq) and out-of-order rejection.
 * 5. Soft Sync Lock: 10-slot cloud queue overflow does NOT block local IndexedDB saves, but passes ERROR_QUEUE_FULL to onSync.
 */

import { strict as assert } from 'node:assert';

class StorageEngine {
  constructor() {
    this.idbStore = new Map(); // Simulated IndexedDB
    this.slotMutexes = new Map(); // slot -> { activePromise, pendingWrite }
    this.cloudSyncQueue = []; // Max 10 items
    this.lastCommittedClientSeq = new Map(); // slot -> seq
    this.physicalWriteCount = 0; // Number of physical writes executed to IDB
    this.cloudSyncAttempts = 0;
  }

  // Simulated IndexedDB raw write with artificial I/O delay
  async _writeToIndexedDB(slot, record) {
    this.physicalWriteCount++;
    await new Promise(resolve => setTimeout(resolve, 20)); // 20ms I/O latency
    this.idbStore.set(slot, record);
    return record;
  }

  async save(slot, data, onSync) {
    if (!this.slotMutexes.has(slot)) {
      this.slotMutexes.set(slot, { activePromise: null, pendingWrite: null });
    }

    const mutex = this.slotMutexes.get(slot);

    // If an I/O operation is already active for this slot, coalesce this write
    if (mutex.activePromise) {
      return new Promise((resolve, reject) => {
        if (!mutex.pendingWrite) {
          mutex.pendingWrite = {
            data,
            onSync,
            resolvers: [{ resolve, reject }],
          };
        } else {
          // Update to latest-wins data and accumulate resolvers
          mutex.pendingWrite.data = data;
          mutex.pendingWrite.onSync = onSync;
          mutex.pendingWrite.resolvers.push({ resolve, reject });
        }
      });
    }

    // Otherwise, initiate active write
    return this._executeWrite(slot, data, onSync);
  }

  async _executeWrite(slot, data, onSync) {
    const mutex = this.slotMutexes.get(slot);

    const prevSeq = this.lastCommittedClientSeq.get(slot) || 0;
    const clientSeq = prevSeq + 1;
    this.lastCommittedClientSeq.set(slot, clientSeq);

    const record = {
      slot,
      payload: data,
      clientSeq,
      updatedAt: Date.now(),
      dirty: true,
    };

    mutex.activePromise = this._writeToIndexedDB(slot, record);

    try {
      const result = await mutex.activePromise;

      // Handle cloud sync queue (Soft Lock check)
      this._enqueueCloudSync(slot, result, onSync);

      return { success: true, slot, clientSeq: result.clientSeq, data: result.payload };
    } finally {
      mutex.activePromise = null;

      // Check if a trailing-edge coalesced write is waiting
      if (mutex.pendingWrite) {
        const next = mutex.pendingWrite;
        mutex.pendingWrite = null;
        // Schedule next coalesced write and resolve all accumulated caller promises
        this._executeWrite(slot, next.data, next.onSync)
          .then((res) => {
            for (const r of next.resolvers) r.resolve(res);
          })
          .catch((err) => {
            for (const r of next.resolvers) r.reject(err);
          });
      }
    }
  }

  _enqueueCloudSync(slot, record, onSync) {
    this.cloudSyncAttempts++;
    if (this.cloudSyncQueue.length >= 10) {
      // Soft Lock: Cloud queue is full (10 items), inform onSync without failing local save
      if (onSync) {
        onSync({
          code: 'ERROR_QUEUE_FULL',
          message: 'Cloud synchronization queue capacity (10) exceeded. Local save succeeded.',
          details: { queueType: 'STORAGE', maxCapacity: 10, currentSize: this.cloudSyncQueue.length, slot }
        });
      }
      return;
    }

    // Enqueue cloud sync task
    this.cloudSyncQueue.push({ slot, record });
    if (onSync) {
      // Simulate successful remote ACK
      setTimeout(() => onSync(null, { synced: true, slot, clientSeq: record.clientSeq }), 5);
    }
  }

  // Simulated Portal backend ingestion verifying clientSeq
  ingestPortalSave(slot, incomingClientSeq, payload) {
    const lastCommitted = this.lastCommittedClientSeq.get(slot) || 0;
    if (incomingClientSeq <= lastCommitted) {
      throw {
        code: 'ERROR_STALE_SEQUENCE',
        message: `Sequence ${incomingClientSeq} <= committed ${lastCommitted}`
      };
    }
    this.lastCommittedClientSeq.set(slot, incomingClientSeq);
    return { ack: true, slot, committedSeq: incomingClientSeq };
  }
}

export async function runSlotMutexTests() {
  console.log('=== Starting Harness 2: Per-Slot Mutex & Latest-Wins Coalescing ===');
  const metrics = {
    testsRun: 0,
    testsPassed: 0,
    coalescedSaves: 0,
    physicalWrites: 0,
    softLockRejections: 0,
  };

  // Test 1: 100 Rapid Concurrent Saves Coalescing Test
  {
    metrics.testsRun++;
    const engine = new StorageEngine();
    const saveCount = 100;

    // Dispatch 100 saves in parallel for 'slot_1'
    const promises = Array.from({ length: saveCount }, (_, i) =>
      engine.save('slot_1', { progress: i + 1 })
    );

    const results = await Promise.all(promises);

    // Final state in IDB must be the 100th save
    const finalStored = engine.idbStore.get('slot_1');
    assert.equal(finalStored.payload.progress, 100, 'Final persisted state must match the 100th write');

    // Physical writes should be exactly 2: the 1st write executed immediately,
    // and writes 2..100 coalesced into the 2nd write!
    assert.equal(engine.physicalWriteCount, 2, `Physical writes should be exactly 2, got ${engine.physicalWriteCount}`);

    metrics.coalescedSaves += (saveCount - engine.physicalWriteCount);
    metrics.physicalWrites += engine.physicalWriteCount;
    metrics.testsPassed++;
    console.log(`  [PASS] 100 Rapid Saves Coalesced: ${saveCount} requests -> ${engine.physicalWriteCount} physical I/O writes (Latest-Wins verified)`);
  }

  // Test 2: Multi-Slot Concurrency Isolation
  {
    metrics.testsRun++;
    const engine = new StorageEngine();

    // Start long save on slot_1 and fast save on slot_2
    const start = Date.now();
    const p1 = engine.save('slot_1', { slot1Data: 'A' });
    const p2 = engine.save('slot_2', { slot2Data: 'B' });

    const [res1, res2] = await Promise.all([p1, p2]);
    const duration = Date.now() - start;

    assert.equal(res1.data.slot1Data, 'A');
    assert.equal(res2.data.slot2Data, 'B');
    assert.equal(engine.idbStore.get('slot_1').payload.slot1Data, 'A');
    assert.equal(engine.idbStore.get('slot_2').payload.slot2Data, 'B');

    // Slots ran in parallel, so duration should be ~20-30ms, not 40ms+ sequential
    assert.ok(duration < 38, `Multi-slot writes must run concurrently (took ${duration}ms)`);
    metrics.testsPassed++;
    console.log(`  [PASS] Multi-Slot Concurrency Isolation (slot_1 & slot_2 processed independently in ${duration}ms)`);
  }

  // Test 3: Monotonic clientSeq Verification
  {
    metrics.testsRun++;
    const engine = new StorageEngine();
    await engine.save('slot_1', { step: 1 });
    const seq1 = engine.lastCommittedClientSeq.get('slot_1');
    assert.equal(seq1, 1);

    await engine.save('slot_1', { step: 2 });
    const seq2 = engine.lastCommittedClientSeq.get('slot_1');
    assert.equal(seq2, 2);

    // Stale sequence rejection by portal backend
    assert.throws(
      () => engine.ingestPortalSave('slot_1', 2, { step: 'stale' }),
      (err) => err.code === 'ERROR_STALE_SEQUENCE'
    );
    metrics.testsPassed++;
    console.log('  [PASS] Monotonic clientSeq and Stale Payload Rejection');
  }

  // Test 4: Soft Sync Lock vs Local IndexedDB Persistence
  {
    metrics.testsRun++;
    const engine = new StorageEngine();

    // Fill cloud queue to max 10
    const onSyncErrors = [];
    for (let i = 0; i < 15; i++) {
      await engine.save(`slot_${i}`, { data: i }, (err) => {
        if (err) onSyncErrors.push(err);
      });
    }

    // Local IndexedDB must have all 15 slots saved successfully!
    assert.equal(engine.idbStore.size, 15, 'All 15 slots MUST be persisted locally in IndexedDB');

    // First 10 slots fit in cloud queue; slots 11..15 trigger soft lock onSync ERROR_QUEUE_FULL
    assert.equal(onSyncErrors.length, 5, 'Exactly 5 excess cloud sync tasks should receive ERROR_QUEUE_FULL');
    for (const err of onSyncErrors) {
      assert.equal(err.code, 'ERROR_QUEUE_FULL');
      assert.equal(err.details.queueType, 'STORAGE');
      assert.equal(err.details.maxCapacity, 10);
    }

    metrics.softLockRejections += onSyncErrors.length;
    metrics.testsPassed++;
    console.log('  [PASS] Soft Sync Lock: Local saves succeed while 5 excess cloud tasks receive ERROR_QUEUE_FULL');
  }

  console.log(`=== Harness 2 Completed: ${metrics.testsPassed}/${metrics.testsRun} tests passed ===\n`);
  return metrics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSlotMutexTests().catch(err => {
    console.error('Harness 2 Failed:', err);
    process.exit(1);
  });
}
