---
type: Proposal
title: Game Registry Specification (v2)
description: Approved proposal for the WGCP game registry structure inspired by F-Droid v2.
status: accepted
proposal_id: P-001
generated: { by: antigravity/2.0, at: 2026-08-15T12:00:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-15T12:00:00Z }
sources:
  - id: legacy-registry
    resource: /platform/registry/games.json
    title: Current games registry file
  - id: acceptance-decision
    resource: /decisions/D-003-accept-registry-spec-v2.md
    title: Decision to adopt Game Registry Specification (v2)
---

# Game Registry Specification (v2) - APPROVED

This document defines the approved specification for the platform's game registry, drawing inspiration from **F-Droid's Index v1 and v2 specifications** tailored to containerized HTML5 games.

### Finalized Design Decisions:
* **Adoption Decision:** Ratified and accepted under decision record [D-003](/decisions/D-003-accept-registry-spec-v2.md).[^acceptance-decision]
* **Fallback Locale:** `en-US` is the mandatory baseline fallback locale.
* **Releases Keys:** Uses descriptive release identifiers (e.g., `stable-v1`, `beta-v2.1`) to represent deployable workloads.

---

## 1. Overview & Goals

The current registry[^legacy-registry] is a flat array of game objects containing static configuration, basic metadata, and runtime settings. As the platform grows, we need:
* **Internationalization (i18n):** Native support for localized names, descriptions, and media assets.
* **Release Tracking & Channels:** Support for multiple versions (e.g., Stable, Beta, Nightly) rather than just single-version runtimes.
* **Repository Syndication:** A metadata structure that allows multiple platform instances to syndicate, mirror, or federate game catalogs.
* **Strict Decoupling:** Complete separation of runtime/infrastructure configuration from user-facing descriptive metadata.

---

## 2. Ingested F-Droid Concepts

Based on F-Droid's spec evolution from **v1 (XML/JSON)** to **v2 (JSON)**, we have adopted several core design patterns:

