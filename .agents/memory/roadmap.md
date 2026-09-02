---
type: Roadmap
title: WGCP Platform Architecture Roadmap
description: Phased implementation roadmap, capability delivery schedule, and milestone tracking.
status: active
current_phase: 5
progress: "4/7 completed"
generated: { by: antigravity/3.7, at: 2026-09-02T22:20:00Z }
verified: { by: human:vijaykoushik, at: 2026-09-02T22:20:00Z }
sources:
  - id: okf-spec
    resource: /memory_spec.md
    title: Memory Catalog Specification
  - id: base-architecture
    resource: /architecture.md
    title: Base Architecture Specification
  - id: p001-registry
    resource: /proposals/P-001-game-registry-spec-v2.md
    title: Game Registry Specification (v2)
  - id: p002-storage-sync
    resource: /proposals/P-002-game-sdk-storage-sync.md
    title: Game SDK Storage Sync Specification
  - id: p003-services-api
    resource: /proposals/P-003-game-sdk-services-api.md
    title: Game Services API Specification
  - id: p004-launch-refactor
    resource: /proposals/P-004-game-launch-refactor.md
    title: Viewport-First Game Launch Refactoring
  - id: d005-storage-delegation
    resource: /decisions/D-005-storage-permission-delegation.md
    title: Interactive Storage Permission Delegation
  - id: d006-invariants
    resource: /decisions/D-006-epoch-timestamp-and-sdk-invariants.md
    title: BigInt Epoch Timestamps, SDK Feature Centralization, and Test Isolation
  - id: d007-cloud-fallback
    resource: /decisions/D-007-cloud-fallback-and-local-save-migration.md
    title: Cloud Fallback State Hydration and Save Auto-Migration
  - id: i009-supertux-storage
    resource: /investigations/I-009-supertux-persistent-storage-issue.md
    title: SuperTux Persistent Storage Prompt Failure Investigation
  - id: i011-docker-build
    resource: /investigations/I-011-supertux-wasm-docker-build-optimization.md
    title: SuperTux WASM Docker Build Optimization & Decoupling
  - id: r001-runbook
    resource: /runbooks/R-001-game-integration-runbook.md
    title: Game Integration and Packaging Runbook
---

# WGCP Platform Architecture Roadmap

This document defines the phased implementation strategy, milestone deliverables, dependency constraints, and active focus for the **Web Game Console Platform (WGCP)** under the Open Knowledge Format (OKF) v0.2.[^okf-spec]

---

## 1. Executive Status Matrix

| Phase | Milestone Name | Status | Primary Contracts & References | Verification Anchors |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Ingress Gateway & Registration Pipeline | `COMPLETED` | [`/architecture.md`](/architecture.md), [`/cli_ops.md`](/cli_ops.md), [P-001](/proposals/P-001-game-registry-spec-v2.md) | `./platform.sh` CLI suites |
| **Phase 2** | Console Portal & Launchpad Experience | `COMPLETED` | [P-004](/proposals/P-004-game-launch-refactor.md), [D-004](/decisions/D-004-game-launch-refactor.md), [D-005](/decisions/D-005-storage-permission-delegation.md) | `viewport.spec.ts`, `permission.spec.ts` |
| **Phase 3** | Standalone Game SDK & Backend Services | `COMPLETED` | [P-002](/proposals/P-002-game-sdk-storage-sync.md), [P-003](/proposals/P-003-game-sdk-services-api.md), [D-006](/decisions/D-006-epoch-timestamp-and-sdk-invariants.md) | Express REST tests, BigInt schema check |
| **Phase 4** | Game Integrations & Hydration Hardening | `COMPLETED` | [D-007](/decisions/D-007-cloud-fallback-and-local-save-migration.md), [`/runbooks/R-001-game-integration-runbook.md`](/runbooks/R-001-game-integration-runbook.md) | `sdk-integrations.spec.ts` (All 4 games pass) |
| **Phase 5** | WASM & Emscripten Storage Bridge | `ACTIVE` | [I-009](/investigations/I-009-supertux-persistent-storage-issue.md), [I-011](/investigations/I-011-supertux-wasm-docker-build-optimization.md), [D-005](/decisions/D-005-storage-permission-delegation.md) | SuperTux persistent storage E2E |
| **Phase 6** | Portal Services UI & Dashboards | `PLANNED` | [P-003](/proposals/P-003-game-sdk-services-api.md) | Playwright UI navigation tests |
| **Phase 7** | Multiplayer Lobbies & Social Infrastructure | `DEFERRED` | [P-003](/proposals/P-003-game-sdk-services-api.md) Section 2.3 | Deferred scope specification |

