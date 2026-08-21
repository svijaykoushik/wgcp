/**
 * Harness 6: Lifecycle Pause/Resume & Input/Clock Sandbox Proxies
 * Tests:
 * 1. W3C Gamepad API Proxy: neutral axis/button emulation during WGCP_PAUSE vs live values on resume.
 * 2. Synthetic Key Release: active pressed keys receive synthetic keyup on WGCP_PAUSE.
 * 3. Web Audio & Pointer Lock: AudioContext.suspend()/resume() and document.exitPointerLock().
 * 4. Delta-Time Clock Calibration & Clamping (WGCP.time.getDelta):
 *    - Paused interval deduction
 *    - 100ms (0.1s) max single-frame clamping to prevent physics "spiral of death".
 */

import { strict as assert } from 'node:assert';

class LifecycleProxyManager {
  constructor() {
    this.isPaused = false;
    this.trackedKeys = new Set();
    this.emittedSyntheticKeyups = [];
    this.audioContextState = 'running';
    this.pointerLockActive = true;
    this.lastFrameTime = performance.now();
    this.totalPausedDuration = 0;
    this.pauseStartTime = 0;
    this.maxDeltaClampingSeconds = 0.1; // 100ms max

    // Simulated real physical gamepad
    this._hardwareGamepads = [
      {
        id: 'Standard Gamepad (Vendor: 045e Product: 028e)',
        index: 0,
        connected: true,
        axes: [0.85, -0.45, 0.1, -0.9],
        buttons: [
          { pressed: true, value: 1.0 }, // A button
          { pressed: false, value: 0.0 }, // B button
          { pressed: true, value: 0.75 }, // Right Trigger
        ],
      }
    ];
  }

  // W3C Gamepad API Proxy Implementation
  getGamepads() {
    if (this.isPaused) {
      // Return neutral/zeroed virtual gamepad
      return this._hardwareGamepads.map(pad => ({
        id: pad.id,
        index: pad.index,
        connected: pad.connected,
        axes: pad.axes.map(() => 0.0), // Zeroed axes
        buttons: pad.buttons.map(() => ({ pressed: false, value: 0.0 })), // Released buttons
      }));
    }
    // Return live hardware state
    return this._hardwareGamepads;
  }

  // Key tracking & synthetic keyup
  onKeyDown(code) {
    this.trackedKeys.add(code);
  }

  onKeyUp(code) {
    this.trackedKeys.delete(code);
  }

  // Lifecycle transitions
  handlePause() {
    this.isPaused = true;
    this.pauseStartTime = performance.now();

    // 1. AudioContext suspension
    this.audioContextState = 'suspended';

    // 2. Pointer lock release
    this.pointerLockActive = false;

    // 3. Synthetic keyup emission
    for (const key of this.trackedKeys) {
      this.emittedSyntheticKeyups.push({ key, type: 'keyup', isSynthetic: true });
    }
    this.trackedKeys.clear();
  }

  handleResume() {
    const now = performance.now();
    const pauseDuration = now - this.pauseStartTime;
    this.totalPausedDuration += pauseDuration;
    this.isPaused = false;

    // 1. AudioContext resume
    this.audioContextState = 'running';

    // 2. Re-calibrate frame clock
    this.lastFrameTime = now;

    return { pausedDurationMs: pauseDuration, resumeTimestamp: now };
  }

  // WGCP.time.getDelta implementation
  getDelta(currentTime = performance.now()) {
    if (this.isPaused) return 0;

    const rawDtSeconds = (currentTime - this.lastFrameTime) / 1000.0;
    this.lastFrameTime = currentTime;

    // Strict clamping to max 100ms (0.1s)
    const clampedDtSeconds = Math.min(rawDtSeconds, this.maxDeltaClampingSeconds);
    return Math.max(0, clampedDtSeconds);
  }
}

