# Proposals Update Log

## 2026-08-29
* **Status**: Updated proposals [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) and [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) status to `accepted` after completing the platform feasibility investigation and removing obsolete `WGCP.syncFS()` namespace leaks to align with the private compilation boundaries of WASM/Emscripten games.

## 2026-08-28
* **Status**: Updated proposal [`P-004-game-launch-refactor.md`](/proposals/P-004-game-launch-refactor.md) status to `accepted` following implementation and E2E test validation.

## 2026-08-27
* **Creation**: Added proposal file [`P-004-game-launch-refactor.md`](/proposals/P-004-game-launch-refactor.md) outlining the viewport-first game launch refactoring.

## 2026-08-21
* **Update**: Revised [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to bind the leaderboard score-verification token to a telemetry snapshot and define single-use/expiry and offline-queue-exclusion rules, per findings in [`I-006-leaderboard-identity-boundary-audit.md`](/investigations/I-006-leaderboard-identity-boundary-audit.md).
* **Update**: Revised [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) to require `event.source`-only game identity derivation (removing the unsound `document.activeElement` alternative) and to exclude untrusted-claim calls from the offline sync queue, per findings in [`I-006-leaderboard-identity-boundary-audit.md`](/investigations/I-006-leaderboard-identity-boundary-audit.md).
* **Update**: Revised [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to trim the game-facing telemetry surface (dropping `gameLoadingFinished`/`gameplayStart`/`gameplayStop` in favor of portal-derived lifecycle signals) and to codify `gameId` derivation from `event.source` across all service modules, per findings in [`I-005-sdk-completeness-and-boundary-scrutiny.md`](/investigations/I-005-sdk-completeness-and-boundary-scrutiny.md).
* **Update**: Revised [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) to fix a proven offline-sync data-loss failure mode by introducing dirty-state tracking and explicit conflict intervention, and to document the rejection of a transparent `localStorage` interceptor, per findings in [`I-005-sdk-completeness-and-boundary-scrutiny.md`](/investigations/I-005-sdk-completeness-and-boundary-scrutiny.md).

## 2026-08-18
* **Update**: Expanded [`P-003-game-sdk-services-api.md`](file://./P-003-game-sdk-services-api.md) to integrate stats, progressions, and personal best tracking modules.
* **Creation**: Added proposal file [`P-003-game-sdk-services-api.md`](file://./P-003-game-sdk-services-api.md) defining the Game Services API Specification.

## 2026-08-17
* **Update**: Revised [`P-002-game-sdk-storage-sync.md`](file://./P-002-game-sdk-storage-sync.md) to integrate review feedback on security trust boundaries, monotonic revisions, storage tiering, identity migration, and API design.
* **Creation**: Added proposal file [`P-002-game-sdk-storage-sync.md`](file://./P-002-game-sdk-storage-sync.md) defining the Game SDK & Portal Synchronization Specification.

## 2026-08-15
* **Creation**: Added proposal file [`P-001-game-registry-spec-v2.md`](file://./P-001-game-registry-spec-v2.md) tracking the accepted Game Registry Specification (v2).
