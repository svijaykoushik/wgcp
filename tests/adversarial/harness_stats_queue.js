/**
 * Harness 3: Stats Queue Double-Buffering, High-Frequency Spamming & Bounds Validation
 * Tests:
 * 1. Double-buffering delta engine and mathematical coalescing matrix.
 * 2. 10,000 updates/sec stress spamming across 100 keys.
 * 3. 100-key unique capacity enforcement & 101st key rejection with ERROR_QUEUE_FULL.
 * 4. 50-item batch transmission chunking.
 * 5. Debounce (1500ms) and hard throttle ceiling (5000ms) timers.
 * 6. Numeric validation (NaN, Infinity, string, MAX_SAFE_INTEGER bounds) rejecting with ERROR_INVALID_PARAMETER.
 */

import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';

class StatsQueueEngine {
  constructor(options = {}) {
    this.maxUniqueKeys = options.maxUniqueKeys || 100;
    this.maxBatchChunkSize = options.maxBatchChunkSize || 50;
    this.debounceMs = options.debounceMs || 1500;
    this.throttleMaxMs = options.throttleMaxMs || 5000;

    this.syncedBase = new Map(); // statId -> number (authoritative synced cache)
    this.activeBuffer = new Map(); // statId -> { op: 'DELTA'|'SET', value: number }
    this.inFlightBatch = null; // { batchId: string, timestamp: number, operations: Map<statId, StatOperation> }

    this.debounceTimer = null;
    this.throttleTimer = null;
    this.firstBufferedTime = null;
    this.flushedEnvelopes = [];
    this.onFlushCallback = options.onFlushCallback || null;
  }

  _validateNumber(val) {
    if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
      throw {
        code: 'ERROR_INVALID_PARAMETER',
        message: `Invalid stat value: ${val}. Must be a finite number.`,
      };
    }
    if (Math.abs(val) > Number.MAX_SAFE_INTEGER) {
      throw {
        code: 'ERROR_INVALID_PARAMETER',
        message: `Value exceeds MAX_SAFE_INTEGER: ${val}`,
      };
    }
  }

  async incrementStat(statId, amount) {
    this._validateNumber(amount);
    this._applyOperation(statId, { op: 'DELTA', value: amount });
    return this.getStat(statId);
  }

  async setStat(statId, value) {
    this._validateNumber(value);
    this._applyOperation(statId, { op: 'SET', value: value });
    return this.getStat(statId);
  }

  _applyOperation(statId, newOp) {
    // Check if new key exceeds capacity
    if (!this.activeBuffer.has(statId)) {
      const currentUniqueCount = this.activeBuffer.size + (this.inFlightBatch ? this.inFlightBatch.operations.size : 0);
      // If key is not in active and not in in-flight, it's a completely new key
      const inInflight = this.inFlightBatch ? this.inFlightBatch.operations.has(statId) : false;
      if (!inInflight && currentUniqueCount >= this.maxUniqueKeys) {
        throw {
          code: 'ERROR_QUEUE_FULL',
          message: `Stats queue maximum unique key limit (${this.maxUniqueKeys}) exceeded.`,
          details: { queueType: 'STATS', maxCapacity: this.maxUniqueKeys, currentSize: currentUniqueCount, statId }
        };
      }
    }

    const existing = this.activeBuffer.get(statId);
    if (!existing) {
      this.activeBuffer.set(statId, { ...newOp });
    } else {
      // Apply coalescing matrix
      if (existing.op === 'DELTA' && newOp.op === 'DELTA') {
        existing.value += newOp.value;
      } else if (existing.op === 'DELTA' && newOp.op === 'SET') {
        existing.op = 'SET';
        existing.value = newOp.value;
      } else if (existing.op === 'SET' && newOp.op === 'DELTA') {
        existing.value += newOp.value;
      } else if (existing.op === 'SET' && newOp.op === 'SET') {
        existing.value = newOp.value;
      }
    }

    this._scheduleFlush();
  }

  _scheduleFlush() {
    const now = Date.now();
    if (!this.firstBufferedTime) {
      this.firstBufferedTime = now;
    }

    // Reset debounce timer
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.flush('DEBOUNCE');
    }, this.debounceMs);

    // Ensure throttle max timer
    if (!this.throttleTimer) {
      const remainingThrottle = Math.max(0, this.throttleMaxMs - (now - this.firstBufferedTime));
      this.throttleTimer = setTimeout(() => {
        this.flush('THROTTLE_CEILING');
      }, remainingThrottle);
    }
  }

  // Double-buffering swap
  flush(trigger = 'MANUAL') {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.firstBufferedTime = null;

    if (this.activeBuffer.size === 0) return [];
    if (this.inFlightBatch !== null) {
      // In-flight batch already pending portal ACK; wait for resolution before new batch
      return [];
    }

    // Double-buffering swap: Active Buffer -> In-Flight Batch
    const batchId = randomUUID();
    const batchOps = new Map(this.activeBuffer);
    this.activeBuffer.clear();

    this.inFlightBatch = {
      batchId,
      timestamp: Date.now(),
      operations: batchOps,
      trigger,
    };

    // Chunking into envelopes of max 50 items
    const entries = Array.from(batchOps.entries());
    const envelopes = [];
    for (let i = 0; i < entries.length; i += this.maxBatchChunkSize) {
      const chunk = entries.slice(i, i + this.maxBatchChunkSize);
      const chunkOps = Object.fromEntries(chunk);
      envelopes.push({
        batchId,
        chunkIndex: Math.floor(i / this.maxBatchChunkSize),
        totalChunks: Math.ceil(entries.length / this.maxBatchChunkSize),
        timestamp: Date.now(),
        operations: chunkOps,
      });
    }

    this.flushedEnvelopes.push(...envelopes);
    if (this.onFlushCallback) {
      this.onFlushCallback(envelopes);
    }

    return envelopes;
  }

  // Portal ACK handler
  acknowledgeBatch(batchId) {
    if (!this.inFlightBatch || this.inFlightBatch.batchId !== batchId) {
      return false;
    }

    // Apply in-flight operations to authoritative syncedBase
    for (const [statId, op] of this.inFlightBatch.operations.entries()) {
      const current = this.syncedBase.get(statId) || 0;
      if (op.op === 'DELTA') {
        this.syncedBase.set(statId, current + op.value);
      } else if (op.op === 'SET') {
        this.syncedBase.set(statId, op.value);
      }
    }

    this.inFlightBatch = null;
    return true;
  }

  // Read-Your-Own-Writes Coalesced Lookup
  getStat(statId) {
    const base = this.syncedBase.get(statId) || 0;
    const inflight = this.inFlightBatch ? this.inFlightBatch.operations.get(statId) : null;
    const active = this.activeBuffer.get(statId);

    // Compute effective value
    let val = base;

    if (inflight) {
      if (inflight.op === 'DELTA') {
        val += inflight.value;
      } else if (inflight.op === 'SET') {
        val = inflight.value;
      }
    }

    if (active) {
      if (active.op === 'DELTA') {
        val += active.value;
      } else if (active.op === 'SET') {
        val = active.value;
      }
    }

    return val;
  }
}