1. **Inline Localization (F-Droid v2):** Localized strings are placed directly inside their respective metadata fields (e.g., `name: { "en-US": "A Dark Room", "fr-FR": "Une Chambre Noire" }`) rather than being separated into a detached `localized` tree (like in v1).
2. **Repo/Catalog Boundaries:** Separation of the registry index into two distinct roots:
   * `repo`: Contextual registry settings (mirrors, global release channels, categories/genres).
   * `games` (matching F-Droid's `packages`): Detailed app metadata and version history.
3. **Decoupled Releases:** Standardized separation between the game's marketing metadata (genre, screenshots, license) and actual deployable packages (runtimes, container images, hostname routing, and release channels).

---

## 3. Proposed Schema Structure

The proposed structure for `games.json` is organized into `repo` and `games` sections.

### 3.1. The `repo` Block
Declares repository properties, available mirrors, defined genres, and support channels.

```json
{
  "repo": {
    "name": {
      "en-US": "Local Games Platform",
      "es-ES": "Plataforma de Juegos Locales"
    },
    "description": {
      "en-US": "Decentralized collection of hosted HTML5 games.",
      "es-ES": "Colección descentralizada de juegos HTML5 hospedados."
    },
    "icon": "platform-icon.png",
    "address": "http://localhost",
    "timestamp": 1786851200,
    "releaseChannels": {
      "stable": {
        "name": { "en-US": "Stable" },
        "description": { "en-US": "Production-ready game versions." }
      },
      "beta": {
        "name": { "en-US": "Beta" },
        "description": { "en-US": "Pre-release builds for early testing." }
      }
    },
    "genres": [
      "MMORPG",
      "Puzzle",
      "Text Adventure",
      "Arcade",
      "2D Platformer"
    ],
    "mirrors": [
      {
        "url": "http://mirror.localhost",
        "isPrimary": false
      }
    ]
  }
}
```

### 3.2. The `games` Block (Keyed by Game ID)
The `games` object is keyed by a unique identifier (e.g. `browserquest`). Each game has two sections: `metadata` (marketing/information) and `releases` (deployable workloads).

```json
{
  "games": {
    "browserquest": {
      "metadata": {
        "added": 1786800000,
        "lastUpdated": 1786850000,
        "license": "MPL-2.0",
        "upstream": "https://github.com/mozilla/BrowserQuest",
        "issueTracker": "https://github.com/mozilla/BrowserQuest/issues",
        "developer": {
          "name": "Little Workshop / Mozilla",
          "website": "https://www.littleworkshop.fr"
        },
        "name": {
          "en-US": "BrowserQuest",
          "fr-FR": "BrowserQuest"
        },
        "summary": {
          "en-US": "HTML5 multiplayer adventure game.",
          "fr-FR": "Jeu d'aventure multijoueur en HTML5."
        },
        "description": {
          "en-US": "A multiplayer adventure RPG experiment by Mozilla powered by HTML5 Canvas and WebSockets.",
          "fr-FR": "Une expérience de jeu de rôle d'aventure multijoueur par Mozilla, propulsée par HTML5 Canvas et WebSockets."
        },
        "categories": ["MMORPG"],
        "multiplayer": true,
        "graphics": {
          "icon": {
            "en-US": "⚔️"
          },
          "screenshots": {
            "desktop": [
              { "name": "screenshot1.png", "sha256": "abcdef...", "size": 104857 }
            ]
          }
        }
      },
      "releases": {
        "stable-v1": {
          "added": 1786800000,
          "version": "1.0.0",
          "releaseChannels": ["stable"],
          "whatsNew": {
            "en-US": "Initial stable container release with full reverse proxy support."
          },
          "runtime": {
            "type": "docker",
            "service": "browserquest-client",
            "port": 80,
            "image": "browserquest-client:latest"
          },
          "hosting": {
            "hostname": "browserquest.localhost",
            "websockets": true
          }
        }
      }
    }
  }
}
```

---

## 4. Game Configuration Contract (`game.yaml`)

Games declare their properties in `game.yaml` inside their own repositories. The platform updates the central registry from these files.

### Proposed `game.yaml` format (e.g., `games/hextris/game.yaml`):

```yaml
id: hextris
license: GPL-3.0-or-later
upstream: https://github.com/Hextris/hextris
issueTracker: https://github.com/Hextris/hextris/issues
developer:
  name: "Logan Engstrom, Garrett Finucane, Noah Moroze, Michael Yang"

# Localized app listings (F-Droid v2 style inline dictionary)
name:
  en-US: Hextris
  es-ES: Hextris
summary:
  en-US: Addictive hexagonal puzzle game.
  es-ES: Adictivo juego de rompecabezas hexagonal.
description:
  en-US: Rotate the hexagon to match 3+ blocks of the same color.
  es-ES: Gira el hexágono para combinar 3 o más bloques del mismo color.

categories:
  - Arcade
  - Puzzle

multiplayer: false

graphics:
  icon: "⬡"
  screenshots:
    desktop:
      - name: assets/screenshot1.png

# Details of the current active release build
release:
  version: 1.2.0
  channel: stable
  whatsNew:
    en-US: Fixed canvas scaling on mobile browsers and updated colors.
    es-ES: Se corrigió el escalado de canvas en móviles y se actualizaron colores.
  runtime:
    type: docker
    service: game-hextris
    port: 80
  hosting:
    hostname: hextris.localhost
```

---

## 5. Mapping and Legacy Compatibility

To bridge the current registry structure (`games.json` v1) with the proposed model (`games.json` v2), we can establish a direct mapping:

| Legacy Field | New Schema Target Path | Rationale |
|---|---|---|
| `id` | Root key of game object (`games.<id>`) | Normalizes lookup complexity from $O(N)$ arrays to $O(1)$ maps. |
| `name` | `metadata.name.en-US` | Automatically maps to default `en-US` locale. |
| `runtime.*` | `releases.<active-release>.runtime.*` | Prepares for version control and multi-release hosting. |
| `hosting.*` | `releases.<active-release>.hosting.*` | Routes traffic according to version specification. |
| `metadata.genre` | `metadata.categories` | Array format replaces comma-separated strings. |
| `metadata.developer` | `metadata.developer.name` | Creates structured developer profiles. |
| `metadata.license` | `metadata.license` | Uses SPDX license strings. |
| `metadata.upstream` | `metadata.upstream` | Remains upstream repository link. |
| `metadata.icon` | `metadata.graphics.icon.en-US` | Preserves emoji/graphics and supports localization. |
| `metadata.description` | `metadata.description.en-US` | Maps description to the default language entry. |

---

## 6. Migration and Scripting Updates

### Step 1: Upgrading Parser Logic (`platform/scripts/register-game.sh`)
The Python step in the registration script must be refactored to parse the new structure.
* Legacy YAML input should be accepted and auto-upgraded to the new layout (e.g. mapping flat `name` to `metadata.name.en-US`).
* When writing to `games.json`, instead of appending to an array, the script will write/merge into the `games` dictionary object.

### Step 2: Caddy Generation (`platform/scripts/update-caddy.sh`)
* Instead of iterating over `games` array elements, it will traverse keys in `games.*.releases.*.hosting` to extract routes.

### Step 3: Portal Catalog API (`portal/src/`)
* The UI portal will fetch `/api/registry.json`.
* It will parse the localized keys dynamically according to the user's browser language, defaulting back to `en-US`.

---

## 7. Addendum: Browser API Capabilities & Iframe Permissions

To allow games to request necessary Browser APIs and features, games may declare their capability dependencies in their `game.yaml` configuration. The platform uses this data to dynamically compile and assign the appropriate `allow` attributes on the loading iframe.

### 7.1. Spec Schema Changes
* **`game.yaml`**: Adds an optional array `hosting.capabilities` containing the specific browser features required.
* **`games.json`**: Compiles this array into `games.<id>.releases.<release_key>.hosting.capabilities`.

### 7.2. Allowed Capabilities / Browser APIs
Standard supported values include (but are not limited to):
* `autoplay`
* `fullscreen`
* `gamepad`
* `camera`
* `microphone`
* `geolocation`
* `accelerometer`
* `gyroscope`
* `clipboard-read`
* `clipboard-write`

### 7.3. Dynamic Iframe Security & Sandbox Defaults
When the platform launcher renders the game in an `iframe`:
1. If the game declares a non-empty `hosting.capabilities` list, the iframe `allow` attribute will be configured with exactly those capabilities (joined by `;`).
2. If `hosting.capabilities` is omitted or empty, the iframe falls back to the backward-compatible default baseline:
   `autoplay; fullscreen; gamepad; focus-without-user-activation; accelerometer; gyroscope; clipboard-read; clipboard-write`

[^legacy-registry]: Current games registry file (`platform/registry/games.json`)
[^acceptance-decision]: Decision to adopt Game Registry Specification (v2) ([D-003](/decisions/D-003-accept-registry-spec-v2.md))

