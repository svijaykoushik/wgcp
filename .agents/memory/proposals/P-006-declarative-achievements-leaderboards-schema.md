---
type: Proposal
proposal_id: P-006
title: Declarative Game Services Schema (Achievements & Leaderboards) for game.yaml and Registry v2.2
description: Formal specification proposal extending and superseding P-001 (Game Registry Specification v2) upon acceptance, codifying versioned declarative achievements, enhanced multi-dimensional leaderboards in game.yaml and games.json, clean platform-vs-game trust boundaries, and operational lifecycle edge cases.
status: proposed
generated: { by: antigravity/3.7, at: 2026-09-10T22:50:00+05:30 }
sources:
  - id: p001-registry
    resource: /proposals/P-001-game-registry-spec-v2.md
    title: Game Registry Specification (v2)
  - id: d003-registry-v2
    resource: /decisions/D-003-accept-registry-spec-v2.md
    title: Decision to adopt Game Registry Specification (v2)
  - id: game-integration-spec
    resource: /game_integration.md
    title: Game Integration & Packaging Contract (Registry v2)
  - id: p002-storage-sync
    resource: /proposals/P-002-game-sdk-storage-sync.md
    title: Game SDK Storage Sync Specification
  - id: p003-services-api
    resource: /proposals/P-003-game-sdk-services-api.md
    title: Game Services API Specification
  - id: d006-invariants
    resource: /decisions/D-006-epoch-timestamp-and-sdk-invariants.md
    title: BigInt Timestamps, SDK Feature Centralization, and Test Isolation
supersedes:
  - id: p001-registry
    resource: /proposals/P-001-game-registry-spec-v2.md
    title: Game Registry Specification (v2)
---

# Proposal (P-006) - Declarative Game Services Schema for `game.yaml` and Registry v2.2

## 1. Executive Summary & Supersession Notice

This proposal defines the **Game Registry Specification (v2.2)** and the declarative contract for **Game Services (Achievements and Leaderboards)** in `game.yaml`.

> [!IMPORTANT]
> **Supersession Notice:** Upon formal ratification and acceptance, this specification will **supersede Proposal [P-001: Game Registry Specification (v2)](/proposals/P-001-game-registry-spec-v2.md)** and update the canonical integration contract [`/game_integration.md`](/game_integration.md) from schema version `2.0.0` to `2.2.0`.

### 1.1. Architectural Invariant & Clean Trust Boundaries

1. **Zero Hardcoded Platform Metadata**: The platform must not hardcode game-specific metadata, trophy definitions, scoring mechanics, or arbitrary icons in frontend code. Games must remain 100% autonomous, declarative, and self-contained.
2. **Division of Platform vs Game Responsibilities**:
   * **Platform Responsibilities**:
     * **Identity & Authentication**: Enforce that Player A can only submit scores for Player A's account.
     * **Origin & Sandbox Isolation**: Guarantee that `2048.localhost` cannot submit scores/achievements on behalf of `supertux` or other games.
     * **Storage & Transport Hygiene**: Enforce strict data types (finite numbers, max 2KB metadata payload limit) to protect the backend database from malformed data or DoS attacks.
     * **Compilation, Indexing & Presentation**: Compile game manifests into `games.json`, calculate ranks, order results (`asc`/`desc`), and project spatial console UI dashboards.
   * **Game Responsibilities**:
     * **Gameplay Logic & Anti-Cheat**: Gameplay simulation, scoring formulas, physics calculations, and in-game anti-tamper are the exclusive domain of the game. The platform **must not** implement game-specific score velocity heuristics or guess whether a score is "physically plausible".

---

## 2. P-001 Baseline & What Changes in v2.2

Under [P-001](/proposals/P-001-game-registry-spec-v2.md), WGCP adopted an F-Droid v2-inspired decoupled registry structure (`repo` metadata, separated `metadata` and `releases` blocks, inline localization dictionaries).

