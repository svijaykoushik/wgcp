---
type: Decision
title: Standardize BigInt Epoch Timestamps, SDK Feature Centralization, and Test State Isolation
description: Record of choices to enforce 64-bit integer timestamp schemas across Drizzle/Postgres tables, centralize game-portal bridging exclusively in the standalone SDK, and isolate integration test states.
status: accepted
decision_id: D-006
generated: { by: antigravity/3.7, at: 2026-08-31T22:35:00+05:30 }
verified: { by: human:vijaykoushik, at: 2026-08-31T22:35:00+05:30 }
sources:
  - id: sdk-integration-e2e
    resource: /portal/frontend/e2e/sdk-integrations.spec.ts
    title: WGCP SDK Integrations E2E Test Suite
---

# Decision: Standardize BigInt Epoch Timestamps, SDK Feature Centralization, and Test State Isolation

## Context
During the platform-wide integration and automated E2E verification of the standalone Web Game Console Platform SDK (`wgcp-sdk.js`) across 2048, Hextris, A Dark Room, and BrowserQuest, multiple systemic issues were uncovered:
1. **Timestamp Integer Overflow**: The Postgres schema defined timestamp columns (such as `updated_at`) using standard 32-bit signed integers (`integer`). In JavaScript, `Date.now()` produces a 13-digit millisecond timestamp (~$1.7 \times 10^{12}$), which severely overflows the 32-bit signed integer maximum ($2,147,483,647$). This caused internal server errors (`500: integer out of range`) when persisting saves or submitting scores.
2. **Containerized Build Desynchronization**: Code edits to portal frontend security schemas or backend API routes were not automatically hot-reloaded into running Docker services during E2E test runs, causing tests to evaluate against outdated container images.
3. **Double Event Dispatching**: Folding the Escape key forwarding behavior directly into the global SDK caused conflicts in games that also retained legacy inline keydown listeners (e.g. BrowserQuest), dispatching dual `WGCP_TOGGLE_MENU` messages that rapidly opened and closed the system menu.
4. **State Pollution across Test Iterations**: Running sequential E2E test suites with fresh browser contexts failed with `409 Conflict` because the Postgres database retained higher revision save states from previous runs.

## Decision
1. **Schema-Level 64-bit Integer Timestamps**: All current and future Drizzle ORM schema timestamp definitions (`updatedAt`, `timestamp`, `achievedAt`, etc.) intended to hold JavaScript epoch timestamps must be defined using `bigint("...", { mode: "number" })`.
2. **Deterministic Service Rebuilds**: Any modification to backend routes, Drizzle schemas, or portal frontend RPC envelope whitelists must trigger an explicit container rebuild and recreation (`docker compose -f platform/docker-compose.yml up --build -d <service>`).
3. **Exclusive SDK Feature Centralization**: Features and protocol hooks provided by the WGCP platform contract (such as Escape key listener registration, storage synchronization, and gamepad delegation) must live solely within the standalone SDK (`http://wgcp-sdk.localhost/wgcp-sdk.js`). Individual games must not implement redundant inline shims.
4. **Automated Save State Purging in Test Harness**: E2E integration test suites must execute `DELETE /api/v1/games/:gameId/saves/:slot` during setup to ensure clean-slate execution and prevent revision conflicts.

## Consequences
* **Positive**:
  * Prevents runtime database exceptions across all save, achievement, stat, and leaderboard endpoints.
  * Ensures seamless sub-millisecond precision across the entire platform without data truncation.
  * Guarantees that the standalone SDK remains the single source of truth for game-portal communication.
  * Makes Playwright E2E tests fully idempotent, reproducible, and isolated.
* **Negative**:
  * Requires explicit `DELETE` routes to be implemented and maintained across all backend entities manipulated in automated testing.
