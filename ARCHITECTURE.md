# Platform + Hosted Games Architecture

This document describes the extensible hosting platform architecture for containerized HTML5 games.

---

## 1. What is the platform?
The platform is a **hosting server and gateway infrastructure** that manages the lifecycle of containerized hosted games. It consists of:
* **Gateway (`caddy`)**: Reverse proxy that handles hostname routing (`<game>.localhost`), SSL termination (if enabled), and WebSocket forwarding.
* **Portal**: Dynamic web application running at `http://localhost` that renders the game catalog from the generated registry.
* **Registry (`platform/registry/games.json`)**: Generated state containing metadata and hosting endpoints for all active games.
* **CLI Tool (`platform.sh`)**: Control tool for starting/stopping the platform and registering/unregistering hosted games.

The platform is strictly decoupled from game implementation details. It operates without knowing how individual games are built or run internally.

---

## 2. What is a hosted game?
A hosted game is an independent workload repository (or directory) that includes:
1. Game static assets / server logic.
2. Container configuration (`Dockerfile`, `nginx.conf`, etc.).
3. A standalone Docker Compose file (`docker-compose.yml`) defining its services.
4. A platform descriptor (`game.yaml`) declaring metadata and hosting contracts.

---

## 3. What is `game.yaml`?
`game.yaml` is the platform-facing descriptor contract provided by each hosted game repository.

### Example Contract (`games/hextris/game.yaml`):
```yaml
id: hextris
name: Hextris

runtime:
  type: docker
  service: game-hextris
  port: 80

hosting:
  hostname: hextris.localhost

metadata:
  genre: Arcade Puzzle
  developer: "Logan Engstrom, Garrett Finucane, Noah Moroze, Michael Yang"
  license: GPL-3.0-or-later
  upstream: https://github.com/Hextris/hextris
  multiplayer: false
  icon: "⬡"
  description: Addictive hexagonal puzzle game inspired by Tetris.
```

---

## 4. How do I make an upstream OSS game hostable?
To make an arbitrary upstream HTML5 game hostable on this platform:
1. Clone or fork the upstream repository into `games/<game-name>`.
2. Add a `Dockerfile` (e.g. Nginx-based for static games, or Node.js-based for server games).
3. Add a `docker-compose.yml` declaring its service(s) and health check logic.
4. Add a `game.yaml` specifying `id`, `runtime.service`, `hosting.hostname`, and catalog `metadata`.

---

## 5. How do I register a game?
Run the platform CLI command:
```bash
./platform.sh game add ./games/hextris
```
This triggers the explicit registration pipeline:
1. Validates `game.yaml`.
2. Brings up the workload via `docker compose -p hextris up -d --build`.
3. Attaches Caddy to the game's isolated network (`hextris_default`).
4. Verifies container health.
5. Updates `platform/registry/games.json` (generated state).
6. Regenerates Caddy configuration and reloads Caddy dynamically (`caddy reload`).

---

## 6. Where does the generated registry live?
The registry lives at:
```text
platform/registry/games.json
```
This file is **generated state**. It is programmatically updated during registration and unregistration. It serves as the single source of truth for installed/active games.

---

## 7. How does the portal consume it?
The portal is a **React 18 + Vite 5 + Tailwind CSS v3** single-page application built with a console-first design system. It is served by Caddy at `http://localhost` and communicates with the backend API at `/api/v1/` for authentication and library management, and fetches the game registry from `/api/registry.json`.

The portal provides:
* **Spatial Navigation Engine**: A custom 2D nearest-neighbor focus calculator enabling gamepad D-pad and keyboard arrow navigation across the entire UI.
* **Gamepad API Integration**: W3C Standard Gamepad polling with button mapping (A/B/X/Y, D-pad, bumpers, Start) bridged to synthetic DOM keyboard events.
* **Console-Grade Motion System**: 16 custom CSS keyframe animations including staggered card entrances, directional view transitions, tactile press-spring feedback, a cinematic game launch sequence, shimmer skeleton loading, and ambient background drift.
* **Adaptive Input Prompts**: Contextual bottom-bar hints that automatically switch between keyboard glyphs and gamepad glyphs based on the active input device.
* **Full Keyboard & Touch Accessibility**: Native browser focus (`Tab`, `Shift+Tab`) coexists with spatial arrow navigation. All motion respects `prefers-reduced-motion`.

---

## 8. How does Caddy consume it?
`platform/scripts/update-caddy.sh` reads `platform/registry/games.json` and appends dynamic routing blocks to `platform/Caddyfile.base`. For example:
```caddy
http://hextris.localhost {
    reverse_proxy game-hextris:80
}
```
It outputs `platform/Caddyfile` and executes `caddy reload` inside the `games-caddy-proxy` container.

---

## 9. How are games isolated?
* **Network Isolation**: Each game runs in its own Docker Compose network (e.g., `hextris_default`, `browserquest_default`). Games cannot communicate directly with each other.
* **Ingress Only**: Caddy is attached to each game network solely as an ingress proxy.
* **No Direct Host Ports**: Game containers do not expose ports on the host. Only Caddy exposes port `80`.
* **Platform File Isolation**: Games have no access to platform code, portal files, Caddy configuration, host filesystem, or Docker socket.

---

## 10. How do I start, stop, or remove a game?

### List Registered Games:
```bash
./platform.sh game list
```

### Unregister / Stop a Game:
```bash
./platform.sh game remove hextris
```
Removing a game:
1. Removes its entry from `platform/registry/games.json`.
2. Regenerates and reloads Caddy configuration to immediately drop incoming traffic.
3. Detaches Caddy from the game's network (`hextris_default`).
4. Tears down the game's Docker Compose stack.

---

## 11. How do I add a fifth game without modifying platform code?

1. Create directory `games/pacman/`.
2. Place the game files and `Dockerfile` inside.
3. Create `games/pacman/docker-compose.yml`:
   ```yaml
   services:
     game-pacman:
       build: .
       container_name: game-pacman
       restart: unless-stopped
   ```
4. Create `games/pacman/game.yaml`:
   ```yaml
   id: pacman
   name: Pacman
   runtime:
     type: docker
     service: game-pacman
     port: 80
   hosting:
     hostname: pacman.localhost
   metadata:
     genre: Arcade
     developer: Namco
     license: Proprietary / Demo
     multiplayer: false
     icon: "🟡"
     description: Classic arcade maze game.
   ```
5. Register it:
   ```bash
   ./platform.sh game add ./games/pacman
   ```
The portal and gateway update automatically without changing any files in `platform/` or `portal/`!