### What v2.2 Adds to P-001:
* **Declarative Achievements Manifest (`achievements`)**: Versioned, localized achievement definitions in `game.yaml` compiled into `games.<id>.services.achievements`.
* **Enhanced Leaderboards Manifest (`leaderboards`)**:
  * **Categorical Grouping (`group`)**: Organizes multi-stage or multi-mode leaderboards (e.g. "World 1 Speedruns", "4x4 Classic Grid") for spatial console navigation.
  * **Score Formatting & Precision (`scoreType`, `decimalPlaces`, `unitPosition`)**: Native support for precise speedrun times (`duration_ms` with millisecond decimals), formatted currencies, and prefix/suffix units.
  * **Deterministic Tie-Breaking (`tieBreaker`)**: Explicit ordering (`first_achieved` vs `latest_achieved`) when player scores match.
  * **Structured Metadata Schemas (`metadataSchema`)**: Declaratively defines custom score attributes (e.g. `moves: integer`, `character: string`) with automatic UI badge formatting and hard 2KB payload bounding.
  * **Temporal Resets & Snapshot Archives (`resetSchedule`, `archivePolicy`)**: Precise cron-based tournament resets with historical top-100 snapshot archival.
* **Schema Version Declaration (`specVersion: "2.2.0"`)**: Explicit SemVer manifest validation during registration (`./platform.sh game add`).

---

## 3. The `game.yaml` Contract (v2.2.0 Example)

Every hosted game declares its metadata, runtime, and game services in its root `game.yaml`:

```yaml
# Schema Version
specVersion: "2.2.0"

id: "2048"
license: "MIT"
upstream: "https://github.com/gabrielecirulli/2048"
issueTracker: "https://github.com/gabrielecirulli/2048/issues"
developer:
  name: "Gabriele Cirulli"
  website: "https://gabrielecirulli.com"

# -----------------------------------------------------------------------------
# 1. Localized App Listings (F-Droid v2 inline dictionary)
# -----------------------------------------------------------------------------
name:
  en-US: "2048"
  es-ES: "2048"
summary:
  en-US: "The iconic sliding tile puzzle game."
  es-ES: "El icónico juego de rompecabezas de fichas deslizantes."
description:
  en-US: "Join matching numbers to reach the legendary 2048 tile."
  es-ES: "Une los números iguales para alcanzar la legendaria ficha 2048."

categories:
  - "Puzzle"

multiplayer: false

graphics:
  icon: "🔢"
  screenshots:
    desktop:
      - name: "assets/screenshot1.png"

# -----------------------------------------------------------------------------
# 2. Release & Runtime Orchestration
# -----------------------------------------------------------------------------
release:
  version: "1.0.0"
  channel: "stable"
  whatsNew:
    en-US: "Production release with full console SDK integration."
    es-ES: "Lanzamiento de producción con integración completa de SDK de consola."
  runtime:
    type: "docker"
    service: "game-2048"
    port: 80
  hosting:
    hostname: "2048.localhost"
    capabilities:
      - "gamepad"

# -----------------------------------------------------------------------------
# 3. Declarative Game Services Manifest (v2.2.0)
# -----------------------------------------------------------------------------
achievements:
  - id: "tile_256"
    name:
      en-US: "Quarter Grand"
      es-ES: "Cuarto de Mil"
    description:
      en-US: "Merge tiles to create the 256 number tile."
      es-ES: "Combina fichas para crear la ficha 256."
    icon: "🔢"                         # Emoji glyph or container path (e.g. "assets/icons/256.png")
    category: "Progression"            # Optional category group
    hidden: false                      # If true, name/description masked in portal until unlocked
    maxSteps: 1                        # 1 = binary unlock, >1 = progressive counter
    points: 10                         # Platform XP / Gamerscore granted upon unlock

  - id: "tile_2048"
    name:
      en-US: "The Legend 2048"
      es-ES: "La Leyenda 2048"
    description:
      en-US: "Reach the ultimate 2048 victory tile!"
    icon: "🏆"
    maxSteps: 1
    points: 50

leaderboards:
  - id: "highScore"
    name:
      en-US: "High Score"
      es-ES: "Puntuación Máxima"
    description:
      en-US: "Highest points scored in a single classic session."
    group:
      en-US: "Classic Mode"
      es-ES: "Modo Clásico"
    sortOrder: "desc"                  # "desc" (higher is better) | "asc" (lower is better, e.g. time)
    scoreType: "integer"               # "integer" | "decimal" | "duration_ms" | "currency"
    unit: "pts"                        # Suffix rendered beside scores
    unitPosition: "suffix"             # "suffix" | "prefix"
    aggregation: "max"                 # "max" | "min" | "latest" | "sum"
    tieBreaker: "first_achieved"       # "first_achieved" | "latest_achieved"
    version: 1                         # Monotonic integer epoch for rule/scoring updates
    resetPolicy: "never"               # "never" | "daily" | "weekly" | "seasonal"
    metadataSchema:
      moves:
        type: "integer"
        label:
          en-US: "Moves"
      highestTile:
        type: "integer"
        label:
          en-US: "Highest Tile"
```

