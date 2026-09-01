# Decisions Index

This directory holds architectural and design choices made during WGCP platform execution.

* [D-001 Create Agent Memory Catalog](D-001-create-agent-memory.md) - Record of the choice to establish the memory catalog. [Status: accepted]
* [D-002 Adopt Open Knowledge Format (OKF) v0.2](D-002-use-okf-spec.md) - Standardizing catalog structure, metadata, and files under the OKF spec. [Status: accepted]
* [D-003 Adopt Game Registry Specification (v2)](D-003-accept-registry-spec-v2.md) - Record of the choice to adopt the F-Droid v2 inspired registry model. [Status: accepted]
* [D-004 Implement Viewport-First Game Launching and Menu Fullscreen Toggle](D-004-game-launch-refactor.md) - Record of the choice to launch games in full viewport by default rather than browser-level fullscreen. [Status: accepted]
* [D-005 Implement Interactive Storage Permission Delegation for Cross-Origin Game Iframes](D-005-storage-permission-delegation.md) - Choice to handle persistent storage permissions using a combination of a game-side postMessage delegation shim and a portal-side modal overlay to capture user gestures securely. [Status: accepted]
* [D-006 Standardize BigInt Epoch Timestamps, SDK Feature Centralization, and Test State Isolation](D-006-epoch-timestamp-and-sdk-invariants.md) - Record of choices to enforce 64-bit integer timestamp schemas across Drizzle/Postgres tables, centralize game-portal bridging exclusively in the standalone SDK, and isolate integration test states. [Status: accepted]
* [D-007 Implement Cloud Fallback State Hydration, Pre-existing Save Auto-Migration, and Workload Rebuild Invariants](D-007-cloud-fallback-and-local-save-migration.md) - Architectural decision to implement transparent cloud fallback queries on local cache miss, auto-migrate legacy local storage data on initial SDK boot, and enforce game container rebuild workflows. [Status: accepted]
