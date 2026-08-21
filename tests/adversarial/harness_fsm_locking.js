/**
 * Harness 1: FSM State Transitions & Storage Locking under Conflict & Migration
 * Tests:
 * 1. Boot handshake evaluation (Cases A, B, C, D)
 * 2. Hard Storage Lock during CONFLICT_RESOLVING and MIGRATING
 * 3. 500 concurrent async save/load/delete calls during CONFLICT_RESOLVING
 * 4. Deterministic rejection with ERROR_SYNC_PENDING_RESOLUTION
 * 5. State Invalidation Protocol on Cloud selection (dirty=false, lastSyncedRevision=CloudRev, aborting in-flight syncs with ERROR_SYNC_ABORTED, onStateReloaded invocation)
 * 6. Dynamic conflict NACK handling in READY_IDLE -> CONFLICT_RESOLVING
 */

import { strict as assert } from 'node:assert';

// Simulated SDK FSM Implementation based on P-002 and P-003 specifications
class SDKFSM {
  constructor(options = {}) {
    this.state = 'UNINITIALIZED';
    this.localCache = options.localCache || {
      slot: 'slot_1',
      data: null,
      localRevision: 0,
      lastSyncedRevision: 0,
      dirty: false,
    };
    this.cloudState = options.cloudState || {
      slot: 'slot_1',
      data: null,
      revision: 0,
    };
    this.playerId = options.playerId || 'guest_123';
    this.isGuest = options.isGuest ?? true;
    this.pendingSyncPromises = [];
    this.onStateReloadedHandler = null;
    this.reloadTriggered = false;
    this.initPromise = null;
    this.initResolve = null;
    this.initReject = null;
  }

  init() {
    if (this.state !== 'UNINITIALIZED') {
      throw new Error('Already initialized or initializing');
    }
    this.state = 'HANDSHAKING';

    this.initPromise = new Promise((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
    });

    // Simulate portal responding with cloud metadata
    this._evaluateRevisions();
    return this.initPromise;
  }

  _evaluateRevisions() {
    const { dirty, lastSyncedRevision } = this.localCache;
    const cloudRev = this.cloudState.revision;

    if (!dirty && cloudRev > lastSyncedRevision) {
      // Case A: Cloud Newer, Clean
      this.localCache.data = this.cloudState.data;
      this.localCache.localRevision = cloudRev;
      this.localCache.lastSyncedRevision = cloudRev;
      this.localCache.dirty = false;
      this.state = 'READY_IDLE';
      this.initResolve({ source: 'CLOUD', data: this.localCache.data });
    } else if (dirty && cloudRev === lastSyncedRevision) {
      // Case B: Local Dirty, Cloud Same
      this.state = 'READY_IDLE';
      this.initResolve({ source: 'LOCAL', data: this.localCache.data });
    } else if (dirty && cloudRev > lastSyncedRevision) {
      // Case C: Genuine Conflict - FREEZE BOOT! Do NOT resolve init()
      this.state = 'CONFLICT_RESOLVING';
      // Handshake is frozen waiting for user choice
    } else if (!dirty && cloudRev === lastSyncedRevision) {
      // Case D: In-Sync
      this.state = 'READY_IDLE';
      this.initResolve({ source: 'LOCAL', data: this.localCache.data });
    } else {
      // Fallback
      this.state = 'READY_IDLE';
      this.initResolve({ source: 'LOCAL', data: this.localCache.data });
    }
  }

  resolveConflict(userChoice) {
    if (this.state !== 'CONFLICT_RESOLVING') {
      throw new Error(`Cannot resolve conflict when state is ${this.state}`);
    }

    if (userChoice === 'LOCAL') {
      this.localCache.localRevision++;
      this.localCache.dirty = true;
      this.state = 'READY_IDLE';
      if (this.initResolve) {
        this.initResolve({ source: 'LOCAL', data: this.localCache.data });
        this.initResolve = null;
      }
    } else if (userChoice === 'CLOUD') {
      // Overwrite local cache with cloud state
      this.localCache.data = this.cloudState.data;
      this.localCache.localRevision = this.cloudState.revision;
      this.localCache.lastSyncedRevision = this.cloudState.revision;
      this.localCache.dirty = false;

      // Abort pending in-flight local syncs
      while (this.pendingSyncPromises.length > 0) {
        const p = this.pendingSyncPromises.shift();
        p.reject({ code: 'ERROR_SYNC_ABORTED', message: 'In-flight sync aborted due to cloud state selection' });
      }

      if (this.onStateReloadedHandler) {
        this.state = 'READY_IDLE';
        this.onStateReloadedHandler(this.cloudState.data);
      } else {
        this.state = 'RELOAD_TRIGGERED';
        this.reloadTriggered = true;
      }

      if (this.initResolve) {
        this.initResolve({ source: 'CLOUD', data: this.cloudState.data });
        this.initResolve = null;
      }
    } else {
      throw new Error(`Invalid user choice: ${userChoice}`);
    }
  }

