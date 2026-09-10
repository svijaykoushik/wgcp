---
type: Decision
decision_id: D-009
title: Adopt Graceful Game Exit Handshake Protocol (WGCP_PREPARE_EXIT)
description: Decision to implement a coordinated portal-to-game teardown RPC handshake (WGCP_PREPARE_EXIT) with a 600ms safety budget and automated WASM storage flush to prevent save data loss during iframe unmounts.
status: accepted
generated: { by: antigravity/3.7, at: 2026-09-11T00:17:00+05:30 }
sources:
  - id: p007-exit-handshake
    resource: /proposals/P-007-graceful-game-exit-handshake-protocol.md
    title: Graceful Game Exit Handshake Protocol (WGCP_PREPARE_EXIT)
  - id: i013-unload-investigation
    resource: /investigations/I-013-supertux-unload-save-sync-failure.md
    title: SuperTux Unload Save & Cloud Synchronization Failure
  - id: f005-unload-finding
    resource: /findings/F-005-supertux-wasm-unload-cloud-sync-failure.md
    title: SuperTux WASM Unload Save State Drop & Cloud Sync Failure
  - id: portal-launcherview
    resource: /portal/frontend/src/views/LauncherView.tsx
    title: Console Portal LauncherView Component
  - id: sdk-wasm
    resource: /sdk/src/storage/wasm.ts
    title: WGCP SDK WASM Storage Bridge
---

# Architectural Decision Record (D-009) - Adopt Graceful Game Exit Handshake Protocol (`WGCP_PREPARE_EXIT`)

## 1. Context & Problem

In investigation **I-013**[^i013-unload-investigation] and finding **F-005**,[^f005-unload-finding] we diagnosed that clicking **Exit to Library** in the console portal ([`LauncherView.tsx`](/portal/frontend/src/views/LauncherView.tsx))[^portal-launcherview] immediately destroyed the game `<iframe />`. 

Because browser `unload` events are strictly synchronous, any asynchronous save operations (such as the WASM bridge's `saveNow()` SHA-256 calculation,[^sdk-wasm] IndexedDB writes, or `postMessage('WGCP_SAVE')`) were killed by the browser before reaching the backend API. Consequently, recently accumulated game progress and level unlocks were lost.

---

## 2. Decision

We have formally accepted and adopted **Proposal P-007: Graceful Game Exit Handshake Protocol (`WGCP_PREPARE_EXIT`)**.[^p007-exit-handshake]

Specifically:
1. **Bidirectional RPC Teardown Contract**:
   * Portal emits `WGCP_PREPARE_EXIT` with correlation ID and `timeoutMs: 600`.
   * Game SDK receives `WGCP_PREPARE_EXIT`, triggers `wasmBridge.flush()`, executes custom `onPrepareExit` callbacks, and replies with `WGCP_PREPARE_EXIT_ACK`.
2. **Coordinated Portal Teardown**:
   * In `LauncherView.tsx`, the portal displays a brief saving transition, dispatches `WGCP_PREPARE_EXIT`, and waits up to 600ms for `WGCP_PREPARE_EXIT_ACK` before unmounting the iframe.
3. **Safety Timeout Budget (600ms)**:
   * If a hosted game is non-responsive or runs an older SDK version, the 600ms timeout budget expires and navigation proceeds without hanging the portal UI.
4. **Public SDK Extension**:
   * Expose `WGCP.system.onPrepareExit(callback)` allowing hosted games to register asynchronous teardown logic.

---

## 3. Consequences & Invariants

* **Positive Consequences**:
  - Eliminates the asynchronous Promise race condition during game exit across all hosted games.
  - Guarantees that pending VFS and IndexedDB save states are fully written to PostgreSQL before container/iframe detachment.
  - Preserves responsive portal UX with bounded 600ms maximum wait time.
* **Invariants**:
  - All portal teardown actions must coordinate through `WGCP_PREPARE_EXIT` prior to DOM unmounting.

---

[^p007-exit-handshake]: Graceful Game Exit Handshake Protocol (`/proposals/P-007-graceful-game-exit-handshake-protocol.md`)
[^i013-unload-investigation]: SuperTux Unload Save & Cloud Synchronization Failure (`/investigations/I-013-supertux-unload-save-sync-failure.md`)
[^f005-unload-finding]: SuperTux WASM Unload Save State Drop & Cloud Sync Failure (`/findings/F-005-supertux-wasm-unload-cloud-sync-failure.md`)
[^portal-launcherview]: Console Portal LauncherView Component (`/portal/frontend/src/views/LauncherView.tsx`)
[^sdk-wasm]: WGCP SDK WASM Storage Bridge (`/sdk/src/storage/wasm.ts`)
