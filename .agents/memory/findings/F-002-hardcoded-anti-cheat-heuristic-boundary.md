---
type: Finding
finding_id: F-002
title: Hardcoded Anti-Cheat Heuristic Violating Platform Trust Boundaries
description: The backend enforces an arbitrary, hardcoded rate-of-play check (2000 points per second) on leaderboard submissions, violating the platform architectural invariant and breaking speedrunners and high-multiplier games.
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

# Finding (F-002) - Hardcoded Anti-Cheat Heuristic Violating Platform Trust Boundaries

## 1. Description & Context

The Web Game Console Platform (WGCP) adheres to the core architectural invariant:
> **The platform must not hardcode game-specific metadata, trophy definitions, or arbitrary gameplay rules.** Games must remain 100% autonomous, declarative, and self-contained.

Leaderboard score validation in `portal/backend/src/server.ts` currently contains hardcoded heuristic checks that assume scores correlate directly with elapsed real-time seconds.

---

## 2. Root Cause Analysis

In [`portal/backend/src/server.ts:360-369`](/portal/backend/src/server.ts),[^server-backend] the score submission endpoint enforces:

```typescript
// portal/backend/src/server.ts:360-369
// Telemetry-bound Plausibility Check (Finding 2 / P-003 §3.3)
const sessionSecs = tokenData.telemetry.sessionLengthMs / 1000;
const maxPossiblePointsPerSec = 2000; // Hardcoded bounds limit
if (score > sessionSecs * maxPossiblePointsPerSec + 100) {
  return res.status(400).json({
    code: "ERROR_TAMPER_DETECTED",
    message: "Score value physically impossible given session telemetry snapshot"
  });
}
```

### Architectural Breakdown:
1. **Broken Game Formats**:
   * **Speedrunners (e.g. *SuperTux*)**: Score represents elapsed milliseconds (e.g. `45,000` ms for a 45s run). Since `45,000 > 45 * 2000 + 100` is close to the threshold and short clean runs will fail, speedrun submissions are rejected with `ERROR_TAMPER_DETECTED`.
   * **Arcade Titles with Multipliers**: Games awarding $100,000+$ bonus points instantly upon clearing a level or chaining a combo are erroneously blocked.
2. **Conflation of Platform vs Game Responsibility**:
   * Gameplay simulation, scoring rules, and in-game anti-tamper belong to the game logic.[^p006-proposal]
   * The platform's true responsibility is identity authentication, origin isolation (`postMessage` origin check), single-use token invalidation, and data payload hygiene ($\le$ 2KB).

---

## 3. Impact

* Rejection of legitimate high scores and speedrun personal bests.
* High maintenance burden as new games require custom server-side exception rules.
* Direct violation of the platform's OKF architectural invariants.

---

## 4. Remediation Plan

1. Remove `maxPossiblePointsPerSec = 2000` and the rate-of-play check from `portal/backend/src/server.ts`.
2. Keep the token validation and context checks intact:
   * Verify single-use token exists, is unexpired, and matches `userId`, `gameId`, and `leaderboardId`.
   * Immediately delete the token on redemption.
3. Enforce data type and payload size boundaries:
   * Ensure `score` is a finite number (`typeof score === 'number' && Number.isFinite(score)`).
   * Ensure `metadata` is a string with length $\le 2048$ bytes.

[^server-backend]: Portal Backend Server Implementation ([/portal/backend/src/server.ts](/portal/backend/src/server.ts))
[^i012-investigation]: Game Services Implementation Bugs & Operational Audit ([/investigations/I-012-game-services-implementation-gaps-and-bugs.md](/investigations/I-012-game-services-implementation-gaps-and-bugs.md))
[^p006-proposal]: Declarative Game Services Schema Proposal ([/proposals/P-006-declarative-achievements-leaderboards-schema.md](/proposals/P-006-declarative-achievements-leaderboards-schema.md))
