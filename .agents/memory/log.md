# Directory Update Log

## 2026-09-02
* **Investigation**: Added [`I-011-supertux-wasm-docker-build-optimization.md`](/investigations/I-011-supertux-wasm-docker-build-optimization.md) diagnosing the monolithic SuperTux Docker build and decoupling the fast HTML/SDK template generation from the 20-minute C++ WASM compilation.
* **Specification**: Extended [`memory_spec.md`](/memory_spec.md) to define the `Roadmap` concept type and authoring guidelines under OKF v0.2.
* **Creation**: Added [`roadmap.md`](/roadmap.md) defining the focus-anchored platform architecture roadmap covering completed Phases 1-4, active Phase 5 (WASM & Emscripten Storage Bridge), planned Phase 6, and deferred Phase 7.
* **Index**: Registered [`roadmap.md`](/roadmap.md) under Core Concepts in [`index.md`](/index.md).

## 2026-09-01
* **Creation**: Added decision [`D-007-cloud-fallback-and-local-save-migration.md`](/decisions/D-007-cloud-fallback-and-local-save-migration.md) implementing transparent cloud fallback state hydration, legacy local save migration, and game container rebuild invariants.
* **Implementation**: Wired `WGCP_LOAD` and `WGCP_STATS_GET` RPC query paths through `LauncherView.tsx` and the standalone SDK (`sdk/src/storage/index.ts`, `sdk/src/stats/index.ts`) to ensure full cloud state rehydration on local cache miss.
* **Migration**: Updated BrowserQuest, 2048, Hextris, and A Dark Room to auto-migrate pre-existing local storage data to PostgreSQL on initial SDK boot.
* **Fix**: Hooked direct property storage mutations (`localStorage.data = ...`) in BrowserQuest `storage.js` directly to `WGCP.storage.save('data', ...)`.

## 2026-08-31
* **Creation**: Added decision [`D-006-epoch-timestamp-and-sdk-invariants.md`](/decisions/D-006-epoch-timestamp-and-sdk-invariants.md) establishing schema 64-bit integer timestamp typing (`bigint`), SDK feature centralization, Docker container rebuild lifecycles, and E2E test database state isolation.
* **Testing & Verification**: Created and expanded the comprehensive Playwright E2E integration test suite (`portal/frontend/e2e/sdk-integrations.spec.ts`) validating save rehydration, statistics updates, achievements unlocks, and Escape forwarding across 2048, Hextris, A Dark Room, and BrowserQuest.
* **Fix**: Resolved Postgres 32-bit integer overflow exception by migrating timestamp columns across saves, achievements, stats, leaderboards, and progression tables to `bigint("...", { mode: "number" })`.
* **Fix**: Updated backend Express server timestamp allocations to consistently write millisecond-precision epochs.
* **Fix**: Added missing `DELETE /api/v1/games/:gameId/saves/:slot` endpoint in `portal/backend/src/server.ts` to allow cloud save deletions by both the SDK and automated test cleanups.

## 2026-08-29
* **Integration**: Integrated local-storage testbed games (**2048**, **Hextris**, and **A Dark Room**) and RequireJS/WebSocket-based MMORPG (**BrowserQuest**) with the standalone WGCP SDK.
  * Configured asynchronous save rehydration on game start before bootstrap/application instantiation.
  * Overrode and intercepted local storage operations to seamlessly pipe save sync states back to the platform cloud storage database.
  * Connected BrowserQuest's client telemetry tracking directly to the P-003 telemetry APIs, synchronization metrics, and leaderboards, including awarding progression XP for kills and unlocking achievements.
* **Feasibility**: Assessed and successfully folded capturing-phase "Escape key forwarding" logic into the core SDK initialization (`WGCP.init`), automatically forwarding `WGCP_TOGGLE_MENU` events to the parent portal wrapper.
* **Update**: Decoupled the built SDK from the portal frontend container entirely, removing `portal/frontend/public/wgcp-sdk.js` and updating `/sdk/package.json` to copy assets solely to the Caddy-mounted gateway path.
* **Refactoring**: Standardized and optimized UUIDv4 generation across all SDK files (`index.ts`, `storage/index.ts`, `stats/index.ts`, `services/index.ts`) to query browser `crypto.randomUUID` and `crypto.getRandomValues` first, before falling back to custom pseudo-random math generators. Replaced backend token generation with native `node:crypto` library.
* **Implementation**: Completed full integration of the Game SDK and Portal Services (P-002, P-003, D-005):
  * Designed and initialized a standalone module at `/sdk` with its own `package.json`, TypeScript configuration, and `tsup` bundler to build isomorphic browser modules (`wgcp-sdk.js`).
  * Created Caddyfile routing and volume configuration to serve the static SDK directly from `http://wgcp-sdk.localhost/wgcp-sdk.js`.
  * Expanded Drizzle ORM schemas in `portal/backend/src/schema.ts` to add database tables for saves, achievements, leaderboards, stats, and progression.
  * Implemented Express backend REST controllers in `portal/backend/src/server.ts` with telemetry verification and idempotency handling.
  * Integrated cross-origin script event broker and standard React components (`ConflictResolutionOverlay`) inside `portal/frontend/src/views/LauncherView.tsx`.