---

## 2. Active Focus: Phase 5 — WASM & Emscripten Storage Bridge

* **Goal**: Provide transparent IDBFS / persistent storage bridging for compiled WebAssembly and C/C++ games (e.g. SuperTux) running inside sandboxed cross-origin iframes.[^i009-supertux-storage]
* **Pre-conditions & Decisions**:
  - Requires interactive storage permission delegation shim adhering to [D-005](/decisions/D-005-storage-permission-delegation.md).
  - Must respect capturing-phase Escape key forwarding and container isolation standards codified in [`R-001`](/runbooks/R-001-game-integration-runbook.md).
* **Deliverables**:
  - [x] Implement Emscripten `IDBFS.syncfs` synchronization interceptor in the standalone SDK (`sdk/src/storage/wasm.ts`).
  - [ ] Decouple SuperTux Dockerfile to bypass redundant C++ WASM compilation during HTML template updates ([I-011](/investigations/I-011-supertux-wasm-docker-build-optimization.md)).
  - [ ] Resolve SuperTux persistent storage prompt request failures and wire permission handshake with `LauncherView.tsx` ([I-009](/investigations/I-009-supertux-persistent-storage-issue.md)).
  - [ ] Package and register `games/supertux` using `./platform.sh game add ./games/supertux`.
  - [ ] Add Playwright E2E test verifying WASM level state persistence across browser reload.
* **Verification Invariant**: SuperTux game progress persists into PostgreSQL backend without throwing unhandled browser storage permission errors during iframe startup.

---

## 3. Upcoming Milestones

### Phase 6: Portal Services UI & Dashboards (`PLANNED`)

* **Goal**: Build visual console portal experiences for player achievements, global leaderboards, personal bests, and user leveling progress.
* **Dependencies**: Relies on backend tables and REST endpoints established in Phase 3 ([P-003](/proposals/P-003-game-sdk-services-api.md)).
* **Deliverables**:
  - [ ] Portal Achievements Showcase: Render unlocked/locked achievements per game with progress bars and timestamps.
  - [ ] Global Leaderboard Explorer: Paginated high-score boards with top-rank highlights and personal best rank indicators.
  - [ ] Player Profile & Progression View: Visual XP leveling curves, total play time counters, and active session summaries.
  - [ ] Spatial Gamepad Navigation: Expand 2D focus engine to seamlessly navigate between game cards, leaderboard tabs, and profile modals.
* **Verification Invariant**: All portal dashboard screens support full gamepad D-pad and arrow key spatial navigation with 100% keyboard accessibility.

---

## 4. Completed Milestones

### Phase 1: Ingress Gateway & Registration Pipeline (`COMPLETED`)
* Designed and deployed Caddy-powered dynamic reverse proxy gateway on port 80 ([`architecture.md`](/architecture.md)).
* Implemented `./platform.sh` CLI for single-command platform start/stop and game registration lifecycle ([`cli_ops.md`](/cli_ops.md)).
* Codified F-Droid v2-style declarative registry specification ([P-001](/proposals/P-001-game-registry-spec-v2.md)).
* Enforced strict Docker network bridge isolation per game workload (`<game-id>_default`).

### Phase 2: Console Portal & Launchpad Experience (`COMPLETED`)
* Implemented React 18 + Vite + Tailwind CSS console portal with console-grade motion keyframes.
* Built 2D nearest-neighbor spatial navigation engine with W3C Gamepad API polling.
* Transitioned game execution from browser fullscreen to viewport-first windowing with in-game menu overlay ([P-004](/proposals/P-004-game-launch-refactor.md), [D-004](/decisions/D-004-game-launch-refactor.md)).
* Implemented interactive storage permission delegation for sandboxed iframes ([D-005](/decisions/D-005-storage-permission-delegation.md)).

