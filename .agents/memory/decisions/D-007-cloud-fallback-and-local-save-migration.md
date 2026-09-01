---
type: Decision
title: Implement Cloud Fallback State Hydration, Pre-existing Save Auto-Migration, and Workload Rebuild Invariants
description: Architectural decision to implement transparent cloud fallback queries on local cache miss, auto-migrate legacy local storage data on initial SDK boot, and enforce game container rebuild workflows.
status: accepted
decision_id: D-007
generated: { by: antigravity/3.7, at: 2026-09-01T23:45:00+05:30 }
verified: { by: human:vijaykoushik, at: 2026-09-01T23:45:00+05:30 }
sources:
  - id: sdk-storage
    resource: /sdk/src/storage/index.ts
    title: Standalone SDK Storage Implementation
  - id: sdk-stats
    resource: /sdk/src/stats/index.ts
    title: Standalone SDK Stats Implementation
---

# Decision: Implement Cloud Fallback State Hydration, Pre-existing Save Auto-Migration, and Workload Rebuild Invariants

## Context
During private window and cross-session verification of WGCP games (2048, Hextris, A Dark Room, BrowserQuest), several state hydration and operational gaps were identified:
1. **Local Cache Miss in Fresh Sessions**: In private windows or fresh browser contexts, local IndexedDB partitions (`wgcp_storage_<gameId>`) start completely empty. Because `WGCP.storage.load(slot)` and `WGCP.stats.init()` checked only local storage, they returned `null` or 0 for saves and stats, failing to rehydrate valid player progress already persisted in PostgreSQL.
2. **Un-migrated Pre-existing Local Data**: Players with existing progress stored in `localStorage` prior to SDK integration had their saves stranded locally. Direct property assignments like `localStorage.data = ...` (used by BrowserQuest) bypassed `localStorage.setItem()` wrappers and never triggered cloud synchronization.
3. **Containerized Workload Drift**: Game client source code resides in git submodules (`games/<game>`) but is executed from immutable Docker container images (`Dockerfile`). Edits made on the host filesystem were not served by Caddy until explicitly rebuilt.

## Decision
1. **Transparent Cloud Fallback via `WGCP_LOAD` and `WGCP_STATS_GET`**:
   * `WGCP.storage.load(slot)` checks local IndexedDB first. Upon a cache miss, it issues a `WGCP_LOAD` RPC to the parent portal, fetches the save slot from `/api/v1/games/:gameId/saves/:slot`, seeds local IndexedDB, and returns the rehydrated payload.
   * `WGCP.stats.init(gameId)` queries `WGCP_STATS_GET` on startup, pre-populating the in-memory and IndexedDB `stats_cache` with remote player statistics.
2. **First-Launch Auto-Migration**:
   * Game integration entrypoints inspect `localStorage` on boot. If cloud saves are empty but local browser data is present, integration hooks immediately dispatch `WGCP.storage.save()` to migrate and persist the pre-existing state into PostgreSQL.
3. **Direct Storage Class Integration**:
   * Storage synchronizers must directly hook into game storage engine classes (e.g. `Storage.prototype.save`) or proxy property setters to ensure direct property mutations (`localStorage.data = ...`) are captured.
4. **Enforced Game Workload Rebuilds**:
   * Any change to game client code, build scripts, or static assets must be followed by a container rebuild using `./platform.sh game add <path>` (or `docker compose -p <gameId> -f <path>/docker-compose.yml up -d --build`).

## Consequences
* **Positive**:
   * Guarantees seamless cross-device, private-window, and multi-session state continuity.
   * Eliminates data loss for existing users when games transition to the WGCP SDK.
   * Ensures that live container environments accurately reflect updated submodule code.
* **Negative**:
   * Adds an initial network round-trip on first-time cache misses for secondary slots.
