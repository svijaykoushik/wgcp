/**
 * Harness 4: Network Drops, NACK Simulation & Idempotent batchId Handling
 * Tests:
 * 1. Mathematical re-merging across all 5 in-flight + active permutations on NACK.
 * 2. High-stress packet drop simulation (50% network loss over 1,000 cycles) verifying zero delta loss.
 * 3. Backend batchId deduplication ensuring duplicate envelopes never cause duplicate increments.
 */

import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';

class ReMergingStatsQueue {
  constructor() {
    this.syncedBase = new Map();
    this.activeBuffer = new Map();
    this.inFlightBatch = null;
  }

  increment(statId, val) {
    const existing = this.activeBuffer.get(statId);
    if (!existing) {
      this.activeBuffer.set(statId, { op: 'DELTA', value: val });
    } else if (existing.op === 'DELTA') {
      existing.value += val;
    } else if (existing.op === 'SET') {
      existing.value += val;
    }
  }

  set(statId, val) {
    this.activeBuffer.set(statId, { op: 'SET', value: val });
  }

  flush() {
    if (this.activeBuffer.size === 0 || this.inFlightBatch !== null) return null;
    const batchId = randomUUID();
    this.inFlightBatch = {
      batchId,
      operations: new Map(this.activeBuffer),
    };
    this.activeBuffer.clear();
    return this.inFlightBatch;
  }

  handleNACK(batchId) {
    if (!this.inFlightBatch || this.inFlightBatch.batchId !== batchId) return;

    // Atomically re-merge In-Flight Batch into Active Buffer
    for (const [statId, infOp] of this.inFlightBatch.operations.entries()) {
      const actOp = this.activeBuffer.get(statId);

      if (!actOp) {
        // In-Flight + Active None -> In-Flight
        this.activeBuffer.set(statId, { ...infOp });
      } else if (infOp.op === 'DELTA' && actOp.op === 'DELTA') {
        // In-Flight DELTA + Active DELTA -> DELTA(d_inf + d_act)
        actOp.value += infOp.value;
      } else if (infOp.op === 'DELTA' && actOp.op === 'SET') {
        // In-Flight DELTA + Active SET -> SET(v_act) (Active SET overrides prior delta)
        // actOp stays SET(v_act)
      } else if (infOp.op === 'SET' && actOp.op === 'DELTA') {
        // In-Flight SET + Active DELTA -> SET(v_inf + d_act)
        actOp.op = 'SET';
        actOp.value = infOp.value + actOp.value;
      } else if (infOp.op === 'SET' && actOp.op === 'SET') {
        // In-Flight SET + Active SET -> SET(v_act)
        // actOp stays SET(v_act)
      }
    }

    this.inFlightBatch = null;
  }

  handleACK(batchId, backendState) {
    if (!this.inFlightBatch || this.inFlightBatch.batchId !== batchId) return;
    for (const [k, v] of Object.entries(backendState)) {
      this.syncedBase.set(k, v);
    }
    this.inFlightBatch = null;
  }

  getEffectiveValue(statId) {
    const base = this.syncedBase.get(statId) || 0;
    const inf = this.inFlightBatch ? this.inFlightBatch.operations.get(statId) : null;
    const act = this.activeBuffer.get(statId);

    let val = base;
    if (inf) {
      val = (inf.op === 'DELTA') ? (val + inf.value) : inf.value;
    }
    if (act) {
      val = (act.op === 'DELTA') ? (val + act.value) : act.value;
    }
    return val;
  }
}

class PortalBackendSimulator {
  constructor() {
    this.authoritativeDatabase = new Map();
    this.processedBatchIds = new Set();
    this.duplicateDetections = 0;
  }

  processBatch(batchId, operations) {
    if (this.processedBatchIds.has(batchId)) {
      this.duplicateDetections++;
      // Return existing state without re-applying deltas
      return { ack: true, duplicate: true, state: Object.fromEntries(this.authoritativeDatabase) };
    }

    for (const [statId, op] of operations.entries()) {
      const current = this.authoritativeDatabase.get(statId) || 0;
      if (op.op === 'DELTA') {
        this.authoritativeDatabase.set(statId, current + op.value);
      } else if (op.op === 'SET') {
        this.authoritativeDatabase.set(statId, op.value);
      }
    }

    this.processedBatchIds.add(batchId);
    return { ack: true, duplicate: false, state: Object.fromEntries(this.authoritativeDatabase) };
  }
}

