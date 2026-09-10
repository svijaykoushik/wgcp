---
type: Finding
finding_id: F-001
title: Incremental Achievement Progress Calculation Disconnect in Backend Server
description: The backend achievement increment handler treats the submitted step parameter directly as a percentage increase rather than scaling against the manifest's declared maxSteps.
status: active
generated: { by: antigravity/3.7, at: 2026-09-10T23:06:00+05:30 }
sources:
  - id: server-backend
    resource: /portal/backend/src/server.ts
    title: Portal Backend Server Implementation
  - id: i012-investigation
    resource: /investigations/I-012-game-services-implementation-gaps-and-bugs.md
    title: Game Services Implementation Bugs & Operational Audit
  - id: p006-proposal
    resource: /proposals/P-006-declarative-achievements-leaderboards-schema.md
    title: Declarative Game Services Schema Proposal
---

# Finding (F-001) - Incremental Achievement Progress Calculation Disconnect in Backend Server

## 1. Description & Context

In the Game Registry Specification (v2.2),[^p006-proposal] games declare incremental achievements with a total target count using `maxSteps: <integer>` (e.g. `maxSteps: 500` for collecting 500 coins).

During gameplay, the game SDK invokes:
```typescript
await window.WGCP.achievements.increment('coins_500', 5);
```
The parameter `5` represents the incremental number of steps completed in this action (e.g. 5 coins picked up).

---

## 2. Root Cause Analysis

In [`portal/backend/src/server.ts:256`](/portal/backend/src/server.ts),[^server-backend] the increment handler processes the request as follows:

```typescript
// portal/backend/src/server.ts:254-258
const existing = await db.query.achievements.findFirst({ ... });

let currentPercent = existing ? existing.percentComplete : 0;
let newPercent = Math.min(100, currentPercent + step);
let unlocked = newPercent >= 100;
```

### The Flaw:
The backend directly adds `step` as a raw percentage increase (`currentPercent + step`).
* **Expected Result**: Picking up 5 coins out of 500 should increase progress by:
  $$\Delta\% = \frac{5}{500} \times 100 = 1\%$$
* **Actual Result**: The player receives $+5\%$ progress. After picking up only 100 coins (out of 500), the backend prematurely marks the achievement as 100% completed and unlocked.

---

## 3. Impact

1. Progressive achievements complete 5x to 100x faster than intended by the game designer.
2. Players receive unearned Gamerscore / XP.
3. Violates progress synchronization across multiple devices.

---

## 4. Remediation Plan

1. The platform registration script compiles `maxSteps` into `games.<id>.services.achievements` in `platform/registry/games.json`.
2. When processing `POST /api/v1/games/:gameId/achievements/:achievementId/increment`:
   * Retrieve `maxSteps` for `achievementId` from the compiled registry manifest (defaulting to 1 if not declared).
   * Maintain `currentSteps` or compute progress using:
     $$\text{newPercent} = \min\left(100, \left\lfloor \frac{\text{currentSteps} + \text{step}}{\text{maxSteps}} \times 100 \right\rfloor\right)$$
   * Set `unlocked = newPercent >= 100`.

[^server-backend]: Portal Backend Server Implementation ([/portal/backend/src/server.ts](/portal/backend/src/server.ts))
[^i012-investigation]: Game Services Implementation Bugs & Operational Audit ([/investigations/I-012-game-services-implementation-gaps-and-bugs.md](/investigations/I-012-game-services-implementation-gaps-and-bugs.md))
[^p006-proposal]: Declarative Game Services Schema Proposal ([/proposals/P-006-declarative-achievements-leaderboards-schema.md](/proposals/P-006-declarative-achievements-leaderboards-schema.md))