* **Update**: Updated status of design proposals [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) and [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to `accepted` following a successful platform feasibility analysis.
* **Creation**: Added game integration runbook [`R-001-game-integration-runbook.md`](/runbooks/R-001-game-integration-runbook.md) and initialized the runbooks subdirectory with its own index and update logs.
* **Update**: Updated specification [`memory_spec.md`](/memory_spec.md) to define the new `Runbook` concept type and `runbooks/` folder.
* **Creation**: Added investigation report [`I-010-viewport-escape-regression.md`](/investigations/I-010-viewport-escape-regression.md) detailing the diagnostics and root causes of the viewport-first launch Escape key regression.


## 2026-08-28
* **Creation**: Added decision [`D-005-storage-permission-delegation.md`](/decisions/D-005-storage-permission-delegation.md) implementing interactive storage permission delegation for cross-origin game iframes.
* **Creation**: Added investigation report [`I-009-supertux-persistent-storage-issue.md`](/investigations/I-009-supertux-persistent-storage-issue.md) detailing the diagnostics and root causes for the SuperTux persistent storage prompt request failure.
* **Update**: Updated status of proposal [`P-004-game-launch-refactor.md`](/proposals/P-004-game-launch-refactor.md) to `accepted`.
* **Creation**: Added decision [`D-004-game-launch-refactor.md`](/decisions/D-004-game-launch-refactor.md) committing the choice of default viewport game launches and paused settings fullscreen toggle.

## 2026-08-27
* **Creation**: Added design proposal [`P-004-game-launch-refactor.md`](/proposals/P-004-game-launch-refactor.md) for viewport-first game launch refactoring.

## 2026-08-21
* **Creation**: Added investigation report [`I-008-proposals-iterative-scrutiny.md`](/investigations/I-008-proposals-iterative-scrutiny.md) containing a three-round iterative audit examining the Emscripten FS bridge, binary data transfer, telemetry limit, and queue boundaries.
* **Creation**: Added investigation report [`I-007-proposal-security-and-queue-audit.md`](/investigations/I-007-proposal-security-and-queue-audit.md) auditing P-002 and P-003 on postMessage origin hijacking, pending promise stacking, queue sharing, and session migration race conditions.
* **Update**: Revised design proposals [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) and [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to close the identity-derivation and leaderboard-token gaps found in [`I-006-leaderboard-identity-boundary-audit.md`](/investigations/I-006-leaderboard-identity-boundary-audit.md).
* **Creation**: Added investigation report [`I-006-leaderboard-identity-boundary-audit.md`](/investigations/I-006-leaderboard-identity-boundary-audit.md) auditing the leaderboard score-verification flow and game-identity derivation mechanism proposed in P-002 and P-003.
* **Update**: Revised design proposal [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to trim the game-facing telemetry surface and codify `gameId` derivation across service modules, addressing boundary-scrutiny findings from [`I-005-sdk-completeness-and-boundary-scrutiny.md`](/investigations/I-005-sdk-completeness-and-boundary-scrutiny.md).
* **Update**: Revised design proposal [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) to fix a proven offline-sync data-loss failure mode and document the rejection of a transparent `localStorage` interceptor, addressing findings from [`I-005-sdk-completeness-and-boundary-scrutiny.md`](/investigations/I-005-sdk-completeness-and-boundary-scrutiny.md).

## 2026-08-18
* **Update**: Standardized and aligned `memory_spec.md` with OKF v0.2 spec for path resolution and footnote citations, resolving hardcoded environment-specific absolute filesystem paths across the catalog.
* **Creation**: Added investigation report [`I-004-memory-spec-pathing-portability.md`](/investigations/I-004-memory-spec-pathing-portability.md) documenting memory spec pathing and portability analysis.
* **Update**: Expanded design proposal [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to incorporate player statistics, personal best models, and leveling progressions.
* **Creation**: Added design proposal [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) defining the Game Services API Specification.
* **Creation**: Added investigation reports [`I-002-web-game-sdk-archeology.md`](/investigations/I-002-web-game-sdk-archeology.md) and [`I-003-platform-stats-progression-model.md`](/investigations/I-003-platform-stats-progression-model.md) analyzing web game SDK features and native platform statistics paradigms.

## 2026-08-17
* **Update**: Revised design proposal [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) to integrate review feedback on security boundaries, replication models, and storage constraints.
* **Creation**: Added design proposal [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) outlining the Game SDK architecture and synchronization capabilities.
* **Creation**: Added investigation report [`I-001-game-storage-archeology.md`](/investigations/I-001-game-storage-archeology.md) to log state persistence methodologies of registered console games.

## 2026-08-15
* **Standardization**: Restructured memory catalog for progressive disclosure by establishing scoped `index.md` and `log.md` files within the `proposals/`, `decisions/`, `findings/`, and `investigations/` subdirectories.
* **Standardization**: Updated `memory_spec.md` to define schema rules and metadata formats for `Decision`, `Finding`, and `Investigation` concept types.
* **Standardization**: Standardized all core catalog memory documents (`architecture.md`, `game_integration.md`, `cli_ops.md`) under the Open Knowledge Format (OKF) v0.2 spec, introducing YAML frontmatter and per-claim footnote citations linked to source manifests.
* **Creation**: Added [`memory_spec.md`](/memory_spec.md) detailing custom types, formatting rules, actor schemas, and validation requirements.
* **Creation**: Added [`index.md`](/index.md) to serve as the root directory index to facilitate progressive disclosure.
* **Initialization**: Initialized the `.agents/memory/` directory containing foundational concept files for [`architecture.md`](/architecture.md), [`game_integration.md`](/game_integration.md), and [`cli_ops.md`](/cli_ops.md).
* **Initialization**: Created [`AGENTS.md`](/AGENTS.md) in the workspace root to instruct all agents to bootstrap their context by reading the memory catalog index.
