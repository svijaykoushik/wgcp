---
type: Proposal
proposal_id: P-006
title: Declarative Game Services Schema (Achievements & Leaderboards) for game.yaml and Registry v2.3
description: Formal specification proposal extending and superseding P-001 (Game Registry Specification v2) upon acceptance, codifying versioned declarative achievements, enhanced multi-dimensional leaderboards in game.yaml and games.json, clean trust boundaries, comprehensive security hardening against XSS/DoS/prototype pollution, atomic batch unlocks, secret trophy masking, around-player windowing, and operational lifecycle edge cases.
status: proposed
generated: { by: antigravity/3.7, at: 2026-09-10T23:33:00+05:30 }
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
  - id: i012-services-audit
    resource: /investigations/I-012-game-services-implementation-gaps-and-bugs.md
    title: Game Services Implementation Bugs & Operational Audit
supersedes:
  - id: p001-registry
    resource: /proposals/P-001-game-registry-spec-v2.md
    title: Game Registry Specification (v2)
---

# Proposal (P-006) - Declarative Game Services Schema for `game.yaml` and Registry v2.3

## 1. Executive Summary & Supersession Notice

This proposal defines the **Game Registry Specification (v2.3)** and the declarative contract for **Game Services (Achievements and Leaderboards)** in `game.yaml`.

> [!IMPORTANT]
> **Supersession Notice:** Upon formal ratification and acceptance, this specification will **supersede Proposal [P-001: Game Registry Specification (v2)](/proposals/P-001-game-registry-spec-v2.md)** and update the canonical integration contract [`/game_integration.md`](/game_integration.md) from schema version `2.0.0` to `2.3.0`.

---

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

### 1.2. Security Invariants & Threat Protections (v2.3 Hardening)

* **SEC-01: Manifest Injection & XSS Immunity**:
  * All manifest string fields (`name`, `summary`, `description`) are treated as plain text strings, never rendered through HTML sinks or `dangerouslySetInnerHTML`.
  * `icon` fields are strictly validated during registration: must be either a single Unicode emoji/grapheme ($\le 4$ codepoints) or a relative path matching regex `^[a-zA-Z0-9_\-\/]+\.(png|jpg|jpeg|svg|webp)$`. Slashes and `..` traversal are strictly rejected.
* **SEC-02: Path Traversal & Origin Confinement**:
  * Relative asset URLs are resolved strictly against the game's canonical origin (`http://<game.hosting.hostname>/<path>`). Directory traversal sequences (`..`, `//`, `\`) and external scheme smuggling are blocked.
* **SEC-03: Metadata DoS & Prototype Pollution Guard**:
  * Leaderboard metadata payloads are bounded to a **2KB maximum byte-length** (`z.string().max(2048)`).
  * Backend parsers strip prototype-polluting keys (`__proto__`, `constructor`, `prototype`) and restrict nesting depth to $\le 2$ with primitive values only.
* **SEC-04: Session-Bound Guest State Migration**:
  * The migration endpoint (`/api/v1/games/:gameId/migrate-guest`) derives identity strictly from server-side authenticated sessions, rejecting client-declared `userId`s to prevent account takeover.
  * Score reconciliation enforces monotonic personal best checks (`ON CONFLICT DO UPDATE WHERE new.score > existing.score` for desc).
* **SEC-05: Cron Injection & Worker DoS Defense**:
  * Leaderboard `resetSchedule` must adhere to standard 5-field UTC cron syntax with a mandatory minimum interval of **24 hours** (e.g. `@daily`, `@weekly`). Sub-daily cron schedules are rejected during registration.
* **SEC-06: Bounded Idempotency Storage**:
  * Backend transaction `txId` deduplication must use a bounded LRU cache (10,000 entries with a 24-hour TTL) or a PostgreSQL table with automated expiration, preventing memory exhaustion OOM crashes.

---

## 2. Requirements & Acceptance Criteria (EARS)

### Feature: Declarative Manifest Validation & Compilation
* **R1.1 (Manifest Schema Validation)**:
  * `WHEN a game manifest is registered via platform.sh THEN the registration compiler SHALL validate specVersion: "2.3.0" against the declarative achievements and leaderboards schema.`
* **R1.2 (Security Sanitization)**:
  * `WHEN compiling icons and asset strings in game.yaml THEN the compiler SHALL reject directory traversal sequences (../, \\) and enforce single Unicode grapheme or relative path constraints.`

### Feature: Achievements Runtime & State Sync
* **R2.1 (Atomic Batch Unlock)**:
  * `WHEN a game client submits an unlockBatch envelope with multiple achievement IDs THEN the backend SHALL persist all valid unlocks in a single atomic transaction and return the updated progression state.`
