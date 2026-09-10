---
type: Finding
finding_id: F-004
title: Static Frontend Fallback Data Violating Dynamic Ingestion Invariant
description: Portal views for achievements and leaderboards rely on hardcoded TypeScript mock arrays (gameServicesData.ts) rather than dynamically ingesting services from the platform registry (games.json).
status: active
generated: { by: antigravity/3.7, at: 2026-09-10T23:06:00+05:30 }
sources:
  - id: frontend-services-data
    resource: /portal/frontend/src/utils/gameServicesData.ts
    title: Frontend Static Game Services Mock Data
  - id: achievements-view
    resource: /portal/frontend/src/views/AchievementsView.tsx
    title: Achievements View Component
  - id: leaderboards-view
    resource: /portal/frontend/src/views/LeaderboardsView.tsx
    title: Leaderboards View Component
  - id: i012-investigation
    resource: /investigations/I-012-game-services-implementation-gaps-and-bugs.md
    title: Game Services Implementation Bugs & Operational Audit
  - id: p006-proposal
    resource: /proposals/P-006-declarative-achievements-leaderboards-schema.md
    title: Declarative Game Services Schema Proposal
---

# Finding (F-004) - Static Frontend Fallback Data Violating Dynamic Ingestion Invariant

## 1. Description & Context

The Web Game Console Platform is designed as an extensible, containerized game launcher. Adding a new game via `./platform.sh game add <path>` should automatically make its metadata, achievements, and leaderboards visible in the console UI without manual edits to portal source code.

Currently, the portal views rely on a hardcoded static file [`portal/frontend/src/utils/gameServicesData.ts`](/portal/frontend/src/utils/gameServicesData.ts).[^frontend-services-data]

---

## 2. Root Cause Analysis

In [`portal/frontend/src/views/AchievementsView.tsx`](/portal/frontend/src/views/AchievementsView.tsx)[^achievements-view] and [`portal/frontend/src/views/LeaderboardsView.tsx`](/portal/frontend/src/views/LeaderboardsView.tsx):[^leaderboards-view]

```typescript
// portal/frontend/src/views/AchievementsView.tsx:3
import { getAchievementsForGame, KNOWN_GAME_ACHIEVEMENTS } from '../utils/gameServicesData';

// portal/frontend/src/views/AchievementsView.tsx:30
return getAchievementsForGame(gid, data);
```

```typescript
// portal/frontend/src/views/LeaderboardsView.tsx:3
import { getLeaderboardsForGame, GameLeaderboardCatalogItem } from '../utils/gameServicesData';

// portal/frontend/src/views/LeaderboardsView.tsx:27
const list = getLeaderboardsForGame(selectedGameId);
```

### The Flaw:
* `KNOWN_GAME_ACHIEVEMENTS` in `gameServicesData.ts` contains hardcoded static arrays for `2048`, `adarkroom`, and `supertux`.
* If a developer installs a new game or adds new achievements to an existing game's `game.yaml`, the portal views do not reflect the changes unless someone manually edits `gameServicesData.ts` and rebuilds the frontend container.
* This breaks the console platform's dynamic packaging contract.

---

## 3. Impact

1. Non-extensible platform experience: newly registered games appear without achievement badges or leaderboard tabs.
2. Violates the core platform architectural invariant (*Zero hardcoded game metadata*).

---

## 4. Remediation Plan

1. In `portal/frontend/src/views/AchievementsView.tsx`:
   * Parse `game.services?.achievements` directly from the `games` prop (loaded from `/api/registry.json`).
   * Merge user progress records from `GET /api/v1/games/:id/achievements` against the game's manifest definitions dynamically.
2. In `portal/frontend/src/views/LeaderboardsView.tsx`:
   * Parse `game.services?.leaderboards` directly from the `games` prop.
   * Group leaderboards by `board.group` and render dynamic metadata badges.
3. Delete `portal/frontend/src/utils/gameServicesData.ts`.

[^frontend-services-data]: Frontend Static Game Services Mock Data ([/portal/frontend/src/utils/gameServicesData.ts](/portal/frontend/src/utils/gameServicesData.ts))
[^achievements-view]: Achievements View Component ([/portal/frontend/src/views/AchievementsView.tsx](/portal/frontend/src/views/AchievementsView.tsx))
[^leaderboards-view]: Leaderboards View Component ([/portal/frontend/src/views/LeaderboardsView.tsx](/portal/frontend/src/views/LeaderboardsView.tsx))
[^i012-investigation]: Game Services Implementation Bugs & Operational Audit ([/investigations/I-012-game-services-implementation-gaps-and-bugs.md](/investigations/I-012-game-services-implementation-gaps-and-bugs.md))
[^p006-proposal]: Declarative Game Services Schema Proposal ([/proposals/P-006-declarative-achievements-leaderboards-schema.md](/proposals/P-006-declarative-achievements-leaderboards-schema.md))