---

## 4. Comprehensive Property Specifications for Registry v2.2

### 4.1. `game.yaml` Top-Level & Metadata Properties

| Property | Type | Required | Default / Fallback | Description |
| :--- | :--- | :---: | :--- | :--- |
| `specVersion` | `String` | No | `"2.2.0"` | SemVer specification version of the manifest format. |
| `id` | `String` | **Yes** | — | Unique lowercase alphanumeric slug identifying the game (e.g. `2048`, `hextris`, `adarkroom`, `supertux`). Must match regex `^[a-z0-9_-]+$`. |
| `name` | `Dict` \| `String` | **Yes** | — | Localized display name. If provided as a string, mapped to `{"en-US": string}`. Key `en-US` is mandatory. |
| `summary` | `Dict` \| `String` | No | `{"en-US": ""}` | Short one-line marketing synopsis displayed in console cards and catalog previews. |
| `description` | `Dict` \| `String` | No | `{"en-US": ""}` | Full multi-paragraph gameplay description shown on game detail dialogs. |
| `license` | `String` | No | `"Proprietary"` | Standard SPDX license identifier (e.g., `MIT`, `GPL-3.0-or-later`, `Apache-2.0`). |
| `upstream` | `String (URI)` | No | — | Public URL to the game's upstream source code repository or homepage. |
| `issueTracker` | `String (URI)` | No | — | URL to issue tracker for bug reporting and feedback. |
| `developer` | `Dict` \| `String` | No | — | Author metadata. String maps to `{"name": string}`. Object supports `name: String` and `website: String (URI)`. |
| `categories` | `Array<String>` | No | `[]` | List of platform classification genres (e.g., `["Puzzle", "Arcade", "MMORPG"]`). |
| `multiplayer` | `Boolean` | No | `false` | Indicates whether the title supports local or networked multiplayer modes. |
| `graphics.icon` | `Dict` \| `String` | No | `"🎮"` | Unicode emoji glyph or relative container asset path for catalog icons. |
| `graphics.screenshots`| `Dict` | No | `{}` | Screenshots object containing device arrays (e.g. `desktop: [{ name: "assets/shot1.png" }]`). |

---

### 4.2. `game.yaml` Release & Runtime Properties (`release.*`)

| Property | Type | Required | Default / Fallback | Description |
| :--- | :--- | :---: | :--- | :--- |
| `release.version` | `String` | **Yes** | — | SemVer release version of the game workload (e.g., `"1.0.0"`). |
| `release.channel` | `String` | **Yes** | `"stable"` | Target deployment channel (e.g., `"stable"`, `"beta"`, `"nightly"`). |
| `release.whatsNew` | `Dict` \| `String` | No | `{"en-US": ""}` | Localized changelog highlights for this release. |
| `release.runtime.type` | `String` | **Yes** | `"docker"` | Orchestration execution environment type (`"docker"`). |
| `release.runtime.service` | `String` | **Yes** | — | Exact Docker Compose service name corresponding to the workload (e.g., `"game-2048"`). |
| `release.runtime.port` | `Integer` | **Yes** | `80` | Internal container port exposing the HTTP server. |
| `release.runtime.image` | `String` | No | — | Explicit container image tag (optional if built dynamically via Compose). |
| `release.hosting.hostname` | `String` | **Yes** | — | Local domain routed by Caddy reverse proxy (e.g., `"2048.localhost"`). |
| `release.hosting.capabilities`| `Array<String>` | No | Default baseline | Browser API permissions requested for the iframe `allow` attribute (e.g. `["gamepad", "autoplay"]`). |
| `release.hosting.websockets` | `Boolean` | No | `false` | Enables WebSocket proxy forwarding support in Caddy configuration. |

---

### 4.3. `game.yaml` Declarative Achievements Properties (`achievements[]`)