* **R2.2 (Secret Trophy Masking)**:
  * `WHILE an achievement has hidden: true AND is not yet unlocked by the authenticated user THEN SDK query endpoints and portal views SHALL mask its name, summary, and description.`
* **R2.3 (Step Progress Calculation)**:
  * `WHEN a game submits an increment progress event for a stepped achievement THEN the backend SHALL compute completion percentage as (currentSteps / maxSteps) * 100.`

### Feature: Leaderboards & Ranking
* **R3.1 (Multi-Dimensional Ordering & Tie-Breaking)**:
  * `WHEN evaluating leaderboard ranks for sortOrder: "desc" THEN the backend SHALL order by score DESC, updated_at ASC; WHEN sortOrder: "asc" THEN the backend SHALL order by score ASC, updated_at ASC.`
* **R3.2 (Around-Player Rank Windowing)**:
  * `WHEN a client requests leaderboard scores with window: "around_player" AND radius: N THEN the API SHALL return the requesting user's score centered within a +/- N rank window.`
* **R3.3 (Payload Hygiene & Metadata Bounding)**:
  * `WHEN a leaderboard score submission includes a metadata JSON payload THEN the backend SHALL validate that the payload length <= 2048 bytes and strip prototype-polluting keys (__proto__, constructor).`

---

## 3. P-001 Baseline & What Changes in v2.3


Under [P-001](/proposals/P-001-game-registry-spec-v2.md), WGCP adopted an F-Droid v2-inspired decoupled registry structure (`repo` metadata, separated `metadata` and `releases` blocks, inline localization dictionaries).

### What v2.3 Adds to P-001:
* **Declarative Achievements Manifest (`achievements`)**: Versioned, localized achievement definitions in `game.yaml` compiled into `games.<id>.services.achievements`.
* **Enhanced Leaderboards Manifest (`leaderboards`)**:
  * **Categorical Grouping (`group`)**: Organizes multi-stage or multi-mode leaderboards (e.g. "World 1 Speedruns", "4x4 Classic Grid") for spatial console navigation.
  * **Score Formatting & Precision (`scoreType`, `decimalPlaces`, `unitPosition`)**: Native support for precise speedrun times (`duration_ms` with millisecond decimals), formatted currencies, and prefix/suffix units.
  * **Deterministic Tie-Breaking (`tieBreaker`)**: Explicit ordering (`first_achieved` vs `latest_achieved`) when player scores match.
  * **Structured Metadata Schemas (`metadataSchema`)**: Declaratively defines custom score attributes (e.g. `moves: integer`, `character: string`) with automatic UI badge formatting and hard 2KB payload bounding.
  * **Temporal Resets & Snapshot Archives (`resetSchedule`, `archivePolicy`)**: Precise cron-based tournament resets with historical top-100 snapshot archival.
* **Secret Trophy Masking Protocol**: Locked hidden achievements (`hidden: true`) are masked across client SDK queries until unlocked.
* **Around-Player Rank Windowing**: Standardized rank-centering queries for global leaderboards.
* **Atomic Burst Unlock Envelope (`unlockBatch`)**: Batch unlock endpoint preventing connection churn during multi-achievement frames.
* **Comprehensive Security Hardening**: Strict XSS, path traversal, prototype pollution, and worker DoS mitigations.
* **Schema Version Declaration (`specVersion: "2.3.0"`)**: Explicit SemVer manifest validation during registration (`./platform.sh game add`).

---

## 3. The `game.yaml` Contract (v2.3.0 Example)

Every hosted game declares its metadata, runtime, and game services in its root `game.yaml`:

