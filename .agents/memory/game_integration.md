---
type: Specification
title: Game Integration Memory & Packaging Contract
description: Standards and schemas for integrating HTML5 games into the WGCP console platform.
status: stable
generated: { by: antigravity/2.0, at: 2026-08-15T11:42:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-15T11:42:00Z }
sources:
  - id: base-architecture
    resource: /ARCHITECTURE.md
    title: Base ARCHITECTURE document
---

# Game Integration Memory & Packaging Contract

This document outlines the developer contract for integrating and containerizing HTML5 games to run on the Web Game Console Platform (WGCP) based on the base platform architecture.[^base-architecture]

---

## 📄 The Game Contract (`game.yaml`)

Every hosted game must place a declarative contract file named `game.yaml` in its root directory. This configuration dictates routing, lifecycle management, and portal catalog representation.

### Schema Specification

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | **Yes** | Unique alphanumeric lowercase ID (e.g. `hextris`, `adarkroom`). |
| `name` | String | **Yes** | User-friendly display name shown in the portal catalog. |
| `runtime.type` | String | **Yes** | Deployment backend. Typically `docker`. |
| `runtime.service` | String | **Yes** | Name of the primary game service as defined in `docker-compose.yml`. |
| `runtime.port` | Integer | No | Internal port of the web server (defaults to `80`). |
| `hosting.hostname`| String | **Yes** | Dynamic virtual host route registered in Caddy (e.g., `hextris.localhost`). |
| `metadata.genre` | String | No | Game genre category. |
| `metadata.developer`| String | No | Author or organization name. |
| `metadata.license` | String | No | SPDX license identifier (e.g. `GPL-3.0-or-later`, `MIT`). |
| `metadata.upstream` | String | No | Source control link. |
| `metadata.multiplayer`| Boolean| No | Set `true` if game supports online/local multiplayer. |
| `metadata.icon` | String | No | Unicode icon glyph, emoji, or icon asset name. |
| `metadata.description`| String | No | Brief marketing description for library details. |

### Example Contract (`games/2048/game.yaml`)
```yaml
id: 2048
name: "2048"

runtime:
  type: docker
  service: game-2048
  port: 80

hosting:
  hostname: 2048.localhost

metadata:
  genre: Puzzle
  developer: Gabriele Cirulli
  license: MIT
  upstream: https://github.com/gabrielecirulli/2048
  multiplayer: false
  icon: "🔢"
  description: Slide numbered tiles on a grid to combine them and create a tile with the number 2048.
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
     game-2048:
       build: .
       container_name: game-2048
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
         interval: 5s
         timeout: 3s
         retries: 3
   ```
3. **`game.yaml`**: The metadata block described above.

[^base-architecture]: Base ARCHITECTURE document
