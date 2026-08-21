---
type: Investigation
title: Proposals Iterative Scrutiny
description: Three-round iterative paper audit of P-002 and P-003, analyzing the Emscripten FS bridge, binary data memory neutralization, telemetry snapshot security limits, and local vs. remote sync queue separation.
status: completed
investigation_id: I-008
start_date: "2026-08-21"
result: substantiated
sources:
  - id: p002-proposal
    resource: /proposals/P-002-game-sdk-storage-sync.md
    title: Game SDK & Portal Synchronization Specification
  - id: p003-proposal
    resource: /proposals/P-003-game-sdk-services-api.md
    title: Game Services API Specification
  - id: i007-proposal-security
    resource: /investigations/I-007-proposal-security-and-queue-audit.md
    title: Proposal Security, Race-Condition, and Queue Audit
---

# Investigation Report (I-008) - Proposals Iterative Scrutiny

This investigation documents a three-round iterative audit of the revised P-002 and P-003 specifications, examining the coupling of the Emscripten FS bridge, binary data memory constraints, the validity of client-side anti-cheat telemetry, and the logical boundaries of offline queues.

---

## 1. The Three-Round Audit Iteration

### Round 1: Baseline Review
We audited the newly added synchronization, settings, and queue structures. 
*   *Discovered Gap 1 (Emscripten Bridge):* P-002 §3.3 requires the SDK to call `FS.syncfs()` automatically, but Emscripten's `FS` object is privately scoped inside the game's compilation boundary. The SDK cannot access `FS` without global exports, causing runtime reference errors.
*   *Discovered Gap 2 (Binary Payload Cloning):* P-002 §3.2 supports `ArrayBuffer` payloads. However, passing large buffers over postMessage without defining a Transferable model forces structured cloning, blocking the main execution thread.
*   *Discovered Gap 3 (Telemetry Spoofing):* P-003 §3.3 introduces score verification tokens bound to client telemetry. However, because telemetry is emitted from the untrusted iframe, an attacker can spoof fake performance logs to justify a fake score.

### Round 2: Deep Validation
We checked these gaps against repository configurations and logical flows.
*   *Verification of Emscripten:* In `supertux`, the game handles `FS.syncfs` internally in its C++ lifecycle loops. Forcing the SDK to trigger `syncFS` creates a redundant coordination layer.
*   *Verification of Queue Eviction:* If `save` operations reject with `ERROR_QUEUE_FULL` during offline play, the local game cannot save its progress. However, browser IndexedDB storage has no 10-slot limit; only the portal's cloud sync pipeline is bounded. Capping the local write is a critical usability failure.

### Round 3: Pressure-Testing & Resolutions
*   *Resolution 1:* The SDK does not need a `syncFS()` method. The game engine should manage its own file flushing, and the SDK should only fetch the flushed database data.
*   *Resolution 2:* Separate local write resolution from remote sync queuing. `WGCP.storage.save` must always resolve successfully when written to local IndexedDB. The 10-slot offline limit should only cap the pending remote cloud sync tasks, not local save operations.
*   *Resolution 3:* Acknowledge that client-brokered score validation is not a secure anti-cheat. Leaderboards should use basic range checks on the backend or remain self-trusted.

---

## 2. Critical Gaps & Vulnerabilities

### 2.1. The Synchronous Emscripten `FS` Reference Leak
*   **The Flaw:** P-002 §3.3 and §5.3 expose `WGCP.syncFS()` and state it coordinates Emscripten's virtual filesystem syncing.
*   **Vulnerability:** In standard WebAssembly compilations, the `FS` library resides within a private closure. If the SDK script executes `FS.syncfs()`, the browser throws `ReferenceError: FS is not defined`. Forcing developers to export `FS` globally on `window` increases namespace clutter and security attack surfaces.
*   **Remediation:** Remove `WGCP.syncFS()` from the SDK interface. The game engine is responsible for syncing its own in-memory filesystem to browser IndexedDB, after which it calls `WGCP.storage.save()` normally.

### 2.2. Structured Clone Main-Thread Blocking (Large WASM Saves)
*   **The Flaw:** P-002 §3.2 native binary data support (`ArrayBuffer`/`Blob`) does not define a Transferable boundary.
*   **Vulnerability:** Sending a 50MB+ save buffer via `postMessage` forces the browser to run a structured clone. This blocks the single-threaded JS loop, causing game framerate stutters. If the SDK transfers the buffer (`postMessage(buf, origin, [buf])`), it neutralizes the game's in-memory array, causing subsequent read/writes to crash.
*   **Remediation:** Enforce that binary payloads are copied into intermediate worker threads, or explicitly declare that the SDK clones buffers asynchronously using stream buffers.

### 2.3. The Local Save vs. Remote Sync Queue Contradiction
*   **The Flaw:** Reaching the 10-slot queue limit in `P-002 §2.4` returns `ERROR_QUEUE_FULL` and rejects the save.
*   **Logical Failure:** Reverting a local write because the remote sync queue is full prevents the player from saving their game locally. IndexedDB has ample local storage space (~GBs); the 10-slot limit is only necessary to limit backend cloud sync database traffic.
*   **Remediation:** `WGCP.storage.save()` must always write and resolve successfully in local IndexedDB. The `ERROR_QUEUE_FULL` code should only apply to the background cloud sync task, warning the user that their data is saved locally but cannot be uploaded to the cloud until they reconnect.