```yaml
# Schema Version
specVersion: "2.3.0"

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
# 3. Declarative Game Services Manifest (v2.3.0)
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
    category: "Progression"
    hidden: false
    maxSteps: 1
    points: 50

  - id: "secret_easter_egg"
    name:
      en-US: "Master of Numbers"
      es-ES: "Maestro de los Números"
    description:
      en-US: "Reach the 4096 tile in endless mode."
    icon: "👑"
    category: "Secret"
    hidden: true                       # Secret achievement: masked until unlocked
    maxSteps: 1
    points: 100

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
    decimalPlaces: 0
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

## 4. Comprehensive Property Specifications for Registry v2.3

### 4.1. `game.yaml` Top-Level & Metadata Properties

| Property | Type | Required | Default / Fallback | Validation & Security Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `specVersion` | `String` | No | `"2.3.0"` | SemVer specification version (`"2.3.0"`). |
| `id` | `String` | **Yes** | — | Unique lowercase alphanumeric slug (`^[a-z0-9_-]+$`). |
| `name` | `Dict` \| `String` | **Yes** | — | Localized display name. Plain text string, HTML tags stripped. Mandatory `en-US` key. |
| `summary` | `Dict` \| `String` | No | `{"en-US": ""}` | Short one-line marketing synopsis. Plain text. |
| `description` | `Dict` \| `String` | No | `{"en-US": ""}` | Full gameplay description. Plain text. |
| `license` | `String` | No | `"Proprietary"` | Standard SPDX license identifier (e.g., `MIT`, `GPL-3.0-or-later`). |
| `upstream` | `String (URI)` | No | — | Public URL to repository (must start with `http://` or `https://`). |
| `issueTracker` | `String (URI)` | No | — | URL to issue tracker. |
| `developer` | `Dict` \| `String` | No | — | Author metadata (`name: String`, `website: String (URI)`). |
| `categories` | `Array<String>` | No | `[]` | List of platform classification genres. |
| `multiplayer` | `Boolean` | No | `false` | Indicates whether the title supports multiplayer modes. |
| `graphics.icon` | `Dict` \| `String` | No | `"🎮"` | Unicode emoji ($\le 4$ codepoints) or relative path (`^[a-zA-Z0-9_\-\/]+\.(png\|jpg\|jpeg\|svg\|webp)$`). |
| `graphics.screenshots`| `Dict` | No | `{}` | Screenshots object (`desktop: [{ name: "assets/shot1.png" }]`). Paths must be relative without `..`. |

---

### 4.2. `game.yaml` Release & Runtime Properties (`release.*`)

| Property | Type | Required | Default / Fallback | Validation & Security Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `release.version` | `String` | **Yes** | — | SemVer release version of the workload (e.g. `"1.0.0"`). |
| `release.channel` | `String` | **Yes** | `"stable"` | Target deployment channel (`"stable"`, `"beta"`, `"nightly"`). |
| `release.whatsNew` | `Dict` \| `String` | No | `{"en-US": ""}` | Localized changelog highlights. Plain text. |
| `release.runtime.type` | `String` | **Yes** | `"docker"` | Orchestration execution environment type (`"docker"`). |
| `release.runtime.service` | `String` | **Yes** | — | Exact Compose service name corresponding to the workload. |
| `release.runtime.port` | `Integer` | **Yes** | `80` | Internal container port exposing the HTTP server. |
| `release.runtime.image` | `String` | No | — | Explicit container image tag. |
| `release.hosting.hostname` | `String` | **Yes** | — | Local domain routed by Caddy (e.g. `"2048.localhost"`). Must match regex `^[a-z0-9_-]+\.localhost$`. |
| `release.hosting.capabilities`| `Array<String>` | No | Default baseline | Browser API permissions for iframe `allow` attribute. |
| `release.hosting.websockets` | `Boolean` | No | `false` | Enables WebSocket proxy forwarding support in Caddy. |

---

### 4.3. `game.yaml` Declarative Achievements Properties (`achievements[]`)

| Property | Type | Required | Default / Fallback | Validation & Security Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | **Yes** | — | Unique identifier matching regex `^[a-zA-Z0-9_-]+$`. |
| `name` | `Dict` \| `String` | **Yes** | — | Localized achievement title. Plain text string. |
| `description` | `Dict` \| `String` | **Yes** | — | Localized unlock description. Plain text string. |
| `icon` | `String` | No | `"🏆"` | Unicode emoji ($\le 4$ codepoints) or relative path (`^[a-zA-Z0-9_\-\/]+\.(png\|jpg\|jpeg\|svg\|webp)$`). |
| `category` | `String` | No | `"General"` | Organizational badge/grouping (e.g., `"Progression"`, `"Secret"`, `"Mastery"`). |
| `hidden` | `Boolean` | No | `false` | When `true`, title/description masked with spoiler placeholders until unlocked. |
| `maxSteps` | `Integer` | No | `1` | Step target. Must be integer $\ge 1$. Progressive calculations scale proportionally. |
| `points` | `Integer` | No | `10` | Platform XP value. Must be integer $\ge 0$. |

---

### 4.4. `game.yaml` Enhanced Leaderboards Properties (`leaderboards[]`)