  // Storage API
  async save(slot, data, onSync) {
    if (this.state === 'UNINITIALIZED' || this.state === 'HANDSHAKING') {
      throw { code: 'ERROR_NOT_INITIALIZED', message: 'SDK is not initialized' };
    }
    if (this.state === 'CONFLICT_RESOLVING' || this.state === 'RELOAD_TRIGGERED') {
      throw { code: 'ERROR_SYNC_PENDING_RESOLUTION', message: 'Hard lock active: conflict resolution pending' };
    }
    if (this.state === 'MIGRATING') {
      throw { code: 'ERROR_MIGRATION_IN_PROGRESS', message: 'Hard lock active: account migration in progress' };
    }

    // Local IndexedDB save succeeds
    this.localCache.slot = slot;
    this.localCache.data = data;
    this.localCache.dirty = true;
    this.localCache.localRevision++;

    if (onSync) {
      this.pendingSyncPromises.push({ onSync, resolve: () => onSync(null), reject: (err) => onSync(err) });
    }

    return { success: true, localRevision: this.localCache.localRevision };
  }

  async load(slot) {
    if (this.state === 'UNINITIALIZED' || this.state === 'HANDSHAKING') {
      throw { code: 'ERROR_NOT_INITIALIZED', message: 'SDK is not initialized' };
    }
    if (this.state === 'CONFLICT_RESOLVING' || this.state === 'RELOAD_TRIGGERED') {
      throw { code: 'ERROR_SYNC_PENDING_RESOLUTION', message: 'Hard lock active: conflict resolution pending' };
    }
    if (this.state === 'MIGRATING') {
      throw { code: 'ERROR_MIGRATION_IN_PROGRESS', message: 'Hard lock active: account migration in progress' };
    }

    return this.localCache.data;
  }

  async delete(slot) {
    if (this.state === 'UNINITIALIZED' || this.state === 'HANDSHAKING') {
      throw { code: 'ERROR_NOT_INITIALIZED', message: 'SDK is not initialized' };
    }
    if (this.state === 'CONFLICT_RESOLVING' || this.state === 'RELOAD_TRIGGERED') {
      throw { code: 'ERROR_SYNC_PENDING_RESOLUTION', message: 'Hard lock active: conflict resolution pending' };
    }
    if (this.state === 'MIGRATING') {
      throw { code: 'ERROR_MIGRATION_IN_PROGRESS', message: 'Hard lock active: account migration in progress' };
    }

    this.localCache.data = null;
    this.localCache.dirty = true;
    return { success: true };
  }

  onStateReloaded(handler) {
    this.onStateReloadedHandler = handler;
  }

  // Account migration
  async associateAnonymousAccount() {
    if (this.state !== 'READY_IDLE') {
      throw new Error('Cannot initiate migration when not READY_IDLE');
    }
    this.state = 'MIGRATING';
  }

  completeMigration(newPlayerId) {
    if (this.state !== 'MIGRATING') {
      throw new Error('Cannot complete migration when not MIGRATING');
    }
    this.playerId = newPlayerId;
    this.isGuest = false;
    this.state = 'READY_IDLE';
  }

  // Background dynamic conflict trigger
  triggerDynamicConflict() {
    if (this.state !== 'READY_IDLE') return;
    this.state = 'CONFLICT_RESOLVING';
  }
}

