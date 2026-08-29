---
type: Investigation
investigation_id: I-009
title: SuperTux Persistent Storage Request Failure
description: Diagnostic report into why the persistent storage permission prompt is not presented to the user during SuperTux gameplay.
start_date: "2026-08-28"
status: completed
result: substantiated
generated: { by: antigravity/3.5, at: 2026-08-28T22:30:00+05:30 }
verified: { by: human:vijaykoushik, at: 2026-08-29T08:58:00+05:30 }
sources:
  - id: launcherview-src
    resource: /portal/frontend/src/views/LauncherView.tsx
    title: LauncherView Component
  - id: supertux-template
    resource: /games/supertux/mk/emscripten/template.html.in
    title: SuperTux HTML Build Template
  - id: permission-e2e
    resource: /portal/frontend/e2e/permission.spec.ts
    title: E2E Permission Delegation Test
  - id: permission-test
    resource: /portal/frontend/src/tests/permissionDelegation.test.tsx
    title: Unit Permission Delegation Test
---

# Investigation Report (I-009) - SuperTux Persistent Storage Request Failure

## 1. Context & Symptoms

Following the platform refactoring to use a **viewport-first** game launching model (which resolved Fullscreen API activation race conditions), manual verification revealed that the **persistent storage permission request** from the `supertux` game inside the iframe is never presented to the user.

Under normal execution:
1. The user adds SuperTux to their library and clicks **Play Game**.
2. The game starts loading and executing WebAssembly inside a cross-origin `<iframe>` at `http://supertux.localhost`.
3. The game queries or requests storage persistence to configure its Emscripten IndexedDB File System (`IDBFS`) mount securely.
4. However, **no permission prompt is presented to the user**, and the storage persistence status defaults to denied/temporary, rendering the game data vulnerable to eviction under disk pressure.

---

## 2. Technical Diagnostics & Findings

An audit of the codebase, the game templates, and the test suite revealed two primary root causes and an integration gap:

### Finding A: Lack of Permission Delegation inside the Game
The console portal implements a postMessage-based permission delegation protocol in `LauncherView.tsx`[^launcherview-src] that listens for a custom RPC message `WGCP_REQUEST_PERMISSION`. 

However, the `supertux` game (built from `template.html.in`[^supertux-template]) has **no awareness of the WGCP protocol or the custom message schema**:
```javascript
// From games/supertux/mk/emscripten/template.html.in
var data_persistent = false;
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persists) => {
    if (!persists) {
      document.getElementById("data_warning").innerHTML = 'Your browser denied persistent data...';
    } else {
      data_persistent = true;
    }
  });
}
```
* **Consequence**: The game calls the browser's native `navigator.storage.persist()` API directly from the iframe window context instead of emitting a `WGCP_REQUEST_PERMISSION` message.
* **Browser Security Constraint**: In modern browsers (e.g., Firefox, Chrome), calls to `navigator.storage.persist()` within a **cross-origin iframe** (e.g., `supertux.localhost` embedded inside `localhost`) are blocked by default or silently resolve to `false` without displaying a prompt. This is a privacy safeguard to prevent cross-site fingerprinting/tracking.

### Finding B: Missing User Activation Context in the Portal Parent
Even if `supertux` (or another game) successfully emitted the `WGCP_REQUEST_PERMISSION` postMessage to the parent portal wrapper, the portal handles it asynchronously inside a `message` event listener:
```typescript
// From portal/frontend/src/views/LauncherView.tsx
const handleMessage = async (event: MessageEvent) => {
  ...
  if (type === 'WGCP_REQUEST_PERMISSION') {
    if (permission === 'persistent-storage') {
      granted = await navigator.storage.persist();
    }
  }
};
```
* **Consequence**: Asynchronous `message` events do **not** carry user activation (user gestures/clicks) in browsers.
* **Browser Prompt Constraint**: In browsers like Firefox, calling `navigator.storage.persist()` without a transient user gesture (such as a direct click) is silently rejected or resolves to `false` without ever presenting the permission prompt dialog to the user.