| Property | Type | Required | Default / Fallback | Validation & Security Constraints |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | **Yes** | — | Unique leaderboard identifier matching regex `^[a-zA-Z0-9_-]+$`. |
| `name` | `Dict` \| `String` | **Yes** | — | Localized leaderboard display title. Plain text. |
| `description` | `Dict` \| `String` | No | `{"en-US": ""}` | Localized description of rules. Plain text. |
| `group` | `Dict` \| `String` | No | `{"en-US": "General"}` | Localized grouping header for categorizing leaderboards into sets. |
| `sortOrder` | `String` | No | `"desc"` | Hierarchy: `"desc"` (higher is better) or `"asc"` (lower is better). |
| `scoreType` | `String` | No | `"integer"` | Data representation: `"integer"`, `"decimal"`, `"duration_ms"`, or `"currency"`. |
| `decimalPlaces` | `Integer` | No | `0` (or `3` for `duration_ms`) | Number of decimal places rendered in portal views (0 to 3). |
| `unit` | `String` | No | `"pts"` | Formatted unit label (max 10 characters). Plain text. |
| `unitPosition` | `String` | No | `"suffix"` | Placement of unit symbol: `"suffix"` or `"prefix"`. |
| `aggregation` | `String` | No | `"max"` | Best-score aggregation rule: `"max"`, `"min"`, `"latest"`, or `"sum"`. |
| `tieBreaker` | `String` | No | `"first_achieved"` | Deterministic tie-breaker rule: `"first_achieved"` (earlier `updatedAt` wins) or `"latest_achieved"`. |
| `version` | `Integer` | No | `1` | Monotonic schema/scoring epoch integer $\ge 1$. |
| `resetPolicy` | `String` | No | `"never"` | Recurrence cadence: `"never"`, `"daily"`, `"weekly"`, or `"seasonal"`. |
| `resetSchedule` | `String (Cron)`| No | — | 5-field UTC Cron expression. Must enforce a minimum recurrence interval of $\ge 24\text{ hours}$. |
| `archivePolicy` | `String` | No | `"snapshot"` | Archival behavior upon reset: `"snapshot"` (persists top-100 snapshot) or `"purge"`. |
| `metadataSchema` | `Dict` | No | `{}` | Dict defining custom score attributes. Submissions bounded to max 2KB with prototype keys stripped. |

---

