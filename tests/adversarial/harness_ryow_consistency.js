/**
 * Harness 5: Read-Your-Own-Writes (RYOW) Coalescing Verification
 * Tests:
 * 1. Step-by-step verification of Value_effective = Value_synced + Delta_inflight + Delta_active
 * 2. Mixed DELTA and SET state progression.
 * 3. 10,000 randomized state transitions (fuzzing) comparing RYOW output against sequential oracle.
 */

import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';

class RYOWStatsModel {
  constructor() {
    this.syncedBase = new Map();
    this.activeBuffer = new Map();
    this.inFlightBatch = null;
  }

  increment(statId, amount) {
    const active = this.activeBuffer.get(statId);
    if (!active) {
      this.activeBuffer.set(statId, { op: 'DELTA', value: amount });
    } else if (active.op === 'DELTA') {
      active.value += amount;
    } else if (active.op === 'SET') {
      active.value += amount;
    }
    return this.getStat(statId);
  }

  set(statId, value) {
    this.activeBuffer.set(statId, { op: 'SET', value });
    return this.getStat(statId);
  }

  startFlush() {
    if (this.activeBuffer.size === 0 || this.inFlightBatch !== null) return null;
    this.inFlightBatch = {
      batchId: randomUUID(),
      operations: new Map(this.activeBuffer),
    };
    this.activeBuffer.clear();
    return this.inFlightBatch;
  }

  ackFlush(batchId) {
    if (!this.inFlightBatch || this.inFlightBatch.batchId !== batchId) return;
    for (const [k, op] of this.inFlightBatch.operations.entries()) {
      const cur = this.syncedBase.get(k) || 0;
      if (op.op === 'DELTA') {
        this.syncedBase.set(k, cur + op.value);
      } else if (op.op === 'SET') {
        this.syncedBase.set(k, op.value);
      }
    }
    this.inFlightBatch = null;
  }

  nackFlush(batchId) {
    if (!this.inFlightBatch || this.inFlightBatch.batchId !== batchId) return;
    for (const [k, infOp] of this.inFlightBatch.operations.entries()) {
      const actOp = this.activeBuffer.get(k);
      if (!actOp) {
        this.activeBuffer.set(k, { ...infOp });
      } else if (infOp.op === 'DELTA' && actOp.op === 'DELTA') {
        actOp.value += infOp.value;
      } else if (infOp.op === 'DELTA' && actOp.op === 'SET') {
        // actOp remains SET
      } else if (infOp.op === 'SET' && actOp.op === 'DELTA') {
        actOp.op = 'SET';
        actOp.value = infOp.value + actOp.value;
      } else if (infOp.op === 'SET' && actOp.op === 'SET') {
        // actOp remains SET
      }
    }
    this.inFlightBatch = null;
  }

  getStat(statId) {
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

export async function runRYOWConsistencyTests() {
  console.log('=== Starting Harness 5: Read-Your-Own-Writes (RYOW) Coalescing ===');
  const metrics = {
    testsRun: 0,
    testsPassed: 0,
    fuzzStepsExecuted: 0,
    invariantsChecked: 0,
  };

  // Test 1: Step-by-Step Coalescing Verification
  {
    metrics.testsRun++;
    const model = new RYOWStatsModel();

    // 1. Initial state
    assert.equal(model.getStat('coins'), 0);

    // 2. Local increment in active buffer
    model.increment('coins', 50);
    assert.equal(model.getStat('coins'), 50); // Base(0) + ActiveDelta(50)

    // 3. Flush begins -> moves to in-flight
    const batch1 = model.startFlush();
    assert.equal(model.getStat('coins'), 50); // Base(0) + InflightDelta(50) + Active(0)

    // 4. Another increment while in-flight
    model.increment('coins', 25);
    assert.equal(model.getStat('coins'), 75); // Base(0) + InflightDelta(50) + ActiveDelta(25)

    // 5. Explicit SET in active buffer
    model.set('coins', 200);
    assert.equal(model.getStat('coins'), 200); // InflightDelta(50) overridden by ActiveSet(200)

    // 6. Another increment after SET
    model.increment('coins', 10);
    assert.equal(model.getStat('coins'), 210); // ActiveSet(210)

    // 7. Flush 1 NACKs -> re-merged
    model.nackFlush(batch1.batchId);
    assert.equal(model.getStat('coins'), 210); // Re-merge preserves active SET(210)

    // 8. Start flush 2
    const batch2 = model.startFlush();
    assert.equal(model.getStat('coins'), 210);

    // 9. Flush 2 ACKs
    model.ackFlush(batch2.batchId);
    assert.equal(model.getStat('coins'), 210); // Base(210) + Inflight(0) + Active(0)

    metrics.testsPassed++;
    console.log('  [PASS] Step-by-step RYOW coalescing validated through all buffer swap phases');
  }

  // Test 2: 10,000 Randomized Fuzzing Steps vs Sequential Oracle
  {
    metrics.testsRun++;
    const model = new RYOWStatsModel();
    const oracle = new Map(); // Simple ground truth: statId -> number

    const keys = ['gold', 'gems', 'kills', 'deaths', 'potions'];
    for (const k of keys) oracle.set(k, 0);

    const totalSteps = 10000;
    let pendingBatch = null;

    for (let step = 0; step < totalSteps; step++) {
      const actionType = Math.floor(Math.random() * 6);
      const key = keys[Math.floor(Math.random() * keys.length)];

      if (actionType === 0 || actionType === 1) {
        // Increment
        const amt = Math.floor(Math.random() * 100) + 1;
        model.increment(key, amt);
        oracle.set(key, (oracle.get(key) || 0) + amt);
      } else if (actionType === 2) {
        // Set
        const val = Math.floor(Math.random() * 5000);
        model.set(key, val);
        oracle.set(key, val);
      } else if (actionType === 3) {
        // Start flush if none pending
        if (!pendingBatch) {
          pendingBatch = model.startFlush();
        }
      } else if (actionType === 4) {
        // ACK or NACK pending flush
        if (pendingBatch) {
          if (Math.random() < 0.7) {
            model.ackFlush(pendingBatch.batchId);
          } else {
            model.nackFlush(pendingBatch.batchId);
          }
          pendingBatch = null;
        }
      }

      // Check RYOW invariant for all keys
      for (const k of keys) {
        const sdkVal = model.getStat(k);
        const expectedVal = oracle.get(k);
        assert.equal(sdkVal, expectedVal, `RYOW desync on key ${k} at step ${step}: expected ${expectedVal}, got ${sdkVal}`);
        metrics.invariantsChecked++;
      }
    }

    metrics.fuzzStepsExecuted += totalSteps;
    metrics.testsPassed++;
    console.log(`  [PASS] 10,000 Fuzzing Steps: ${metrics.invariantsChecked} RYOW invariant assertions verified with 100% precision`);
  }

  console.log(`=== Harness 5 Completed: ${metrics.testsPassed}/${metrics.testsRun} tests passed ===\n`);
  return metrics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRYOWConsistencyTests().catch(err => {
    console.error('Harness 5 Failed:', err);
    process.exit(1);
  });
}