### Phase 3: Standalone Game SDK & Backend Services (`COMPLETED`)
* Created standalone TypeScript SDK module at `/sdk` distributed from `http://wgcp-sdk.localhost/wgcp-sdk.js` ([P-002](/proposals/P-002-game-sdk-storage-sync.md)).
* Hardened cross-origin `postMessage` RPC protocol with UUIDv4 correlation IDs, strict RFC 6454 origin validation, and conjunctive `gameId` derivation.
* Deployed PostgreSQL database and Drizzle ORM backend for cloud saves, achievements, leaderboards, player stats, and XP progression ([P-003](/proposals/P-003-game-sdk-services-api.md)).
* Standardized 64-bit integer timestamp typing (`bigint`) preventing Postgres 32-bit integer overflow ([D-006](/decisions/D-006-epoch-timestamp-and-sdk-invariants.md)).

### Phase 4: Game Integrations & Hydration Hardening (`COMPLETED`)
* Integrated initial testbed games: **2048**, **Hextris**, **A Dark Room**, and **BrowserQuest** with the standalone SDK.
* Hardened transparent cloud fallback queries (`WGCP_LOAD`, `WGCP_STATS_GET`) on local cache misses ([D-007](/decisions/D-007-cloud-fallback-and-local-save-migration.md)).
* Implemented automatic legacy save migration uploading pre-existing `localStorage` saves to PostgreSQL on first boot.
* Built comprehensive Playwright E2E integration test suite (`portal/frontend/e2e/sdk-integrations.spec.ts`) validating end-to-end telemetry and save rehydration.

---

## 5. Deferred Capabilities

### Phase 7: Advanced Multiplayer Lobbies & Social Infrastructure (`DEFERRED`)
* Real-time matchmaking queues, room allocation, and WebRTC / NAT traversal.[^p003-services-api]
* In-game player-to-player direct messaging, friends lists, and party invites.
* Video ads, commercial breaks, and monetization mechanics.
* *Note: Games requiring real-time networking (e.g. BrowserQuest) continue to host their own WebSocket infrastructure independently.*

---

## 6. References & Sources

[^okf-spec]: Open Knowledge Format Specification (v0.2) (`/memory_spec.md`)
[^base-architecture]: System Architecture and Gateway Proxy Model (`/architecture.md`)
[^p001-registry]: Game Registry Specification (v2) (`/proposals/P-001-game-registry-spec-v2.md`)
[^p002-storage-sync]: Game SDK & Portal Synchronization Specification (`/proposals/P-002-game-sdk-storage-sync.md`)
[^p003-services-api]: Game Services API Specification (`/proposals/P-003-game-sdk-services-api.md`)
[^p004-launch-refactor]: Viewport-First Game Launch Refactoring (`/proposals/P-004-game-launch-refactor.md`)
[^d005-storage-delegation]: Interactive Storage Permission Delegation (`/decisions/D-005-storage-permission-delegation.md`)
[^d006-invariants]: Standardize BigInt Epoch Timestamps, SDK Feature Centralization, and Test Isolation (`/decisions/D-006-epoch-timestamp-and-sdk-invariants.md`)
[^d007-cloud-fallback]: Cloud Fallback State Hydration and Save Auto-Migration (`/decisions/D-007-cloud-fallback-and-local-save-migration.md`)
[^i009-supertux-storage]: SuperTux Persistent Storage Prompt Failure Investigation (`/investigations/I-009-supertux-persistent-storage-issue.md`)
[^i011-docker-build]: SuperTux WASM Docker Build Optimization & Decoupling (`/investigations/I-011-supertux-wasm-docker-build-optimization.md`)
[^r001-runbook]: Game Integration and Packaging Runbook (`/runbooks/R-001-game-integration-runbook.md`)