### 4.5. Compiled Central Registry Index (`games.json` v2.3 Structure)

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
          },
          {
            "id": "secret_easter_egg",
            "name": { "en-US": "Master of Numbers", "es-ES": "Maestro de los Números" },
            "description": { "en-US": "Reach the 4096 tile in endless mode." },
            "icon": "👑",
            "category": "Secret",
            "hidden": true,
            "maxSteps": 1,
            "points": 100
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

## 5. Client Submission Contracts & API Protocols

### 5.1. Achievements API & Secret Masking
```typescript
// 1. Single Unlock / Increment
await window.WGCP.achievements.unlock('tile_2048');
await window.WGCP.achievements.increment('coins_100', 5);

// 2. Atomic Multi-Unlock Batch (Burst unlocks in single frame)
await window.WGCP.achievements.unlockBatch(['boss_killed', 'speedrun_gold', 'game_clear']);
```

#### Secret Trophy Masking Protocol (`hidden: true`):
* When querying `/api/v1/games/:gameId/achievements` or `WGCP.achievements.getProgress()`:
  * If `unlocked === false` and `hidden === true`:
    ```json
    {
      "id": "secret_easter_egg",
      "title": "Hidden Trophy",
      "description": "Details will be revealed once unlocked.",
      "icon": "🔒",
      "category": "Secret",
      "unlocked": false,
      "percentComplete": 0
    }
    ```
  * Once `unlocked === true`, the API returns the unmasked localized title, description, and custom trophy icon.

#### Incremental Progress Calculation:
The backend evaluates progress using the declared `maxSteps`:
$$\text{percentComplete} = \min\left(100, \left\lfloor \frac{\text{currentSteps}}{\text{maxSteps}} \times 100 \right\rfloor\right)$$

---

### 5.2. Leaderboards Submission & Around-Player Windowing

```typescript
// 1. Leaderboards Submission
await window.WGCP.leaderboards.submit(8192);
await window.WGCP.leaderboards.submitTo('highScore', 8192, {
  moves: 420,
  highestTile: 2048
});

// 2. Around-Player Leaderboard Query
const entries = await window.WGCP.leaderboards.getScores('highScore', {
  aroundPlayer: true,
  limit: 10
});
```

#### Around-Player Rank Centering Algorithm:
When `aroundPlayer: true` is requested:
1. The backend locates the active player's score record $S_{\text{user}}$.
2. Calculates user rank $R$:
   - For `sortOrder: "desc"`: $R = 1 + \text{COUNT}(*) \text{ WHERE score} > S_{\text{user}} \text{ OR } (\text{score} = S_{\text{user}} \text{ AND } \text{updatedAt} < T_{\text{user}})$.
   - For `sortOrder: "asc"`: $R = 1 + \text{COUNT}(*) \text{ WHERE score} < S_{\text{user}} \text{ OR } (\text{score} = S_{\text{user}} \text{ AND } \text{updatedAt} < T_{\text{user}})$.
3. Computes window start: $\text{offset} = \max\left(0, R - \left\lfloor \frac{\text{limit}}{2} \right\rfloor\right)$.
4. Returns the centered slice with computed 1-based ranks.

---

### 5.3. Guest-to-User State Migration Protocol

When a player plays in guest mode and later registers or signs in:
1. The SDK preserves guest personal bests and unlocked achievements in IndexedDB (`wgcp_guest_state`).
2. Upon receiving `onPlayerChanged` (guest $\rightarrow$ authenticated user), the SDK automatically issues:
   `POST /api/v1/games/:gameId/migrate-guest`
   with the cached unlock list and score payloads.
3. The backend reconciles the payload strictly under the authenticated session (`getAuthenticatedUser(req)`), ignoring any client-declared `userId`, and executes monotonic personal best upserts.

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

1. **Formal Acceptance**: Ratify P-006 via decision record `D-009-accept-declarative-services-spec-v2-3.md`, formally marking P-001 as `superseded`.
2. **Contract Update**: Update [`/game_integration.md`](/game_integration.md) to codify the v2.3.0 schema with the comprehensive property tables and security constraints.
3. **Database Schema & Indexing**: Update `portal/backend/src/schema.ts` to add composite B-tree indexes on `(gameId, leaderboardId, score, updatedAt)`.
4. **Backend Implementation**:
   - Refactor `server.ts` to scale `increment` by manifest `maxSteps`.
   - Implement `aroundPlayer` rank windowing and batch unlock endpoints.
   - Enforce 2KB metadata limits and strip prototype pollution keys.
   - Remove hardcoded anti-cheat heuristics (`maxPossiblePointsPerSec`).
5. **Registration Compiler**: Update `platform/scripts/register-game.sh` to validate `specVersion: "2.3.0"` and compile `services` into `platform/registry/games.json` with strict icon/path sanitization.
6. **Testbed Manifest Population**: Populate `game.yaml` files across `games/2048`, `games/hextris`, `games/adarkroom`, `games/BrowserQuest`, `games/supertux`.
7. **Frontend Dynamic Ingestion**: Update portal views (`AchievementsView.tsx`, `LeaderboardsView.tsx`) to consume dynamic registry data and eliminate static mocks.

---

## 8. Implementation Tasks

- [ ] 1. Platform Backend & Schema Migration
  - [ ] 1.1 Update Drizzle database schema with composite B-tree indexes for leaderboards and BigInt millisecond timestamps (`INV-001`).
  - [ ] 1.2 Implement Fastify route for atomic batch unlocks (`/api/v1/games/:id/achievements/unlock-batch`).
  - [ ] 1.3 Implement around-player rank windowing and tie-breaker sorting (`ORDER BY score ASC/DESC, updated_at ASC`).
  - [ ] 1.4 Enforce 2KB metadata payload bounding and prototype pollution sanitization in Fastify request schemas.
- [ ] 2. Registry Compiler & CLI Tooling
  - [ ] 2.1 Update `platform/scripts/register-game.sh` to validate `specVersion: "2.3.0"` and enforce icon/path security regex.
  - [ ] 2.2 Rebuild `platform/registry/games.json` with declarative services blocks for testbed games (`2048`, `hextris`, `supertux`).
- [ ] 3. SDK & Portal Integration
  - [ ] 3.1 Update `sdk/src/achievements.ts` and `sdk/src/leaderboards.ts` with batch unlock and windowed queries.
  - [ ] 3.2 Update `portal/frontend/src/views/AchievementsView.tsx` with secret trophy masking (`hidden: true`) and dynamic trophy rendering.
  - [ ] 3.3 Update `portal/frontend/src/views/LeaderboardsView.tsx` with categorized grouping and around-player rank centering.
- [ ] 4. Automated Verification & Testing
  - [ ] 4.1 Write Vitest unit tests verifying step progress calculation, secret trophy masking, and tie-breaking sorting.
  - [ ] 4.2 Write Playwright E2E integration tests validating achievements unlock popups and leaderboard score submissions in browser.

