---
type: Investigation
investigation_id: I-012
title: Game Services Implementation Bugs, Trust Boundary Violations & Operational Pipeline Audit
description: Diagnostic report cataloging active codebase defects (maxSteps percentage calculation, hardcoded anti-cheat heuristics, missing database composite indexes, static frontend fallbacks) and operational tasks required for Game Services Registry v2.2 adoption.
start_date: "2026-09-10"
status: completed
result: substantiated
generated: { by: antigravity/3.7, at: 2026-09-10T23:05:00+05:30 }
sources:
  - id: server-backend
    resource: /portal/backend/src/server.ts
    title: Portal Backend Server Implementation
  - id: schema-backend
    resource: /portal/backend/src/schema.ts
    title: Drizzle PostgreSQL Database Schema
  - id: frontend-services-data
    resource: /portal/frontend/src/utils/gameServicesData.ts
    title: Frontend Static Game Services Mock Data
  - id: register-game-script
    resource: /platform/scripts/register-game.sh
    title: Platform Game Registration Compiler Script
  - id: p006-proposal
    resource: /proposals/P-006-declarative-achievements-leaderboards-schema.md
    title: Declarative Game Services Schema Proposal
---

# Investigation Report (I-012) - Game Services Implementation Bugs, Trust Boundary Violations & Operational Pipeline Audit

## 1. Context & Problem Statement

During the development and audit of Proposal **[P-006: Declarative Game Services Schema (v2.2)](/proposals/P-006-declarative-achievements-leaderboards-schema.md)**, an end-to-end scrutiny of the codebase was conducted to identify discrepancies between declarative specifications and the current runtime implementations across the backend server, database schemas, frontend components, and registration pipelines.

This report catalogs:
1. **Active Implementation Bugs** in the existing codebase that violate platform invariants or calculate player state incorrectly.
2. **Operational & Tooling Tasks** required to transition the platform from static fallback data to full dynamic registry compilation.

---

## 2. Active Implementation Bugs (Defects)

### 🔴 Defect 1: Broken Incremental Achievement Percentage Formula (`server.ts`)
* **Location**: [`portal/backend/src/server.ts:256`](/portal/backend/src/server.ts)
* **Code in Defect**:
  ```typescript
  // server.ts:256
  let currentPercent = existing ? existing.percentComplete : 0;
  let newPercent = Math.min(100, currentPercent + step);
  let unlocked = newPercent >= 100;
  ```
* **Impact**: The backend directly adds `step` as a percentage. If an achievement declares `maxSteps: 500` (e.g. collect 500 coins) and the game calls `WGCP.achievements.increment('coins_500', 5)`, the user receives $+5\%$ progress instead of $+1\%$ ($\frac{5}{500}$).
* **Remediation**: The backend must resolve `maxSteps` from the compiled manifest (`games.json`) and scale progress proportionally:
  $$\text{percentComplete} = \min\left(100, \left\lfloor \frac{\text{currentSteps}}{\text{maxSteps}} \times 100 \right\rfloor\right)$$

---

### 🔴 Defect 2: Hardcoded Anti-Cheat Heuristic Violating Platform Invariants
* **Location**: [`portal/backend/src/server.ts:362-368`](/portal/backend/src/server.ts)
* **Code in Defect**:
  ```typescript
  // server.ts:362
  const sessionSecs = tokenData.telemetry.sessionLengthMs / 1000;
  const maxPossiblePointsPerSec = 2000; // Hardcoded bounds limit
  if (score > sessionSecs * maxPossiblePointsPerSec + 100) {
    return res.status(400).json({
      code: "ERROR_TAMPER_DETECTED",
      message: "Score value physically impossible given session telemetry snapshot"
    });
  }
  ```
* **Impact**: Violates the core platform invariant: *The platform must not hardcode game-specific rules, trophy definitions, or scoring mechanics.*
  * Breaks speedrunners (e.g. *SuperTux* where score is elapsed milliseconds, so lower is better and values are in thousands).
  * Breaks arcade titles with combo multipliers.
  * Conflates platform responsibilities (identity, origin security, DB hygiene) with game responsibilities (gameplay simulation and anti-cheat).
* **Remediation**: Remove gameplay rate-of-play anti-cheat checks from the backend. The platform's role is strictly verifying authenticated session identity, canonical iframe origin, single-use token validity, and payload type/size hygiene ($\le$ 2KB).

---

### 🔴 Defect 3: Missing Composite Database Indexes for Leaderboard Sorting
* **Location**: [`portal/backend/src/schema.ts:56-67`](/portal/backend/src/schema.ts)
* **Code in Defect**:
  ```typescript
  export const leaderboards = pgTable("leaderboards", {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    leaderboardId: text("leaderboard_id").notNull(),
    score: doublePrecision("score").notNull(),
    metadata: text("metadata"),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  }, (table) => ({
    pk: primaryKey({ columns: [table.userId, table.gameId, table.leaderboardId] }),
  }));
  ```
* **Impact**: The table only has a primary key index on `(userId, gameId, leaderboardId)`. Queries running:
  - `WHERE game_id = ? AND leaderboard_id = ? ORDER BY score DESC, updated_at ASC`
  - `WHERE game_id = ? AND leaderboard_id = ? ORDER BY score ASC, updated_at ASC`
  trigger full table sequential scans and temporary disk filesorts on PostgreSQL as row count grows.
* **Remediation**: Add composite B-tree indexes to `schema.ts`:
  - `index("leaderboard_desc_idx").on(table.gameId, table.leaderboardId, table.score.desc(), table.updatedAt.asc())`
  - `index("leaderboard_asc_idx").on(table.gameId, table.leaderboardId, table.score.asc(), table.updatedAt.asc())`

---

### 🔴 Defect 4: Hardcoded Static Frontend Data (`gameServicesData.ts`)
* **Location**: [`portal/frontend/src/utils/gameServicesData.ts`](/portal/frontend/src/utils/gameServicesData.ts)
* **Impact**: `AchievementsView.tsx` and `LeaderboardsView.tsx` fall back to a hardcoded dictionary (`KNOWN_GAME_ACHIEVEMENTS`) instead of dynamically ingesting `/api/registry.json`. Newly installed games do not display achievements or leaderboards in the portal showcase.
* **Remediation**: Refactor portal views to consume `games[id].services` directly from `/api/registry.json` and delete `gameServicesData.ts`.

---

## 3. Operational & Tooling Tasks

1. **OPS-01: Registration Compiler Script Update (`platform/scripts/register-game.sh`)**:
   - Update the Python parser step to validate `specVersion: "2.2.0"` and compile `achievements` and `leaderboards` into `platform/registry/games.json`.
   - Provide fallback defaults (`services: { achievements: [], leaderboards: [] }`) for legacy manifests.
2. **OPS-02: Testbed Manifest Declarations (`games/*/game.yaml`)**:
   - Populate declarative `achievements` and `leaderboards` blocks across all 5 testbed games (`2048`, `hextris`, `adarkroom`, `supertux`, `BrowserQuest`).
3. **OPS-03: Playwright E2E Test Suite Expansion**:
   - Add automated Playwright tests in `portal/frontend/e2e/` verifying dynamic registry ingestion, secret achievement masking, and around-player leaderboard windowing.

