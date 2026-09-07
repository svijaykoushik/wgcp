---
type: Proposal
proposal_id: P-006
title: Declarative Game Services Schema (Achievements & Leaderboards) for game.yaml
description: Specification proposal for versioned, declarative achievements and leaderboards manifests in game.yaml, client submission contracts, and lifecycle edge-case handling.
status: proposed
generated: { by: antigravity/3.7, at: 2026-09-07T18:18:00+05:30 }
sources:
  - id: game-integration-spec
    resource: /game_integration.md
    title: Game Integration & Packaging Contract (Registry v2)
  - id: p001-registry
    resource: /proposals/P-001-game-registry-spec-v2.md
    title: Game Registry Specification (v2)
  - id: p002-storage-sync
    resource: /proposals/P-002-game-sdk-storage-sync.md
    title: Game SDK Storage Sync Specification
  - id: p003-services-api
    resource: /proposals/P-003-game-sdk-services-api.md
    title: Game Services API Specification
  - id: d006-invariants
    resource: /decisions/D-006-epoch-timestamp-and-sdk-invariants.md
    title: BigInt Timestamps, SDK Feature Centralization, and Test Isolation
---

# Proposal (P-006) - Declarative Game Services Schema for `game.yaml`

## 1. Context & Motivation

The Web Game Console Platform (WGCP) provides core console services: Achievements, Leaderboards, Player Progression, and Cloud Saves (codified in P-003[^p003-services-api]).

Currently, game manifests (`game.yaml`) only declare metadata, container runtimes, and hosting configurations. While the Game SDK enables games to emit unlock events (`WGCP.achievements.unlock('tile_2048')`) and submit high scores (`WGCP.leaderboards.submit(8192)`), the presentation metadata (human-readable titles, descriptions, icons, and metric units) was temporarily scaffolded in a static platform frontend dictionary (`gameServicesData.ts`).

### Architectural Invariant:
**The platform must not hardcode game-specific content or arbitrary icons.** Games must remain autonomous, declarative, and self-contained. The platform's sole responsibility is to ingest the game's declared manifest, enforce cross-origin security boundaries, persist player records, and generically project the UI.

This proposal defines:
1. **The Versioned `game.yaml` Services Manifest (`specVersion: "2.1.0"`)**.
2. **Standardized Client Submission Protocols (`WGCP.achievements`, `WGCP.leaderboards`)**.
3. **Comprehensive Invariant Handling for Operational Edge Cases** (version updates, ID deprecation, unit/scale revisions, inverted sort orders, offline queuing, and cross-origin icon resolution).

---

## 2. Specification: `game.yaml` Schema v2.1.0

The `game.yaml` manifest is extended with optional top-level `achievements` and `leaderboards` sections.

### 2.1 Schema Definition

```yaml
# Schema Version Header (SemVer)
specVersion: "2.1.0"

id: "2048"
name:
  en-US: "2048"
  es-ES: "2048"

# -----------------------------------------------------------------------------
# 1. Declarative Achievements Manifest
# -----------------------------------------------------------------------------
achievements:
  - id: "tile_256"
    name:
      en-US: "Quarter Grand"
      es-ES: "Cuarto de Mil"
    description:
      en-US: "Merge tiles to create the 256 number tile."
      es-ES: "Combina fichas para crear la ficha 256."
    icon: "🔢"                         # Emoji glyph or container-relative path (e.g. "assets/icons/256.png")
    category: "Progression"            # Optional classification (e.g., "Progression", "Secret", "Combat")
    hidden: false                      # If true, name/description masked in portal until unlocked
    maxSteps: 1                        # 1 = single-trigger boolean, >1 = incremental / stepped counter
    points: 10                         # Optional gamerscore / XP value (default: 10)

  - id: "coins_100"
    name:
      en-US: "Coin Hoarder"
    description:
      en-US: "Collect 100 golden coins across icy worlds."
    icon: "🪙"
    maxSteps: 100                      # Progressive achievement tracking 0..100
    points: 25

# -----------------------------------------------------------------------------
# 2. Declarative Leaderboards Manifest
# -----------------------------------------------------------------------------
leaderboards:
  - id: "highScore"
    name:
      en-US: "High Score"
      es-ES: "Puntuación Máxima"
    description:
      en-US: "Highest points scored in a single game run."
    sortOrder: "desc"                  # "desc" (higher is better) | "asc" (lower is better, e.g. time/speedrun)
    unit: "pts"                        # Display unit suffix (e.g., "pts", "coins", "kills", "s", "ms")
    scoreFormat: "number"              # "number" | "duration_ms" | "currency"
    aggregation: "max"                 # "max" (keep highest) | "min" (keep lowest) | "latest"
    version: 1                         # Monotonic integer epoch for schema/rule invalidations
    resetPolicy: "never"               # "never" | "daily" | "weekly" | "seasonal"
```