| Property | Type | Required | Default / Fallback | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | **Yes** | — | Unique identifier for the achievement within the game (e.g. `tile_2048`, `fire_stoked`). Matches regex `^[a-zA-Z0-9_-]+$`. |
| `name` | `Dict` \| `String` | **Yes** | — | Localized achievement title. String auto-promotes to `{"en-US": string}`. |
| `description` | `Dict` \| `String` | **Yes** | — | Localized description of the unlock criteria or lore snippet. |
| `icon` | `String` | No | `"🏆"` | Unicode emoji glyph or relative container asset path (e.g. `assets/icons/trophy.png`). |
| `category` | `String` | No | `"General"` | Organizational badge/grouping (e.g., `"Progression"`, `"Secret"`, `"Mastery"`). |
| `hidden` | `Boolean` | No | `false` | When `true`, title/description are masked with spoiler placeholders in the portal until unlocked by the user. |
| `maxSteps` | `Integer` | No | `1` | Total step target for progression. `1` denotes binary single-trigger unlocks; `>1` enables progress bar tracking. |
| `points` | `Integer` | No | `10` | Platform XP / Gamerscore credited to player account upon unlocking. |

---

### 4.4. `game.yaml` Enhanced Leaderboards Properties (`leaderboards[]`)

| Property | Type | Required | Default / Fallback | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | **Yes** | — | Unique leaderboard identifier within the game (e.g. `highScore`, `speedrun_world1_level1`). Matches regex `^[a-zA-Z0-9_-]+$`. |
| `name` | `Dict` \| `String` | **Yes** | — | Localized leaderboard display title. |
| `description` | `Dict` \| `String` | No | `{"en-US": ""}` | Localized description of scoring criteria and rules. |
| `group` | `Dict` \| `String` | No | `{"en-US": "General"}` | Localized grouping header for categorizing leaderboards into sets (e.g. "World 1 Speedruns", "Grid Sizes", "Difficulty"). |
| `sortOrder` | `String` | No | `"desc"` | Sorting hierarchy: `"desc"` (higher score is better; arcade points) or `"asc"` (lower score is better; time trials / golf strokes). |
| `scoreType` | `String` | No | `"integer"` | Data representation: `"integer"` (discrete points), `"decimal"` (floating points), `"duration_ms"` (elapsed milliseconds), or `"currency"`. |
| `decimalPlaces` | `Integer` | No | `0` (or `3` for `duration_ms`) | Number of decimal places rendered in portal views (0 to 3). |
| `unit` | `String` | No | `"pts"` | Formatted unit label displayed adjacent to numerical scores (e.g. `"pts"`, `"s"`, `"moves"`, `"$"`). |
| `unitPosition` | `String` | No | `"suffix"` | Placement of unit symbol: `"suffix"` (`150 pts`, `42.5 s`) or `"prefix"` (`$ 500`). |
| `aggregation` | `String` | No | `"max"` | Best-score aggregation rule: `"max"` (highest record kept), `"min"` (lowest record kept), `"latest"` (most recent submission), or `"sum"`. |
| `tieBreaker` | `String` | No | `"first_achieved"` | Deterministic tie-breaker rule when scores match: `"first_achieved"` (earlier `updatedAt` wins) or `"latest_achieved"` (most recent wins). |
| `version` | `Integer` | No | `1` | Monotonic schema/scoring epoch integer. Incrementing isolates competition epochs without deleting legacy archive history. |
| `resetPolicy` | `String` | No | `"never"` | Recurrence cadence: `"never"`, `"daily"`, `"weekly"`, or `"seasonal"`. |
| `resetSchedule` | `String (Cron)`| No | — | Optional 5-field UTC Cron expression defining exact reset trigger (e.g. `"0 0 * * 1"` for Mondays 00:00 UTC). |
| `archivePolicy` | `String` | No | `"snapshot"` | Archival behavior upon reset: `"snapshot"` (persists top-100 historical snapshot) or `"purge"`. |
| `metadataSchema` | `Dict` | No | `{}` | Dictionary defining allowed metadata attributes submitted with score (e.g., `moves: { type: "integer", label: { en-US: "Moves" } }`). Enforces max 2KB payload size. |

---

### 4.5. Compiled Central Registry Index (`games.json` v2.2 Structure)