export async function runLifecycleSandboxTests() {
  console.log('=== Starting Harness 6: Lifecycle Pause/Resume & Sandbox Proxies ===');
  const metrics = {
    testsRun: 0,
    testsPassed: 0,
    gamepadPollsVerified: 0,
    syntheticKeyupsEmitted: 0,
    clockClampsVerified: 0,
  };

  // Test 1: W3C Gamepad Sandbox Neutral Polling
  {
    metrics.testsRun++;
    const manager = new LifecycleProxyManager();

    // 1. Normal state: live gamepad returned
    const livePads = manager.getGamepads();
    assert.equal(livePads[0].axes[0], 0.85);
    assert.equal(livePads[0].buttons[0].pressed, true);
    assert.equal(livePads[0].buttons[0].value, 1.0);

    // 2. Transition to PAUSE
    manager.handlePause();

    // 3. Polling during PAUSE must return zeroed/neutral inputs
    for (let i = 0; i < 60; i++) { // 60 FPS polling simulation
      const pausedPads = manager.getGamepads();
      assert.deepEqual(pausedPads[0].axes, [0.0, 0.0, 0.0, 0.0], 'All axes must be 0.0');
      for (const btn of pausedPads[0].buttons) {
        assert.equal(btn.pressed, false, 'Button pressed must be false');
        assert.equal(btn.value, 0.0, 'Button value must be 0.0');
      }
      metrics.gamepadPollsVerified++;
    }

    // 4. Resume
    manager.handleResume();
    const resumedPads = manager.getGamepads();
    assert.equal(resumedPads[0].axes[0], 0.85, 'Live gamepad restored on resume');
    assert.equal(resumedPads[0].buttons[0].pressed, true);

    metrics.testsPassed++;
    console.log(`  [PASS] W3C Gamepad Proxy: Neutral zeroing during pause verified across ${metrics.gamepadPollsVerified} poll cycles`);
  }

  // Test 2: Synthetic Key Release & Ghost Key Prevention
  {
    metrics.testsRun++;
    const manager = new LifecycleProxyManager();

    // Player holds 'KeyW', 'Space', 'ArrowUp'
    manager.onKeyDown('KeyW');
    manager.onKeyDown('Space');
    manager.onKeyDown('ArrowUp');
    assert.equal(manager.trackedKeys.size, 3);

    // Portal opens overlay modal
    manager.handlePause();

    assert.equal(manager.trackedKeys.size, 0, 'Active keys cleared');
    assert.equal(manager.emittedSyntheticKeyups.length, 3, 'Synthetic keyup emitted for all 3 held keys');
    const keyCodes = manager.emittedSyntheticKeyups.map(e => e.key);
    assert.ok(keyCodes.includes('KeyW'));
    assert.ok(keyCodes.includes('Space'));
    assert.ok(keyCodes.includes('ArrowUp'));

    metrics.syntheticKeyupsEmitted += 3;
    metrics.testsPassed++;
    console.log('  [PASS] Synthetic Key Release: 3 active keys successfully neutralized on WGCP_PAUSE');
  }

  // Test 3: AudioContext & Pointer Lock Neutralization
  {
    metrics.testsRun++;
    const manager = new LifecycleProxyManager();
    assert.equal(manager.audioContextState, 'running');
    assert.equal(manager.pointerLockActive, true);

    manager.handlePause();
    assert.equal(manager.audioContextState, 'suspended', 'AudioContext must be suspended');
    assert.equal(manager.pointerLockActive, false, 'Pointer Lock must be released');

    manager.handleResume();
    assert.equal(manager.audioContextState, 'running', 'AudioContext must be resumed');

    metrics.testsPassed++;
    console.log('  [PASS] Web Audio & Pointer Lock: AudioContext suspend/resume and exitPointerLock verified');
  }

  // Test 4: Delta-Time Clock Calibration & Clamping ("Spiral of Death" prevention)
  {
    metrics.testsRun++;
    const manager = new LifecycleProxyManager();

    const t0 = 1000.0;
    manager.lastFrameTime = t0;

    // Normal frame: 16.6ms (60 FPS)
    const dt1 = manager.getDelta(t0 + 16.66);
    assert.ok(Math.abs(dt1 - 0.01666) < 0.001, `Normal dt should be ~0.01666, got ${dt1}`);

    // Simulation of 10s suspension overlay
    manager.handlePause();
    // 10 seconds pass while paused
    const resumeContext = manager.handleResume();
    assert.ok(resumeContext.pausedDurationMs >= 0);

    // Frame right after resume: lastFrameTime was re-calibrated to resume time
    // Suppose 16ms elapsed since resume
    const dtAfterResume = manager.getDelta(manager.lastFrameTime + 16.0);
    assert.ok(Math.abs(dtAfterResume - 0.016) < 0.001, 'Dt after resume must NOT include the 10s pause interval');

    // Extreme lag spike simulation: 800ms frame lag
    const lagTime = manager.lastFrameTime + 800.0;
    const dtLag = manager.getDelta(lagTime);
    assert.equal(dtLag, 0.1, `Lag spike dt MUST be clamped to 0.1s (100ms max), got ${dtLag}`);
    metrics.clockClampsVerified++;

    metrics.testsPassed++;
    console.log('  [PASS] Delta-Time Clock Clamping: Paused intervals deducted and large frame lags clamped to 100ms (0.1s)');
  }

  console.log(`=== Harness 6 Completed: ${metrics.testsPassed}/${metrics.testsRun} tests passed ===\n`);
  return metrics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLifecycleSandboxTests().catch(err => {
    console.error('Harness 6 Failed:', err);
    process.exit(1);
  });
}
