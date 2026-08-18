---
okf_version: "0.2"
type: Specification
title: Game Integration & Packaging Contract (Registry v2)
description: Standards and schemas for integrating HTML5 games and packages into the WGCP console platform using Registry v2.
status: stable
generated: { by: antigravity/2.0, at: 2026-08-15T12:35:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-15T12:35:00Z }
sources:
  - id: base-architecture
    resource: /ARCHITECTURE.md
    title: Base ARCHITECTURE document
  - id: registry-v2-proposal
    resource: /proposals/P-001-game-registry-spec-v2.md
    title: Game Registry Specification (v2) Proposal
---

# Game Integration & Packaging Contract (Registry v2)

This document defines the developer contract for integrating and containerizing HTML5 games to run on the Web Game Console Platform (WGCP). It incorporates the Registry v2 format based on the approved proposal.[^registry-v2-proposal]

---

## 📄 The Game Contract (`game.yaml`)

Every hosted game must place a declarative contract file named `game.yaml` in its root directory. This configuration dictates routing, lifecycle management, and portal catalog representation.

### Schema Specification (V2 format)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | **Yes** | Unique alphanumeric lowercase ID (e.g. `hextris`, `adarkroom`). |
| `name` | Dictionary/String | **Yes** | Localized display name dictionary (fallback: string map to `en-US`). |
| `summary` | Dictionary/String | No | Localized short one-line marketing text. |
| `description` | Dictionary/String | No | Localized detailed game description. |
| `license` | String | No | SPDX license identifier (e.g. `GPL-3.0-or-later`, `MIT`). |
| `upstream` | String | No | Source control repository URL. |
| `issueTracker` | String | No | Issue tracking system link. |
| `developer` | Dict/String | No | Developer info. Can be a string name or a dictionary with `name` and `website`. |
| `categories` | Array of Strings | No | Replaces legacy `genre`. List of classifications (e.g. `["Arcade", "Puzzle"]`). |
| `multiplayer` | Boolean | No | Set `true` if the game supports online/local multiplayer. |
| `graphics.icon` | Dictionary/String | No | Localized icon glyph, emoji, or icon asset name. |
| `graphics.screenshots` | Dict/Array | No | Screenshots structure. E.g., `desktop: [{ name: "path" }]`. |
| `release.version` | String | **Yes** | Version of the deployable bundle (e.g. `1.2.0`). |
| `release.channel` | String | **Yes** | Release track (`stable`, `beta`, etc.). |
| `release.whatsNew` | Dictionary/String | No | Localized release changes summary. |
| `release.runtime` | Dictionary | **Yes** | Runtime orchestration details (specifies `type: docker`, `service`, `port`). |
| `release.hosting` | Dictionary | **Yes** | Reverse proxy properties (`hostname`, and optional `websockets: true`). |

---

### Example V2 Contract (`games/hextris/game.yaml`)

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

## 🗄️ Registry File Format (`games.json`)

The platform aggregates all games into a single central index `/platform/registry/games.json`.

### Structure

1. **`repo`**: Repository information, Mirrored nodes, genres, and release channels configuration.
2. **`games`**: A key-value dictionary of games keyed by their `id`. Each entry divides concerns between static metadata (`metadata`) and versioned execution blocks (`releases`).

### Registry V2 JSON Example

```json
{
  "repo": {
    "name": {
      "en-US": "Local Games Platform"
    },
    "description": {
      "en-US": "Decentralized collection of hosted HTML5 games."
    },
    "address": "http://localhost",
    "timestamp": 1786851200,
    "releaseChannels": {
      "stable": {
        "name": { "en-US": "Stable" },
        "description": { "en-US": "Production-ready game versions." }
      }
    },
    "genres": [
      "MMORPG",
      "Puzzle",
      "Text Adventure",
      "Arcade",
      "2D Platformer"
    ]
  },
  "games": {
    "hextris": {
      "metadata": {
        "added": 1786800000,
        "lastUpdated": 1786850000,
        "license": "GPL-3.0-or-later",
        "upstream": "https://github.com/Hextris/hextris",
        "issueTracker": "https://github.com/Hextris/hextris/issues",
        "developer": {
          "name": "Logan Engstrom, Garrett Finucane, Noah Moroze, Michael Yang"
        },
        "name": {
          "en-US": "Hextris"
        },
        "summary": {
          "en-US": "Addictive hexagonal puzzle game."
        },
        "description": {
          "en-US": "Rotate the hexagon to match 3+ blocks of the same color."
        },
        "categories": ["Arcade", "Puzzle"],
        "multiplayer": false,
        "graphics": {
          "icon": {
            "en-US": "⬡"
          },
          "screenshots": {
            "desktop": [
              { "name": "assets/screenshot1.png" }
            ]
          }
        }
      },
      "releases": {
        "stable-v1.2.0": {
          "added": 1786850000,
          "version": "1.2.0",
          "releaseChannels": ["stable"],
          "whatsNew": {
            "en-US": "Fixed canvas scaling on mobile browsers and updated colors."
          },
          "runtime": {
            "type": "docker",
            "service": "game-hextris",
            "port": 80
          },
          "hosting": {
            "hostname": "hextris.localhost"
          }
        }
      }
    }
  }
}
```

---

## 🏗️ Packaging Requirements

To integrate an HTML5 game successfully, the game folder must contain:

1. **`Dockerfile`**: Compiles static assets or runs a Node.js server. If the game is purely client-side static assets, a simple Nginx or Caddy-based server configuration is recommended:
   ```dockerfile
   FROM nginx:alpine
   COPY . /usr/share/nginx/html
   EXPOSE 80
   ```
2. **`docker-compose.yml`**: Defines the local stack.
   * **Do NOT publish ports to host** (avoid `ports: - "80:80"`). Caddy communicates over the network bridge, so publishing ports wastes host resources and compromises network isolation.
   * Define `container_name` to match `runtime.service` declared in `game.yaml`.
   * Configure a health check to verify that the server is active. The registration script relies on Docker Inspect health checks.
   ```yaml
   services:
     game-hextris:
       build: .
       container_name: game-hextris
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
         interval: 5s
         timeout: 3s
         retries: 3
   ```
3. **`game.yaml`**: The metadata and release contract described above.

[^base-architecture]: Base ARCHITECTURE document ([/ARCHITECTURE.md](/ARCHITECTURE.md))
[^registry-v2-proposal]: Game Registry Specification (v2) Proposal ([P-001](/proposals/P-001-game-registry-spec-v2.md))