export async function runStatsQueueTests() {
  console.log('=== Starting Harness 3: Stats Queue Double-Buffering & Spamming ===');
  const metrics = {
    testsRun: 0,
    testsPassed: 0,
    spamOpsExecuted: 0,
    uniqueKeysTracked: 0,
    overflowRejections: 0,
    invalidParamRejections: 0,
  };

  // Test 1: Coalescing Matrix Verification
  {
    metrics.testsRun++;
    const q = new StatsQueueEngine();

    // DELTA + DELTA
    await q.incrementStat('score', 10);
    await q.incrementStat('score', 25);
    assert.equal(q.activeBuffer.get('score').op, 'DELTA');
    assert.equal(q.activeBuffer.get('score').value, 35);

    // DELTA + SET
    await q.setStat('score', 100);
    assert.equal(q.activeBuffer.get('score').op, 'SET');
    assert.equal(q.activeBuffer.get('score').value, 100);

    // SET + DELTA
    await q.incrementStat('score', 15);
    assert.equal(q.activeBuffer.get('score').op, 'SET');
    assert.equal(q.activeBuffer.get('score').value, 115);

    // SET + SET
    await q.setStat('score', 500);
    assert.equal(q.activeBuffer.get('score').op, 'SET');
    assert.equal(q.activeBuffer.get('score').value, 500);

    metrics.testsPassed++;
    console.log('  [PASS] Double-Buffering Coalescing Matrix verified (DELTA+DELTA, DELTA+SET, SET+DELTA, SET+SET)');
  }

  // Test 2: Rapid Stats Increment Spamming (10,000 updates across 100 keys)
  {
    metrics.testsRun++;
    const q = new StatsQueueEngine({ maxUniqueKeys: 100 });
    const totalOps = 10000;
    const numKeys = 100;

    const start = performance.now();
    for (let i = 0; i < totalOps; i++) {
      const key = `stat_${i % numKeys}`;
      q._applyOperation(key, { op: 'DELTA', value: 1 });
    }
    const duration = performance.now() - start;

    assert.equal(q.activeBuffer.size, 100, 'All 100 keys must be aggregated');
    for (let k = 0; k < numKeys; k++) {
      const expectedDelta = totalOps / numKeys; // 100 increments per key
      assert.equal(q.activeBuffer.get(`stat_${k}`).value, expectedDelta);
    }

    metrics.spamOpsExecuted += totalOps;
    metrics.uniqueKeysTracked = numKeys;
    metrics.testsPassed++;
    console.log(`  [PASS] 10,000 Ops Spamming across 100 keys aggregated in ${duration.toFixed(2)}ms (~${Math.round(totalOps / (duration / 1000))} ops/sec)`);
  }

  // Test 3: 100-Key Capacity Enforcement & 101st Key Overflow Rejection
  {
    metrics.testsRun++;
    const q = new StatsQueueEngine({ maxUniqueKeys: 100 });

    // Populate exactly 100 keys
    for (let i = 0; i < 100; i++) {
      await q.incrementStat(`key_${i}`, 1);
    }
    assert.equal(q.activeBuffer.size, 100);

    // 101st distinct key MUST throw ERROR_QUEUE_FULL
    let overflowError = null;
    try {
      await q.incrementStat('key_101_overflow', 1);
    } catch (err) {
      overflowError = err;
    }

    assert.notEqual(overflowError, null, 'Must reject 101st key');
    assert.equal(overflowError.code, 'ERROR_QUEUE_FULL');
    assert.equal(overflowError.details.maxCapacity, 100);
    assert.equal(overflowError.details.statId, 'key_101_overflow');

    // Modifying existing key within the 100 limit must still succeed
    const key0Val = await q.incrementStat('key_0', 5);
    assert.equal(key0Val, 6);

    metrics.overflowRejections++;
    metrics.testsPassed++;
    console.log('  [PASS] 100-Key Queue Bounds: 101st key rejected with ERROR_QUEUE_FULL, existing keys succeed');
  }

  // Test 4: 50-Item Batch Transmission Chunking
  {
    metrics.testsRun++;
    const q = new StatsQueueEngine({ maxUniqueKeys: 100, maxBatchChunkSize: 50 });

    for (let i = 0; i < 100; i++) {
      q._applyOperation(`item_${i}`, { op: 'DELTA', value: i });
    }

    const envelopes = q.flush('MANUAL');
    assert.equal(envelopes.length, 2, '100 keys must be chunked into 2 envelopes of 50 items');
    assert.equal(Object.keys(envelopes[0].operations).length, 50);
    assert.equal(Object.keys(envelopes[1].operations).length, 50);
    assert.equal(envelopes[0].batchId, envelopes[1].batchId, 'Both chunks share the same batchId');
    assert.equal(envelopes[0].totalChunks, 2);
    assert.equal(envelopes[0].chunkIndex, 0);
    assert.equal(envelopes[1].chunkIndex, 1);

    metrics.testsPassed++;
    console.log('  [PASS] 50-Item Batch Chunking: 100 keys split into 2 structured envelopes');
  }

  // Test 5: Debounce (1500ms) & Throttle (5000ms) Timers
  {
    metrics.testsRun++;
    let flushedCount = 0;
    const q = new StatsQueueEngine({
      debounceMs: 50, // Accelerated for test
      throttleMaxMs: 150,
      onFlushCallback: () => { flushedCount++; }
    });

    // Inactivity triggers debounce
    q.incrementStat('gold', 10);
    await new Promise(r => setTimeout(r, 70));
    assert.equal(flushedCount, 1, 'Inactivity flush triggered after debounce');

    q.acknowledgeBatch(q.inFlightBatch.batchId);

    // Continuous updates trigger throttle ceiling
    const interval = setInterval(() => {
      try { q.incrementStat('gold', 1); } catch (e) {}
    }, 20);

    await new Promise(r => setTimeout(r, 200));
    clearInterval(interval);

    assert.ok(flushedCount >= 2, 'Continuous updates forced flush at throttle ceiling');
    metrics.testsPassed++;
    console.log('  [PASS] Debounce (1500ms) and Throttle Ceiling (5000ms) timer mechanics verified');
  }

  // Test 6: Numeric Parameter Validation
  {
    metrics.testsRun++;
    const q = new StatsQueueEngine();

    const invalidValues = [NaN, Infinity, -Infinity, '100', null, undefined, {}, Number.MAX_SAFE_INTEGER + 1000];
    for (const val of invalidValues) {
      await assert.rejects(
        async () => q.incrementStat('stat_err', val),
        (err) => err.code === 'ERROR_INVALID_PARAMETER'
      );
      metrics.invalidParamRejections++;
    }

    metrics.testsPassed++;
    console.log('  [PASS] Numeric Validation: NaN, Infinity, strings, objects, > MAX_SAFE_INTEGER rejected');
  }

  console.log(`=== Harness 3 Completed: ${metrics.testsPassed}/${metrics.testsRun} tests passed ===\n`);
  return metrics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStatsQueueTests().catch(err => {
    console.error('Harness 3 Failed:', err);
    process.exit(1);
  });
}