```json
{
  "repo": {
    "name": { "en-US": "Local Games Platform" },
    "description": { "en-US": "Decentralized collection of hosted HTML5 games." },
    "address": "http://localhost",
    "timestamp": 1788800000,
    "releaseChannels": {
      "stable": { "name": { "en-US": "Stable" }, "description": { "en-US": "Production-ready game versions." } }
    },
    "genres": ["Puzzle", "Arcade", "MMORPG", "Text Adventure", "2D Platformer"],
    "mirrors": []
  },
  "games": {
    "2048": {
      "metadata": {
        "added": 1786800000,
        "lastUpdated": 1788800000,
        "license": "MIT",
        "upstream": "https://github.com/gabrielecirulli/2048",
        "issueTracker": "https://github.com/gabrielecirulli/2048/issues",
        "developer": {
          "name": "Gabriele Cirulli",
          "website": "https://gabrielecirulli.com"
        },
        "name": { "en-US": "2048", "es-ES": "2048" },
        "summary": { "en-US": "The iconic sliding tile puzzle game." },
        "description": { "en-US": "Join matching numbers to reach the legendary 2048 tile." },
        "categories": ["Puzzle"],
        "multiplayer": false,
        "graphics": {
          "icon": { "en-US": "🔢" },
          "screenshots": {
            "desktop": [{ "name": "assets/screenshot1.png" }]
          }
        }
      },
      "releases": {
        "stable-v1.0.0": {
          "added": 1786800000,
          "version": "1.0.0",
          "releaseChannels": ["stable"],
          "whatsNew": { "en-US": "Production release with full console SDK integration." },
          "runtime": { "type": "docker", "service": "game-2048", "port": 80 },
          "hosting": { "hostname": "2048.localhost", "capabilities": ["gamepad"] }
        }
      },
      "services": {
        "achievements": [
          {
            "id": "tile_256",
            "name": { "en-US": "Quarter Grand", "es-ES": "Cuarto de Mil" },
            "description": { "en-US": "Merge tiles to create the 256 number tile." },
            "icon": "🔢",
            "category": "Progression",
            "hidden": false,
            "maxSteps": 1,
            "points": 10
          },
          {
            "id": "tile_2048",
            "name": { "en-US": "The Legend 2048" },
            "description": { "en-US": "Reach the ultimate 2048 victory tile!" },
            "icon": "🏆",
            "category": "Progression",
            "hidden": false,
            "maxSteps": 1,
            "points": 50
          }
        ],
        "leaderboards": [
          {
            "id": "highScore",
            "name": { "en-US": "High Score", "es-ES": "Puntuación Máxima" },
            "description": { "en-US": "Highest points scored in a single classic session." },
            "group": { "en-US": "Classic Mode", "es-ES": "Modo Clásico" },
            "sortOrder": "desc",
            "scoreType": "integer",
            "decimalPlaces": 0,
            "unit": "pts",
            "unitPosition": "suffix",
            "aggregation": "max",
            "tieBreaker": "first_achieved",
            "version": 1,
            "resetPolicy": "never",
            "metadataSchema": {
              "moves": { "type": "integer", "label": { "en-US": "Moves" } },
              "highestTile": { "type": "integer", "label": { "en-US": "Highest Tile" } }
            }
          }
        ]
      }
    }
  }
}
```

---

## 5. Client Submission Contracts (Game SDK)

Games submit events through the standalone Game SDK (`wgcp-sdk.js`):

```typescript
// 1. Achievements Triggering
await window.WGCP.achievements.unlock('tile_2048');
await window.WGCP.achievements.increment('coins_100', 5);

// 2. Leaderboards Submission
await window.WGCP.leaderboards.submit(8192);
await window.WGCP.leaderboards.submitTo('highScore', 8192, {
  moves: 420,
  highestTile: 2048
});
```

---

## 6. Deep Reasoning on Lifecycle & Operational Edge Cases

### Edge Case 1: Game Updates Add New Achievements (Release v1.0 ➔ v1.1)
* **Scenario**: Player has 100% completion (5/5 trophies) on v1.0. The developer pushes v1.1 with 3 additional trophies.
* **Resolution**:
  1. PostgreSQL records are keyed by composite `(user_id, game_id, achievement_id)` and are never deleted during registration updates.
  2. The portal dynamically calculates completion percentage against the active manifest:
     $$\text{Completion \%} = \frac{\text{Count of user unlock rows matching active manifest}}{\text{Total achievements declared in active manifest}} \times 100$$
  3. Player immediately sees `5 / 8 trophies (62%)` on boot without database migrations.