### Finding C: Green Test Fallacy (Mocks & E2E Testing Gaps)
The current test suite is green but hides the failure due to extensive mocking:
1. **E2E Test (`permission.spec.ts`[^permission-e2e])**:
   - The test manually *injects* an init script to override `navigator.storage.persist` inside the iframe to dispatch the `WGCP_REQUEST_PERMISSION` postMessage. This code only exists during test execution.
   - The test mocks `navigator.storage.persist` in the portal parent to immediately return `true`, completely bypassing real browser permission and user activation checks.
2. **Unit Test (`permissionDelegation.test.tsx`[^permission-test])**:
   - The test mocks `navigator.storage.persist` to return `true` / `false` programmatically and triggers a synthetic message event, hiding the user activation requirement.

---

## 3. Root Cause Summary

1. **Client / Game Level**: The game `supertux` has no integration shim or SDK to delegate its storage permission requests via the `postMessage` protocol to the parent portal wrapper, resulting in a blocked native request inside a cross-origin iframe.
2. **Platform / UX Level**: The parent portal executes `navigator.storage.persist()` immediately inside the async `message` callback which has no transient user activation context. As a result, the browser (specifically Firefox) silently denies the request without presenting the prompt dialog.

---

## 4. Proposed Solution Pathways

### Option 1: Portal Modal Request (Capture User Gesture)
When the parent portal receives `WGCP_REQUEST_PERMISSION`, instead of calling `navigator.storage.persist()` immediately inside the `message` callback:
1. Render a portal-level dialog or overlay (e.g. *"SuperTux requests persistent storage to save game progress. Allow?"*).
2. The user clicking **Allow** creates a valid user activation tick.
3. The click handler calls `navigator.storage.persist()`, successfully triggering the browser's native prompt or permission dialog, then dispatches the `WGCP_REQUEST_PERMISSION_ACK`.

### Option 2: Pre-request Storage Permission on Play Click
Since the platform is aware of the game's required capabilities (configured in `game.yaml` under `hosting.capabilities`[^supertux-template]):
1. When the user clicks the **Play Game** button (which is a valid user gesture on the parent page), immediately request `navigator.storage.persist()` *prior* to displaying the `LaunchSequence` transition.
2. Once resolved (granted or denied), launch the game iframe. This bypasses the need for late delegation.

### Option 3: Inject the Permission Shim in the Game Build
Update `games/supertux/mk/emscripten/template.html.in` to include the delegation code that forwards permission requests to the parent portal instead of calling native `navigator.storage.persist()` directly inside the iframe.

---

## 5. Resolution

We successfully resolved the issue by implementing a combination of **Option 1** and **Option 3**:
1. **Interactive Permission Modal Dialogue**: Added [`PermissionRequestOverlay.tsx`](/portal/frontend/src/components/PermissionRequestOverlay.tsx) to display a consent modal overlay on the portal parent context when a permission request is received.
2. **LauncherView Integration**: Refactored [`LauncherView.tsx`](/portal/frontend/src/views/LauncherView.tsx) to intercept `WGCP_REQUEST_PERMISSION`, extract origin settings dynamically, and display the consent modal. When the user selects **Allow**, the click-handler runs in the context of a valid user gesture/activation, allowing native `navigator.storage.persist()` to successfully trigger browser permissions.
3. **SuperTux build integration**: Overrode `navigator.storage.persist` in SuperTux's [`template.html.in`](/games/supertux/mk/emscripten/template.html.in) to intercept native persistent storage requests inside the iframe and dispatch them as `WGCP_REQUEST_PERMISSION` message envelopes with valid UUIDv4 correlation IDs to the portal page.
4. **E2E & Unit Test Hardening**: Corrected the correlation IDs to conform to strict UUIDv4 verification patterns and added simulated user click actions for the modals in [`permission.spec.ts`](/portal/frontend/e2e/permission.spec.ts), [`viewport.spec.ts`](/portal/frontend/e2e/viewport.spec.ts), and [`permissionDelegation.test.tsx`](/portal/frontend/src/tests/permissionDelegation.test.tsx).
5. All tests successfully passed, and manual verification confirmed the prompt displays and saves correctly.
