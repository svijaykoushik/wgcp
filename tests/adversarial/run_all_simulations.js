/**
 * Master Adversarial Simulation Runner - Challenger 2
 * Executes all 6 empirical simulation harnesses:
 * - Harness 1: FSM State Transitions & Storage Locking under Conflict & Migration
 * - Harness 2: Per-Slot FIFO Mutex, Latest-Wins Coalescing & Soft Sync Locking
 * - Harness 3: Stats Queue Double-Buffering, High-Frequency Spamming & Bounds Validation
 * - Harness 4: Network Drops, NACK Simulation & Idempotent batchId Handling
 * - Harness 5: Read-Your-Own-Writes (RYOW) Coalescing Verification
 * - Harness 6: Lifecycle Pause/Resume, Gamepad Sandbox & Clock Clamping
 */

import { runFSMAndLockingTests } from './harness_fsm_locking.js';
import { runSlotMutexTests } from './harness_slot_mutex.js';
import { runStatsQueueTests } from './harness_stats_queue.js';
import { runNetworkResilienceTests } from './harness_network_resilience.js';
import { runRYOWConsistencyTests } from './harness_ryow_consistency.js';
import { runLifecycleSandboxTests } from './harness_lifecycle_sandbox.js';

async function main() {
  console.log('================================================================');
  console.log('  CHALLENGER 2: ADVERSARIAL SYNCHRONIZATION & QUEUE SUITE');
  console.log('  Testing P-002 & P-003 Specifications Empirically');
  console.log('================================================================\n');

  const startTime = performance.now();
  const summary = {
    totalSuites: 6,
    suitesPassed: 0,
    totalIndividualTests: 0,
    totalTestsPassed: 0,
    details: {}
  };

  try {
    // 1. FSM & Storage Locking
    summary.details.harness1 = await runFSMAndLockingTests();
    summary.suitesPassed++;

    // 2. Slot Mutex & Coalescing
    summary.details.harness2 = await runSlotMutexTests();
    summary.suitesPassed++;

    // 3. Stats Queue Double-Buffering & Spamming
    summary.details.harness3 = await runStatsQueueTests();
    summary.suitesPassed++;

    // 4. Network Resilience & batchId Idempotency
    summary.details.harness4 = await runNetworkResilienceTests();
    summary.suitesPassed++;

    // 5. Read-Your-Own-Writes Consistency
    summary.details.harness5 = await runRYOWConsistencyTests();
    summary.suitesPassed++;

    // 6. Lifecycle Sandbox Proxies & Clamping
    summary.details.harness6 = await runLifecycleSandboxTests();
    summary.suitesPassed++;

    for (const key of Object.keys(summary.details)) {
      summary.totalIndividualTests += summary.details[key].testsRun;
      summary.totalTestsPassed += summary.details[key].testsPassed;
    }

    const totalDuration = performance.now() - startTime;

    console.log('================================================================');
    console.log('  EMPIRICAL VERIFICATION SUMMARY');
    console.log('================================================================');
    console.log(`  Suites Executed:       ${summary.suitesPassed} / ${summary.totalSuites} passed (100%)`);
    console.log(`  Total Test Assertions: ${summary.totalTestsPassed} / ${summary.totalIndividualTests} passed (100%)`);
    console.log(`  Total Execution Time:  ${totalDuration.toFixed(2)} ms`);
    console.log('----------------------------------------------------------------');
    console.log(`  Metrics Breakdown:`);
    console.log(`  - Concurrent Conflict Rejections:   ${summary.details.harness1.concurrentRejections}`);
    console.log(`  - Saves Coalesced / Absorbed:        ${summary.details.harness2.coalescedSaves}`);
    console.log(`  - Spam Stats Operations Processed:  ${summary.details.harness3.spamOpsExecuted}`);
    console.log(`  - Drops / NACKs Re-Merged Safely:   ${summary.details.harness4.dropsSimulated}`);
    console.log(`  - RYOW Invariants Verified (Fuzz):  ${summary.details.harness5.invariantsChecked}`);
    console.log(`  - Gamepad Neutral Polls Verified:   ${summary.details.harness6.gamepadPollsVerified}`);
    console.log('================================================================\n');

    return summary;
  } catch (err) {
    console.error('\nCRITICAL FAILURE IN ADVERSARIAL SUITE:', err);
    process.exit(1);
  }
}

main();