---

## 3. Schema Fields Specification

### 3.1 Achievements Schema (`achievements[]`)

| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | **Yes** | — | Unique alphanumeric snake_case/kebab-case identifier (e.g. `tile_2048`, `boss_slain`). |
| `name` | Dict/String | **Yes** | — | Localized display title map (or plain string mapping to `en-US`). |
| `description`| Dict/String | **Yes** | — | Localized achievement unlock description. |
| `icon` | String | No | `"🏆"` | UTF-8 emoji glyph or container-relative asset path (e.g. `assets/icons/trophy.png`). |
| `category` | String | No | `"General"` | Organization category for UI filtering. |
| `hidden` | Boolean | No | `false` | If `true`, title/description hidden with `???` until unlocked. |
| `maxSteps` | Integer | No | `1` | Denominator for progressive achievements (`step / maxSteps`). If `1`, binary unlock. |
| `points` | Integer | No | `10` | Platform XP / Gamerscore granted upon unlock. |

### 3.2 Leaderboards Schema (`leaderboards[]`)

| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | **Yes** | — | Unique alphanumeric identifier (e.g. `highScore`, `speedrun_world_1`). |
| `name` | Dict/String | **Yes** | — | Localized leaderboard display title. |
| `description`| Dict/String | No | `""` | Detailed description of leaderboard rules/conditions. |
| `sortOrder` | String | No | `"desc"` | `"desc"` (descending: higher score wins) or `"asc"` (ascending: lower time/score wins). |
| `unit` | String | No | `"pts"` | Metric unit label rendered beside scores (e.g. `pts`, `coins`, `kills`, `ms`). |
| `scoreFormat`| String | No | `"number"`| Presentation formatter: `"number"` (`1,234`), `"duration_ms"` (`01:23.45`), `"currency"` (`$100`). |
| `aggregation`| String | No | `"max"` | Best-score filter rule: `"max"` (highest score), `"min"` (lowest score), or `"latest"`. |
| `version` | Integer | No | `1` | Leaderboard epoch version. Incremented when scoring logic changes. |
| `resetPolicy`| String | No | `"never"` | Scoreboard retention schedule (`"never"`, `"daily"`, `"weekly"`, `"seasonal"`). |

---

## 4. Submission Contracts (Client SDK)

The Game SDK provides typed, promise-based interfaces for gameplay event emission:

```typescript
// ---------------------------------------------------------------------------
// Achievements API
// ---------------------------------------------------------------------------

// 1. Binary Unlock (Instantly sets percentComplete = 100 and unlocked = true)
await window.WGCP.achievements.unlock('tile_2048');

// 2. Incremental Step (Adds step count towards maxSteps)
// e.g. Collected 5 coins towards maxSteps: 100
await window.WGCP.achievements.increment('coins_100', 5);

// 3. Absolute Progress (Sets specific percent 0..100)
await window.WGCP.achievements.setProgress('speedrunner', 75);

// ---------------------------------------------------------------------------
// Leaderboards API
// ---------------------------------------------------------------------------

// 1. Primary Leaderboard Submit (Defaults to leaderboard 'highScore')
await window.WGCP.leaderboards.submit(16384);

// 2. Explicit Leaderboard Submit with Context Metadata
await window.WGCP.leaderboards.submitTo('speedrun_world_1', 42150, {
  character: 'Tux',
  difficulty: 'Hard'
});
```

---

## 5. In-Depth Edge Case Reasoning & Resolutions

### Edge Case 1: Game Updates Add New Achievements (Release v1.0 ➔ v1.1)
* **Problem**: A player unlocked 5 of 5 achievements in v1.0 (100% completion). Game developer pushes v1.1 adding 3 new achievements.
* **Resolution**:
  1. The platform database uses a composite primary key `(user_id, game_id, achievement_id)`. Unlocks are stored per ID and never wiped on registration updates.
  2. The portal dynamically calculates trophy completion against the active manifest:
     $$\text{Completion \%} = \frac{\text{Unlocked User Records matching active manifest}}{\text{Total Active Achievements in Manifest}} \times 100$$
  3. The player's display automatically reflects `5 / 8 trophies (62%)` on v1.1 boot without database migration scripts.

---

### Edge Case 2: Game Deprecates or Renames an Achievement ID
* **Problem**: Game developer changes `id: boss_dragon` to `id: boss_infernal_dragon` or removes an obsolete achievement.
* **Resolution**:
  1. Unlocked records with orphaned IDs in PostgreSQL remain preserved in user history (`achievements` table) for auditability.
  2. The portal dashboard filters its showcase against the active `registry.json` manifest. Orphaned achievements are hidden from the primary game card, but their granted XP remains credited to the player's lifetime platform score.