export async function runFSMAndLockingTests() {
  console.log('=== Starting Harness 1: FSM State Transitions & Storage Locking ===');
  const metrics = {
    testsRun: 0,
    testsPassed: 0,
    concurrentRejections: 0,
    abortedPromises: 0,
  };

  // Test 1: Handshake Case A (Cloud Newer, Clean)
  {
    metrics.testsRun++;
    const sdk = new SDKFSM({
      localCache: { slot: 's1', data: 'local_v1', localRevision: 1, lastSyncedRevision: 1, dirty: false },
      cloudState: { slot: 's1', data: 'cloud_v5', revision: 5 },
    });
    const initResult = await sdk.init();
    assert.equal(sdk.state, 'READY_IDLE', 'State should be READY_IDLE');
    assert.equal(initResult.source, 'CLOUD', 'Init should resolve with CLOUD');
    assert.equal(sdk.localCache.data, 'cloud_v5', 'Local cache updated to cloud');
    assert.equal(sdk.localCache.lastSyncedRevision, 5);
    assert.equal(sdk.localCache.dirty, false);
    metrics.testsPassed++;
    console.log('  [PASS] Handshake Case A (Cloud Newer, Clean)');
  }

  // Test 2: Handshake Case B (Local Dirty, Cloud Same)
  {
    metrics.testsRun++;
    const sdk = new SDKFSM({
      localCache: { slot: 's1', data: 'local_v2', localRevision: 2, lastSyncedRevision: 1, dirty: true },
      cloudState: { slot: 's1', data: 'cloud_v1', revision: 1 },
    });
    const initResult = await sdk.init();
    assert.equal(sdk.state, 'READY_IDLE');
    assert.equal(initResult.source, 'LOCAL');
    assert.equal(sdk.localCache.data, 'local_v2');
    metrics.testsPassed++;
    console.log('  [PASS] Handshake Case B (Local Dirty, Cloud Same)');
  }

  // Test 3: Handshake Case C (Genuine Conflict -> Gated Boot Freeze)
  {
    metrics.testsRun++;
    const sdk = new SDKFSM({
      localCache: { slot: 's1', data: 'local_diverged', localRevision: 3, lastSyncedRevision: 1, dirty: true },
      cloudState: { slot: 's1', data: 'cloud_diverged', revision: 4 },
    });

    let initResolved = false;
    const initPromise = sdk.init().then(() => { initResolved = true; });

    // Allow event loop ticks
    await new Promise(r => setTimeout(r, 10));

    // Verify init() is NOT resolved
    assert.equal(initResolved, false, 'init() MUST NOT resolve before conflict modal selection');
    assert.equal(sdk.state, 'CONFLICT_RESOLVING', 'State must be CONFLICT_RESOLVING');

    // Resolve as User Choosing Cloud
    sdk.resolveConflict('CLOUD');
    await initPromise;
    assert.equal(initResolved, true, 'init() should now resolve');
    assert.equal(sdk.localCache.data, 'cloud_diverged', 'Data should be cloud state');
    assert.equal(sdk.localCache.dirty, false);
    assert.equal(sdk.localCache.lastSyncedRevision, 4);
    metrics.testsPassed++;
    console.log('  [PASS] Handshake Case C (Conflict Gating & Cloud Resolution)');
  }

  // Test 4: Handshake Case D (In-Sync)
  {
    metrics.testsRun++;
    const sdk = new SDKFSM({
      localCache: { slot: 's1', data: 'sync_data', localRevision: 2, lastSyncedRevision: 2, dirty: false },
      cloudState: { slot: 's1', data: 'sync_data', revision: 2 },
    });
    const initResult = await sdk.init();
    assert.equal(sdk.state, 'READY_IDLE');
    assert.equal(initResult.source, 'LOCAL');
    metrics.testsPassed++;
    console.log('  [PASS] Handshake Case D (In-Sync)');
  }

  // Test 5: Adversarial Stress: 500 Concurrent Save/Load/Delete Calls during CONFLICT_RESOLVING
  {
    metrics.testsRun++;
    const sdk = new SDKFSM({
      localCache: { slot: 's1', data: 'local_data', localRevision: 2, lastSyncedRevision: 1, dirty: true },
      cloudState: { slot: 's1', data: 'cloud_data', revision: 3 },
    });
    sdk.init(); // Enters CONFLICT_RESOLVING
    assert.equal(sdk.state, 'CONFLICT_RESOLVING');

    const totalConcurrentCalls = 500;
    const results = await Promise.allSettled(
      Array.from({ length: totalConcurrentCalls }, (_, i) => {
        if (i % 3 === 0) return sdk.save('s1', { highscore: i });
        if (i % 3 === 1) return sdk.load('s1');
        return sdk.delete('s1');
      })
    );

    let rejectedCount = 0;
    for (const res of results) {
      if (res.status === 'rejected') {
        assert.equal(res.reason.code, 'ERROR_SYNC_PENDING_RESOLUTION');
        rejectedCount++;
      }
    }

    assert.equal(rejectedCount, totalConcurrentCalls, '100% of concurrent operations must be rejected deterministically');
    assert.equal(sdk.localCache.data, 'local_data', 'Local store must remain completely unmutated');
    metrics.concurrentRejections += rejectedCount;
    metrics.testsPassed++;
    console.log(`  [PASS] 500 Concurrent Calls in CONFLICT_RESOLVING: 100% rejected with ERROR_SYNC_PENDING_RESOLUTION`);
  }

  // Test 6: Hard Storage Lock during Account Migration (MIGRATING)
  {
    metrics.testsRun++;
    const sdk = new SDKFSM({
      localCache: { slot: 's1', data: 'guest_save', localRevision: 1, lastSyncedRevision: 1, dirty: false },
      cloudState: { slot: 's1', data: 'guest_save', revision: 1 },
    });
    await sdk.init();
    await sdk.associateAnonymousAccount();
    assert.equal(sdk.state, 'MIGRATING');

    const concurrentOps = 100;
    const results = await Promise.allSettled(
      Array.from({ length: concurrentOps }, (_, i) => sdk.save('s1', { guestScore: i }))
    );

    let rejectedMigrationCount = 0;
    for (const res of results) {
      if (res.status === 'rejected') {
        assert.equal(res.reason.code, 'ERROR_MIGRATION_IN_PROGRESS');
        rejectedMigrationCount++;
      }
    }
    assert.equal(rejectedMigrationCount, concurrentOps, 'All calls rejected with ERROR_MIGRATION_IN_PROGRESS');

    sdk.completeMigration('user_permanent_789');
    assert.equal(sdk.state, 'READY_IDLE');
    assert.equal(sdk.playerId, 'user_permanent_789');
    assert.equal(sdk.isGuest, false);

    // After migration unlocks, save must succeed
    const postMigrationSave = await sdk.save('s1', { postMigrationScore: 999 });
    assert.equal(postMigrationSave.success, true);
    metrics.testsPassed++;
    console.log('  [PASS] Account Migration Hard Lock & Re-Enablement');
  }

  // Test 7: State Invalidation Protocol & In-flight Sync Abortions
  {
    metrics.testsRun++;
    const sdk = new SDKFSM({
      localCache: { slot: 's1', data: 'local_pre_conflict', localRevision: 2, lastSyncedRevision: 1, dirty: true },
      cloudState: { slot: 's1', data: 'cloud_master_state', revision: 5 },
    });
    sdk.init(); // Enters CONFLICT_RESOLVING

    // Setup an in-flight sync promise simulator
    let abortedSyncError = null;
    sdk.pendingSyncPromises.push({
      reject: (err) => { abortedSyncError = err; }
    });

    let reloadedStateReceived = null;
    sdk.onStateReloaded((state) => {
      reloadedStateReceived = state;
    });

    sdk.resolveConflict('CLOUD');

    assert.equal(reloadedStateReceived, 'cloud_master_state', 'onStateReloaded must receive cloud state');
    assert.notEqual(abortedSyncError, null, 'In-flight sync must be aborted');
    assert.equal(abortedSyncError.code, 'ERROR_SYNC_ABORTED');
    metrics.abortedPromises++;
    metrics.testsPassed++;
    console.log('  [PASS] State Invalidation Protocol & In-Flight Sync Abort (ERROR_SYNC_ABORTED)');
  }

  // Test 8: Dynamic Conflict Detection from READY_IDLE
  {
    metrics.testsRun++;
    const sdk = new SDKFSM({
      localCache: { slot: 's1', data: 'v1', localRevision: 1, lastSyncedRevision: 1, dirty: false },
      cloudState: { slot: 's1', data: 'v1', revision: 1 },
    });
    await sdk.init();
    assert.equal(sdk.state, 'READY_IDLE');

    // Server reports dynamic revision conflict on background flush
    sdk.triggerDynamicConflict();
    assert.equal(sdk.state, 'CONFLICT_RESOLVING');

    // Immediate save call must be hard locked
    await assert.rejects(
      async () => sdk.save('s1', 'new_v2'),
      (err) => err.code === 'ERROR_SYNC_PENDING_RESOLUTION'
    );
    metrics.testsPassed++;
    console.log('  [PASS] Dynamic Conflict NACK transitions FSM to CONFLICT_RESOLVING hard lock');
  }

  console.log(`=== Harness 1 Completed: ${metrics.testsPassed}/${metrics.testsRun} tests passed ===\n`);
  return metrics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFSMAndLockingTests().catch(err => {
    console.error('Harness 1 Failed:', err);
    process.exit(1);
  });
}
