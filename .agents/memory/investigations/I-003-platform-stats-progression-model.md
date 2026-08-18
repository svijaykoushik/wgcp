---
type: Investigation
investigation_id: I-003
title: Platform Stats & Progression Models
description: Technical analysis of Steamworks, Epic Online Services (EOS), and PlayFab statistics, achievements, personal bests, and player progression integration systems.
start_date: "2026-08-18"
status: completed
result: substantiated
generated: { by: antigravity/2.0, at: 2026-08-18T22:54:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-18T22:54:00Z }
sources:
  - id: steamworks-stats-docs
    resource: https://partner.steamgames.com/doc/features/stats
    title: Steamworks User Stats and Achievements Documentation
  - id: eos-stats-docs
    resource: https://dev.epicgames.com/docs/game-services/stats
    title: Epic Online Services Stats Interface Documentation
---

# Investigation Report (I-003) - Platform Stats & Progression Models

This investigation analyzes how desktop platform services (Steamworks and Epic Online Services) and LiveOps backends (PlayFab) implement player statistics, progressions, and personal best tracking. These findings are used to design the stats and progression extensions proposed in [`P-003-game-sdk-services-api.md`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/.agents/memory/proposals/P-003-game-sdk-services-api.md).

---

## 1. Steamworks Statistics & Progression Model

Steamworks uses the `ISteamUserStats` API, establishing a tightly coupled relationship between Stats, Achievements, and Leaderboards.

### 1.1. Statistics Engine
* **Declaration**: Developers must pre-register stats in the Steamworks partner administration panel. Each stat has a defined API name (e.g. `stat_enemies_killed`) and type (`INT` or `FLOAT`).
* **API Calls**:
  * `GetStat(name, &value)`: Read the current cached value.
  * `SetStat(name, value)`: Update the local value.
  * `StoreStats()`: An asynchronous call to upload dirty stats to Steam servers.
* **Progressive Achievements**: Steam allows mapping an achievement directly to a specific Stat. When the stat reaches the configured limit (e.g., `kills == 100`), Steam's backend automatically unlocks the achievement without additional game code.
* **Leaderboards integration**: Steamworks leaderboards can be backed by a specific stat, automatically posting the score value when the underlying stat is modified.

---

## 2. Epic Online Services (EOS) Stats Model

EOS separates stats from achievements, but maintains similar backend verification boundaries.

### 2.1. Ingestion and Updates
* **API Pattern**: Game clients use the `EOS_Stats_IngestStat` method. Rather than setting values directly, games ingest "deltas" (e.g., `value: +1` or `value: +50`), which the EOS backend aggregates to prevent client out-of-sync overwrites.
* **Querying**: The client queries current stats asynchronously using `EOS_Stats_QueryStats`, which returns an array of stats defined in the developer console.

---

## 3. PlayFab Progression System

PlayFab provides dedicated systems for complex player statistics and progression tracking.

### 3.1. Player Statistics
* Allows arbitrary numerical statistics (e.g., level, experience, gold earned).
* Features server-side "versioning", allowing stats to be reset on a daily, weekly, or monthly schedule (useful for seasonal leaderboards).

### 3.2. XP & Leveling Tracks
* Developers configure Experience point leveling tables on the backend.
* The game emits events (e.g. `AddXP`), and the backend recalculates levels, returning level-up indicators and triggering item/achievement unlocks automatically.

---

## Conclusion & Architectural Insights for WGCP
1. **Stat-Driven Logic**: Tying achievements and leaderboards to a centralized "Stats" service on the backend reduces code complexity inside games.
2. **Delta Ingestion**: Ingesting stat increments (e.g., `incrementStat(id, amount)`) rather than absolute sets prevents out-of-order execution errors when requests are queued offline.
3. **Save State Decoupling**: Separating statistics from the full game save slot (like IndexedDB data dumps) allows the console portal to display cumulative achievements and stats on the player's dashboard without parsing game-specific saves.