---

### Edge Case 3: Leaderboard Unit & Scoring Formula Changes (Scale Shift)
* **Problem**: Game v1.0 logged speedrun scores in seconds (`unit: "s"`, score: `45`). Game v2.0 updates precision to milliseconds (`unit: "ms"`, score: `45000`). Existing DB entries on the old scale would permanently corrupt rankings.
* **Resolution**:
  1. When scoring scale or formulas change, developer increments the `version` field in `game.yaml` (e.g. `version: 2`) or uses a new leaderboard ID (`speedrun_v2`).
  2. The backend scopes leaderboard rankings by `(game_id, leaderboard_id, version)`.
  3. The portal dashboard automatically defaults to displaying the latest epoch `version`, archiving historical leaderboards for past seasons.

---

### Edge Case 4: Inverted Sort Orders (Ascending vs Descending)
* **Problem**: Arcade scores require highest-first (`sortOrder: "desc"`), whereas time-trials, golf strokes, and speedruns require lowest-first (`sortOrder: "asc"`).
* **Resolution**:
  1. The backend inspects the game's manifest `sortOrder` rule during score submission and queries.
  2. **Personal Best Logic**:
     * For `sortOrder: "desc"`: Upsert if `newScore > existingScore`.
     * For `sortOrder: "asc"`: Upsert if `newScore < existingScore`.
  3. **Table Sorting**:
     * `ORDER BY score ASC` for `asc` leaderboards (rank #1 is smallest number).
     * `ORDER BY score DESC` for `desc` leaderboards (rank #1 is largest number).

---

### Edge Case 5: Offline Play & Disconnection Queuing
* **Problem**: Player achieves high score or unlocks achievement while offline or on an intermittent network.
* **Resolution**:
  1. The SDK double-buffers pending unlocks in local `IndexedDB` storage with client timestamp and generated UUIDv4 `txId`.
  2. When network or portal bridge connectivity is re-established, the SDK automatically drains the queue.
  3. The portal backend checks idempotency (`txId`) and updates `updated_at` with the original client event millisecond timestamp, preventing duplicate unlock banners or lost offline progress.

---

### Edge Case 6: Cross-Origin Icon Asset Resolution
* **Problem**: An achievement specifies an image icon relative to the game container: `icon: "assets/trophy.png"`. The portal UI runs at `http://localhost` while the game runs at `http://supertux.localhost`.
* **Resolution**:
  1. If `icon` is an emoji glyph or absolute URL (`http://...`), the portal renders it directly.
  2. If `icon` is a relative path (`assets/...` or `/icons/...`), the portal dynamically prepends the canonical game origin:
     $$\text{Resolved Icon URL} = \text{game.hosting.hostname} + \text{"/"} + \text{icon.replace(/^\//, '')}$$
  3. The Caddy ingress gateway serves the asset with proper cross-origin caching headers.

---

### Edge Case 7: Dynamic Unregistered Achievement Fallback
* **Problem**: A game script invokes `WGCP.achievements.unlock('easter_egg')` which was accidentally omitted from `game.yaml`.
* **Resolution**:
  1. The backend accepts the unlock event to guarantee zero broken JavaScript promises for the game client.
  2. The dashboard detects the ID is missing from `registry.json` and creates a **synthetic achievement entry**:
     * `title`: Converted from snake_case (`"Easter Egg"`).
     * `description`: `"Platform registered achievement."`
     * `icon`: `"🏆"` (Default console trophy).

---

## 6. Registration CLI & Registry Integration

During `./platform.sh game add <path>`:
1. The registration validator parses and validates the `achievements` and `leaderboards` blocks against the v2.1.0 schema.
2. The normalized structures are compiled into `platform/registry/games.json` under `games[gameId].services.achievements` and `games[gameId].services.leaderboards`.
3. The Portal frontend consumes `/api/registry.json` as the single source of truth, eliminating hardcoded metadata.

---

## 7. Migration Plan

1. **Step 1**: Adopt Proposal P-006 as an official architectural standard.
2. **Step 2**: Add `achievements` and `leaderboards` declarations to all testbed games (`2048`, `hextris`, `a-dark-room`, `browserquest`, `supertux`).
3. **Step 3**: Update registration compiler (`platform/scripts/register.sh` or registry generator) to export `services` metadata into `registry.json`.
4. **Step 4**: Update `portal/frontend` to dynamically read achievement and leaderboard manifests from `game.services` in `registry.json`.

---

[^p003-services-api]: Game Services API Specification (`/proposals/P-003-game-sdk-services-api.md`)
