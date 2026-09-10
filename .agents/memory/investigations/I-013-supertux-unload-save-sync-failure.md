---
type: Investigation
investigation_id: I-013
title: SuperTux Unload Save & Cloud Synchronization Failure
description: Diagnostic report into why SuperTux game saves do not save correctly and fail to trigger cloud synchronization when the game unloads.
start_date: "2026-09-11"
status: completed
result: substantiated
generated: { by: antigravity/3.7, at: 2026-09-11T00:11:00+05:30 }
sources:
  - id: supertux-template
    resource: /games/supertux/mk/emscripten/template.html.in
    title: SuperTux HTML/WASM Build Template
  - id: sdk-wasm
    resource: /sdk/src/storage/wasm.ts
    title: WGCP SDK WASM Storage Bridge
  - id: sdk-storage
    resource: /sdk/src/storage/index.ts
    title: WGCP SDK Storage Subsystem
  - id: portal-launcher
    resource: /portal/frontend/src/views/LauncherView.tsx
    title: Console Portal LauncherView Component
  - id: supertux-screenmgr
    resource: /games/supertux/src/supertux/screen_manager.cpp
    title: SuperTux Screen Manager Loop
  - id: supertux-emscripten
    resource: /games/supertux/src/port/emscripten.hpp
    title: SuperTux Emscripten Bindings
---

# Investigation Report (I-013) - SuperTux Unload Save & Cloud Synchronization Failure

## 1. Context & Symptoms

During SuperTux gameplay sessions inside the console portal, progress made immediately before navigating away, closing the tab, or clicking **Exit to Library** fails to persist to the platform backend database (`/api/v1/games/supertux/saves/gameState`). 

When returning to SuperTux in a subsequent session or private window:
1. The game boots with stale or missing save progress (e.g. newly unlocked levels or collected coins in `profile1/` are lost).
2. Network inspection confirms that no `WGCP_SAVE` RPC envelope or `POST /api/v1/games/supertux/saves/gameState` request is transmitted during the game teardown lifecycle.

---

## 2. Technical Diagnostics & Root Cause Analysis

An architectural and runtime lifecycle audit across the HTML build template,[^supertux-template] the SDK WASM storage bridge,[^sdk-wasm] and the console portal launcher[^portal-launcher] identified four compounding root causes:

### Root Cause A: Asynchronous Execution Cutoff During Browser `unload`
In `games/supertux/mk/emscripten/template.html.in`,[^supertux-template] teardown is handled via:
```javascript
window.addEventListener('unload', (e) => {
  try {
    Module.ccall("save_config", "void", [], []);
  } catch(e) {}
  supertux_saveFiles();
  if (wasmBridge) {
    wasmBridge.flush().catch(function() {});
  }
});
```
* When the portal user clicks **Exit to Library**, `LauncherView.tsx` unmounts the `<iframe />` element immediately.
* The browser synchronously executes the `unload` event handler.
* `wasmBridge.flush()` delegates to `saveNow()`, which invokes `calculateChecksum()` (`crypto.subtle.digest('SHA-256', ...)`).
* Because `calculateChecksum()` returns an asynchronous **Promise**, execution in the JavaScript microtask queue yields back to the browser.
* **The Browser Lifecycle Constraint**: W3C and browser specifications mandate that asynchronous microtasks, promises, IndexedDB transactions, and `window.parent.postMessage` channels initiated during `unload` are immediately aborted and terminated upon return of the synchronous call frame. The SDK's `getStorage().save()` and `postMessage('WGCP_SAVE')` are never reached.

### Root Cause B: Incomplete Engine State Flush on Teardown
* `Module.ccall("save_config", "void", [], [])` invokes `save_config()` in `emscripten.hpp`,[^supertux-emscripten] which only executes `g_config->save()`.
* This only writes global application settings (resolution, sound volume) to the virtual filesystem (`VFS`).
* The active game world map and sector progress (`save_state()` for `profile1/world1.stsg`) are not flushed to VFS during this teardown call.

### Root Cause C: `supertux_saveFiles()` Omits Profile Save State
* In `supertux_saveFiles()`, the call to `FS.syncfs()` is asynchronous (IDBFS) and thus cannot complete inside `unload`.
* The synchronous fallback function `save("config")` strictly writes `localStorage.setItem("supertux2_config", ...)` and omits all profile directories (`profile1/`, `profile2/`) where level statistics, coins, and world saves reside.

### Root Cause D: Debounced Sync Cancellation Race Window
* During active gameplay, `supertux2_syncfs()` in `screen_manager.cpp`[^supertux-screenmgr] schedules sync operations throttled by `debounceMs: 500`.
* If a player completes a level and immediately exits, the 500ms timer is pending.
* When `unload` triggers, `flush()` executes `clearTimeout(saveTimer)`, but because the subsequent asynchronous save is dropped by the browser, the in-flight state is lost.

---

## 3. Findings Summary

* **Finding F-005**: [SuperTux WASM Unload Save State Drop & Cloud Sync Failure](/findings/F-005-supertux-wasm-unload-cloud-sync-failure.md).

---

## 4. Remediation Architecture

To guarantee state persistence and reliable cloud synchronization on unload:

1. **Synchronous VFS Snapshotting to LocalStorage**:
   Update `supertux_saveFiles()` in `template.html.in` to recursively walk the VFS directory `/home/web_user/.local/share/supertux2/` and synchronously serialize all files (`profile1/*`, `config`) into `localStorage` during `unload`, `pagehide`, and `beforeunload`.
2. **PreRun LocalStorage Rehydration**:
   Enhance `supertux_loadFiles()` and the `Module.preRun` bootstrap sequence to restore all `supertux2_*` keys from `localStorage` back into VFS before engine initialization.
3. **Portal Graceful Exit Coordination (Pre-Exit Handshake)**:
   In `LauncherView.tsx`, introduce a coordinated teardown protocol (e.g. `WGCP_PREPARE_EXIT` RPC) that requests an explicit asynchronous `wasmBridge.flush()`, awaits `WGCP_SAVE_ACK`, and only unmounts the `<iframe />` after the cloud write completes or times out (with a 500ms budget).

[^supertux-template]: SuperTux HTML/WASM Build Template ([/games/supertux/mk/emscripten/template.html.in](/games/supertux/mk/emscripten/template.html.in))
[^sdk-wasm]: WGCP SDK WASM Storage Bridge ([/sdk/src/storage/wasm.ts](/sdk/src/storage/wasm.ts))
[^sdk-storage]: WGCP SDK Storage Subsystem ([/sdk/src/storage/index.ts](/sdk/src/storage/index.ts))
[^portal-launcher]: Console Portal LauncherView Component ([/portal/frontend/src/views/LauncherView.tsx](/portal/frontend/src/views/LauncherView.tsx))
[^supertux-screenmgr]: SuperTux Screen Manager Loop ([/games/supertux/src/supertux/screen_manager.cpp](/games/supertux/src/supertux/screen_manager.cpp))
[^supertux-emscripten]: SuperTux Emscripten Bindings ([/games/supertux/src/port/emscripten.hpp](/games/supertux/src/port/emscripten.hpp))