### Edge Case 2: Deprecating or Renaming Achievement IDs
* **Scenario**: A developer renames `id: boss_dragon` to `id: boss_inferno_dragon` or deletes an achievement.
* **Resolution**:
  1. Historical unlocks in PostgreSQL remain intact for audit logs and lifetime player XP calculations.
  2. The portal dashboard filters its display strictly against the active manifest in `registry.json`. Unlisted/deprecated achievement IDs are omitted from the active game showcase while their awarded XP remains credited to the player's account.

### Edge Case 3: Leaderboard Unit & Scoring Formula Scale Changes
* **Scenario**: Game v1.0 scored time in seconds (`unit: "s"`, score: `45`). Game v2.0 updates precision to milliseconds (`unit: "ms"`, score: `45000`).
* **Resolution**:
  1. Whenever scoring scales change, the developer increments the `version` field in `game.yaml` (e.g. `version: 2`) or introduces a new ID (`speedrun_v2`).
  2. The backend database and queries scope rankings by `(game_id, leaderboard_id, version)`.
  3. The portal dashboard defaults to displaying the active `version` epoch, cleanly archiving previous seasons.

### Edge Case 4: Inverted Sort Orders (Ascending vs Descending)
* **Scenario**: Time-trials, golf strokes, and speedruns require lowest score first (`sortOrder: "asc"`), while arcade games require highest score first (`sortOrder: "desc"`).
* **Resolution**:
  1. The backend inspects `sortOrder` from the game manifest.
  2. **Personal Best Evaluation**:
     * `sortOrder: "desc"`: Upsert if `newScore > existingScore`.
     * `sortOrder: "asc"`: Upsert if `newScore < existingScore`.
  3. **SQL Query**:
     * `ORDER BY score ASC, updated_at ASC` for `asc` leaderboards (rank #1 is lowest value; earlier timestamp breaks ties).
     * `ORDER BY score DESC, updated_at ASC` for `desc` leaderboards (rank #1 is highest value; earlier timestamp breaks ties).

### Edge Case 5: Offline Play & Reconnection Queuing
* **Scenario**: Player unlocks achievements while offline or on intermittent connectivity.
* **Resolution**:
  1. The SDK double-buffers pending events in `IndexedDB` with client timestamps and UUIDv4 `txId`s.
  2. Upon reconnection / window focus, the SDK automatically drains the queue.
  3. The backend processes the batch idempotently via `txId`, preserving original event timestamps.

### Edge Case 6: Cross-Origin Icon Asset Resolution
* **Scenario**: An achievement specifies a container asset path (`icon: "assets/trophy.png"`). The portal runs at `http://localhost` while the game runs at `http://supertux.localhost`.
* **Resolution**:
  1. Unicode emoji glyphs are rendered as text.
  2. Relative paths are dynamically converted by the portal to the game's canonical origin:
     $$\text{Asset URL} = \text{http://} + \text{game.hosting.hostname} + \text{"/"} + \text{icon.replace(/^\//, '')}$$
  3. The Caddy gateway serves the image with appropriate CORS headers.

### Edge Case 7: Dynamic Unregistered Achievement Fallback
* **Scenario**: A game triggers an achievement ID omitted from `game.yaml` (e.g. dynamic Easter egg).
* **Resolution**:
  1. The backend accepts the unlock event (avoiding rejected promises in the game loop).
  2. The portal synthesizes a clean fallback entry with title-cased formatting (e.g., `secret_boss` ➔ `"Secret Boss"`) and default trophy glyph 🏆.

---

## 7. Migration Plan & P-001 Supersession Steps

1. **Formal Acceptance**: Ratify P-006 via decision record `D-009-accept-declarative-services-spec-v2-2.md`, formally marking P-001 as `superseded`.
2. **Contract Update**: Update [`/game_integration.md`](/game_integration.md) to codify the v2.2.0 schema with the comprehensive property tables.
3. **Testbed Manifest Updates**: Update `game.yaml` files across testbed games (`games/2048/game.yaml`, `games/hextris/game.yaml`, `games/adarkroom/game.yaml`, `games/BrowserQuest/game.yaml`, `games/supertux/game.yaml`).
4. **Registration Compiler**: Update the registration script to parse and export `services` blocks into `platform/registry/games.json`.
5. **Backend Clean Boundaries Refactor**: Refactor `server.ts` to remove hardcoded gameplay anti-cheat heuristics, enforcing clean origin/user verification and 2KB payload bounding.
6. **Frontend Dynamic Ingestion**: Update portal views to read metadata directly from `/api/registry.json`, grouping leaderboards by `group` and formatting score badges dynamically.
