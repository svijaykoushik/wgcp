---
type: Finding
finding_id: F-005
title: SuperTux WASM Unload Save State Drop & Cloud Sync Failure
description: Asynchronous Promise execution during synchronous iframe unload causes SuperTux game progress and pending VFS writes to be dropped before cloud synchronization.
status: active
generated: { by: antigravity/3.7, at: 2026-09-11T00:11:00+05:30 }
sources:
  - id: supertux-template
    resource: /games/supertux/mk/emscripten/template.html.in
    title: SuperTux HTML/WASM Build Template
  - id: sdk-wasm
    resource: /sdk/src/storage/wasm.ts
    title: WGCP SDK WASM Storage Bridge
  - id: portal-launcher
    resource: /portal/frontend/src/views/LauncherView.tsx
    title: Console Portal LauncherView Component
  - id: i013-investigation
    resource: /investigations/I-013-supertux-unload-save-sync-failure.md
    title: SuperTux Unload Save & Cloud Synchronization Failure
  - id: p005-proposal
    resource: /proposals/P-005-configurable-sdk-initialization-and-escape-forwarding.md
    title: Configurable SDK Initialization Proposal
---

# Finding (F-005) - SuperTux WASM Unload Save State Drop & Cloud Sync Failure

## 1. Description & Context

When running SuperTux inside the console portal wrapper (`LauncherView.tsx`),[^portal-launcher] game state modifications (level completion, collected coins, world progress) made immediately prior to quitting fail to synchronize to the backend database (`POST /api/v1/games/supertux/saves/gameState`).

---

## 2. Root Cause Analysis

1. **Synchronous Unload vs. Asynchronous Promises**:
   In `games/supertux/mk/emscripten/template.html.in:714-722`,[^supertux-template] the `unload` handler invokes `wasmBridge.flush()`, which calls `saveNow()` in `sdk/src/storage/wasm.ts`.[^sdk-wasm] `saveNow()` executes `await calculateChecksum(...)` (Web Crypto API SHA-256). Because browser `unload` handlers do not await asynchronous Promises, the browser terminates the iframe context before `getStorage().save()` or `window.parent.postMessage('WGCP_SAVE')` can be dispatched.
2. **Incomplete LocalStorage Fallback**:
   The legacy `supertux_saveFiles()` fallback in `template.html.in:540-560` only synchronously writes `supertux2_config` to `localStorage`. Profile directories (`profile1/`, `profile2/`) containing level saves (`world1.stsg`, `stats`) are completely skipped.
3. **Abrupt Iframe Removal**:
   In `LauncherView.tsx:607-631`, clicking "Exit to Library" immediately destroys the iframe without coordinating a graceful teardown handshake.

---

## 3. Impact

* Players lose in-game progress if they exit shortly after beating a level or picking up items.
* Cross-device and private-session state rehydration fails for recently played SuperTux sessions.

---

## 4. Remediation Plan

1. **Synchronous VFS Snapshotting**: Update `template.html.in` to synchronously snapshot all files under `/home/web_user/.local/share/supertux2/` into `localStorage` on `unload`, `pagehide`, and `beforeunload`.
2. **Restore on Boot**: Enhance `template.html.in` `preRun` to rehydrate all `supertux2_*` keys from `localStorage` into the Emscripten VFS on boot.
3. **Portal Exit Coordination**: Introduce a pre-exit handshake in `LauncherView.tsx` to allow in-flight WASM bridge saves to complete before unmounting the iframe.

[^supertux-template]: SuperTux HTML/WASM Build Template ([/games/supertux/mk/emscripten/template.html.in](/games/supertux/mk/emscripten/template.html.in))
[^sdk-wasm]: WGCP SDK WASM Storage Bridge ([/sdk/src/storage/wasm.ts](/sdk/src/storage/wasm.ts))
[^portal-launcher]: Console Portal LauncherView Component ([/portal/frontend/src/views/LauncherView.tsx](/portal/frontend/src/views/LauncherView.tsx))
[^i013-investigation]: SuperTux Unload Save & Cloud Synchronization Failure ([/investigations/I-013-supertux-unload-save-sync-failure.md](/investigations/I-013-supertux-unload-save-sync-failure.md))
[^p005-proposal]: Configurable SDK Initialization Proposal ([/proposals/P-005-configurable-sdk-initialization-and-escape-forwarding.md](/proposals/P-005-configurable-sdk-initialization-and-escape-forwarding.md))
