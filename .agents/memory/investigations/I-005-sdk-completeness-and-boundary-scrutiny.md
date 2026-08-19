---
type: Investigation
title: WGCP SDK Completeness and Boundary Scrutiny
description: Rigorous architectural completeness audit, offline sync data-loss proof, localStorage proxy trade-offs, and communication boundary verification for P-002 and P-003.
status: completed
investigation_id: I-005
start_date: 2026-08-19
result: substantiated
sources:
  - id: p002-proposal
    resource: /proposals/P-002-game-sdk-storage-sync.md
    title: Game SDK & Portal Synchronization Specification
  - id: p003-proposal
    resource: /proposals/P-003-game-sdk-services-api.md
    title: Game Services API Specification
  - id: launcherview-src
    resource: /portal/frontend/src/views/LauncherView.tsx
    title: LauncherView Frontend Source Code
---

# Investigation Report (I-005) - WGCP SDK Completeness and Boundary Scrutiny

This investigation documents the architectural audit, offline synchronization failure modes, `localStorage` proxy tradeoffs, and boundary verification conducted for the proposed Web Game Console Platform (WGCP) Game SDK specifications (P-002 and P-003).

---

## 1. Proven Monotonic Revision Offline Data-Loss Bug

The startup synchronization and revision sequencing proposed in [P-002](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/.agents/memory/proposals/P-002-game-sdk-storage-sync.md) contains an operational failure mode that guarantees user data loss during offline-to-online transitions:

1.  **Sync Trigger:** P-002 Section 2.2 dictates that if `Cloud Revision > Local Revision`, the SDK automatically pulls the cloud payload (`WGCP_LOAD`) and overwrites the local cache. If `Local Revision >= Cloud Revision`, it loads from local cache.
2.  **Offline State:** While playing offline, the client cannot communicate with the server to increment the monotonic revision number. Thus, all offline progress writes are saved to the local cache (IndexedDB) under the last known server revision (e.g., `Rev 10`).
3.  **Conflict Scenario:**
    *   **Device A (Offline):** Player progresses from Level 1 to Level 10. The state is written to cache under `Rev 10`.
    *   **Device B (Online):** Player logs in, loads the `Rev 10` (Level 1) cloud save, progresses to Level 2, and saves online. The server increments the state to `Rev 11`.
    *   **Device A Reconnection:** Device A goes online. The handshake reports `Cloud Revision = 11`. The SDK compares:
        *   `Device A Local Revision = 10`
        *   `Cloud Revision = 11`
    *   **Failure:** Because `11 > 10`, the SDK assumes the cloud state is newer, requests the cloud payload, and overwrites Device A's local cache. The player's offline Level 10 progress is permanently and silently erased.

---

## 2. Re-Evaluation of the `localStorage` Interceptor

We evaluated the architectural trade-offs of introducing a transparent `localStorage` interceptor to reduce porting friction:

1.  **Sync-to-Async Impedance Mismatch:** Standard `localStorage` is synchronous, but platform database storage is asynchronous. A transparent interceptor requires pre-fetching and caching the entire storage dictionary into memory during handshake, creating memory overhead and startup blocking delays.
2.  **Semantic Safety Violations:** Intercepting all `localStorage` calls causes device-specific configurations (like window scaling, graphic settings, or local sound volume) to be cloud-synced across devices, corrupting layout and preferences.
3.  **Refactoring Realities:** Auditing our active catalog (`2048`, `A Dark Room`, `Hextris`) revealed that games do **not** require game loop rewrites to support asynchronous `WGCP.storage.*`. Simple asynchronous entry-point scripts loading state before instantiating the game engine are sufficient.
4.  **Consensus:** The `localStorage` interceptor is rejected as a core SDK capability. `WGCP.storage.*` will serve as the sole, canonical asynchronous storage contract.

---

## 3. Communication Boundary Scrutiny

We audited the five core capabilities of P-003 to determine if they require explicit game-facing SDK methods or if they can be derived entirely by the portal host:

*   **`gameLoadingFinished`:** Derived by the portal wrapper listening to the iframe DOM `onLoad` attribute (as shown in [`LauncherView.tsx:L177`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/portal/frontend/src/views/LauncherView.tsx#L177)). No explicit SDK call is needed.
*   **`gameplayStart` & `gameplayStop`:** Derived by the portal wrapper tracking focus and blur events on the iframe. When focus enters the iframe, the portal disables its spatial key listeners and pauses background music. When focus leaves, listeners are re-enabled. No telemetry calls are needed.
*   **Game Identity & Origin Verification:** Derived contextually by the portal matching the immutable `event.source` reference of the postMessage event against the content window references of spawned iframe elements. Specifying `gameId` in the payload is redundant and represents a security loophole.
*   **Initialization/Handshake:** Handled implicitly on the first storage call. An explicit `init()` function is redundant.

---

## 4. Minimum Communication Contract

Offloading lifecycle, telemetry, identity matching, and handshakes to the portal wrapper reduces the game-facing integration contract to **only the persistence channel**:

```typescript
window.WGCP = {
  storage: {
    save: function(slot, data) { ... }, // Returns Promise<void>
    load: function(slot) { ... }       // Returns Promise<any>
  }
};
```
This represents the minimal justified communication surface between a game and the WGCP console.