export async function runNetworkResilienceTests() {
  console.log('=== Starting Harness 4: Network Drops, NACK Simulation & Idempotency ===');
  const metrics = {
    testsRun: 0,
    testsPassed: 0,
    nacksSimulated: 0,
    dropsSimulated: 0,
    idempotentDuplicatesBlocked: 0,
  };

  // Test 1: Verify all 5 NACK Re-Merge Permutations
  {
    metrics.testsRun++;

    // Permutation 1: In-Flight DELTA(10) + Active None -> Active DELTA(10)
    {
      const q = new ReMergingStatsQueue();
      q.increment('p1', 10);
      const batch = q.flush();
      q.handleNACK(batch.batchId);
      assert.deepEqual(q.activeBuffer.get('p1'), { op: 'DELTA', value: 10 });
    }

    // Permutation 2: In-Flight DELTA(10) + Active DELTA(5) -> Active DELTA(15)
    {
      const q = new ReMergingStatsQueue();
      q.increment('p2', 10);
      const batch = q.flush();
      q.increment('p2', 5);
      q.handleNACK(batch.batchId);
      assert.deepEqual(q.activeBuffer.get('p2'), { op: 'DELTA', value: 15 });
    }

    // Permutation 3: In-Flight DELTA(10) + Active SET(50) -> Active SET(50)
    {
      const q = new ReMergingStatsQueue();
      q.increment('p3', 10);
      const batch = q.flush();
      q.set('p3', 50);
      q.handleNACK(batch.batchId);
      assert.deepEqual(q.activeBuffer.get('p3'), { op: 'SET', value: 50 });
    }

    // Permutation 4: In-Flight SET(50) + Active DELTA(10) -> Active SET(60)
    {
      const q = new ReMergingStatsQueue();
      q.set('p4', 50);
      const batch = q.flush();
      q.increment('p4', 10);
      q.handleNACK(batch.batchId);
      assert.deepEqual(q.activeBuffer.get('p4'), { op: 'SET', value: 60 });
    }

    // Permutation 5: In-Flight SET(50) + Active SET(90) -> Active SET(90)
    {
      const q = new ReMergingStatsQueue();
      q.set('p5', 50);
      const batch = q.flush();
      q.set('p5', 90);
      q.handleNACK(batch.batchId);
      assert.deepEqual(q.activeBuffer.get('p5'), { op: 'SET', value: 90 });
    }

    metrics.testsPassed++;
    console.log('  [PASS] All 5 In-Flight + Active NACK re-merge permutations mathematically verified');
  }

  // Test 2: High-Stress Flaky Network Simulation (1,000 cycles with 50% packet drops)
  {
    metrics.testsRun++;
    const q = new ReMergingStatsQueue();
    const backend = new PortalBackendSimulator();

    let oracleTotalExpected = 0;
    const numCycles = 1000;

    for (let c = 0; c < numCycles; c++) {
      const delta = (c % 10) + 1;
      q.increment('player_gold', delta);
      oracleTotalExpected += delta;

      // Attempt flush periodically
      if (c % 5 === 0) {
        const batch = q.flush();
        if (batch) {
          // Simulate 50% network drop / NACK
          const isDrop = Math.random() < 0.5;
          if (isDrop) {
            metrics.dropsSimulated++;
            q.handleNACK(batch.batchId);
          } else {
            const resp = backend.processBatch(batch.batchId, batch.operations);
            q.handleACK(batch.batchId, resp.state);
          }
        }
      }
    }

    // Final clean flush to sync remaining deltas
    while (q.activeBuffer.size > 0 || q.inFlightBatch !== null) {
      const batch = q.flush();
      if (batch) {
        const resp = backend.processBatch(batch.batchId, batch.operations);
        q.handleACK(batch.batchId, resp.state);
      }
    }

    assert.equal(backend.authoritativeDatabase.get('player_gold'), oracleTotalExpected, 'Zero data loss on backend under 50% packet drop rate');
    assert.equal(q.getEffectiveValue('player_gold'), oracleTotalExpected, 'SDK effective value matches oracle exactly');

    metrics.testsPassed++;
    console.log(`  [PASS] Flaky Network Simulation: ${numCycles} cycles, ${metrics.dropsSimulated} drops simulated -> 0.00% data loss (Exact: ${oracleTotalExpected})`);
  }

  // Test 3: Backend batchId Idempotent Deduplication
  {
    metrics.testsRun++;
    const backend = new PortalBackendSimulator();
    const batchId = randomUUID();
    const ops = new Map([['xp', { op: 'DELTA', value: 500 }]]);

    // Initial delivery
    const res1 = backend.processBatch(batchId, ops);
    assert.equal(res1.duplicate, false);
    assert.equal(backend.authoritativeDatabase.get('xp'), 500);

    // Duplicate retry due to dropped ACK
    const res2 = backend.processBatch(batchId, ops);
    assert.equal(res2.duplicate, true);
    assert.equal(backend.authoritativeDatabase.get('xp'), 500, 'Duplicate retry MUST NOT re-increment XP');

    // 3rd duplicate retry
    const res3 = backend.processBatch(batchId, ops);
    assert.equal(res3.duplicate, true);
    assert.equal(backend.authoritativeDatabase.get('xp'), 500);

    metrics.idempotentDuplicatesBlocked += 2;
    metrics.testsPassed++;
    console.log('  [PASS] Backend batchId Deduplication: Duplicate flush packets detected and blocked');
  }

  console.log(`=== Harness 4 Completed: ${metrics.testsPassed}/${metrics.testsRun} tests passed ===\n`);
  return metrics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNetworkResilienceTests().catch(err => {
    console.error('Harness 4 Failed:', err);
    process.exit(1);
  });
}
