---
type: Investigation
title: Proposal Security, Race-Condition, and Queue Audit
description: Advanced audit of P-002 and P-003 focusing on postMessage origin hijacking, pending promise stacking during conflict overlays, queue namespace sharing conflicts, and guest-to-user session migration race conditions.
status: completed
investigation_id: I-007
start_date: "2026-08-21"
result: substantiated
sources:
  - id: p002-proposal
    resource: /proposals/P-002-game-sdk-storage-sync.md
    title: Game SDK & Portal Synchronization Specification
  - id: p003-proposal
    resource: /proposals/P-003-game-sdk-services-api.md
    title: Game Services API Specification
  - id: i006-boundary-audit
    resource: /investigations/I-006-leaderboard-identity-boundary-audit.md
    title: Leaderboard & Identity Boundary Audit
---

# Investigation Report (I-007) - Proposal Security, Race-Condition, and Queue Audit

This investigation reports on the security controls, asynchronous race conditions, queue management boundaries, and session migration synchronizations proposed in P-002 and P-003, expanding on the boundary audit in [`I-006`](/investigations/I-006-leaderboard-identity-boundary-audit.md).

---

## 1. postMessage Hijacking & Dynamic Origin Risks

*   **SDK Parent Origin Verification:** [P-002 §1.2](/proposals/P-002-game-sdk-storage-sync.md#L40-L42) allows the SDK to dynamically infer the portal host from the parent environment (e.g. `document.referrer`). This is a security risk: if the game iframe is embedded inside a malicious parent frame (e.g. `http://attacker.com`), `document.referrer` resolves to the attacker's domain. The SDK will then trust the attacker's window as the console portal, allowing the attacker to spoof RPC calls and read/write player IndexedDB storage.
*   **Portal Origin Validation:** Loose regex matching or substring checks on `event.origin` in the portal wrapper can be bypassed (e.g., `http://browserquest.localhost.attacker.com` matching `browserquest.localhost`).
*   **Remediation:** Banish dynamic origin inference from the SDK. Force origin checks against an explicit whitelist. The portal must enforce exact hostname matches via the browser's native `URL` parser.

---

## 2. Namespace & Contract Clashes

*   **Conflict:** [P-002 §5.3](/proposals/P-002-game-sdk-storage-sync.md#L176-L212) registers flat SDK methods (e.g. `submitScore(score, metadata)`), whereas [P-003 §3](/proposals/P-003-game-sdk-services-api.md#L78-L204) defines nested modules (e.g. `WGCP.leaderboards.submitScore(leaderboardId, score, metadata)`).
*   **Logical Failure:** The flat P-002 signature completely omits the `leaderboardId` parameter. Developers writing code against P-002 will build configurations that crash or fail backend verification due to missing parameters.
*   **Remediation:** Remove flat service methods from P-002. Enforce a single nested namespace contract matching P-003.

---

## 3. Asynchronous Promise Stacking & UI Input leaks

*   **Stacked Pending Promises:** When a save conflict arises, the portal halts the `saveState` promise while presenting the conflict UI. If the game continues saving in the background, pending promises stack in memory. If the player chooses to keep the cloud save, subsequent resolutions of these stacked promises can overwrite the cloud save.
*   **Input leaks:** Opening the portal overlay does not halt the iframe's internal game execution loop, allowing inputs to leak.
*   **Remediation:** Implement state-locking in the SDK. Reject further save calls with `ERROR_SYNC_PENDING_RESOLUTION` while conflict UI is open. Trigger `WGCP_PAUSE` and `WGCP_RESUME` events to pause game loops, and apply `inert` to the iframe.

---

## 4. Queue Management Boundaries

*   **Vulnerability:** P-003 specifies that "Player Stats" updates are queued offline, but fails to define a separate stats queue. If stats and save states share the same 10-slot offline queue (`P-002 §2.4`), a rapid series of stat increments (e.g. `gold += 1`) will evict the player's core `saveState` updates, causing silent data loss.
*   **Remediation:** Explicitly partition the offline queue. Mandate a separate Stats Queue that applies in-memory delta aggregation (merging multiple updates for the same stat ID to occupy exactly 1 queue slot).

---

## 5. Guest-to-User Session Migration Race Conditions

*   **Vulnerability:** When a guest logs in, the migration pipeline (`associateAnonymousAccount`) and auth change signal (`onPlayerChanged`) execute concurrently without synchronization. If the game client triggers `loadState()` upon auth change before the database migration finishes, it will pull the empty cloud save and overwrite the newly migrated guest progress.
*   **Remediation:** Enforce sequential phase-locking. The portal must wait for the migration transaction to resolve before triggering the `onPlayerChanged` callback to the SDK.
