---
type: Reference
title: CLI Operations & Command Reference Memory
description: Command-line lifecycle management and maintenance workflows for the WGCP platform.
status: stable
generated: { by: antigravity/2.0, at: 2026-08-15T11:42:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-15T11:42:00Z }
sources:
  - id: platform-sh
    resource: /platform.sh
    title: Platform CLI script
  - id: register-game-sh
    resource: /platform/scripts/register-game.sh
    title: Game registration script
  - id: remove-game-sh
    resource: /platform/scripts/remove-game.sh
    title: Game removal script
  - id: update-caddy-sh
    resource: /platform/scripts/update-caddy.sh
    title: Caddy update script
---

# CLI Operations & Command Reference Memory

This document outlines the usage, command signatures, and internal mechanics of the developer CLI wrapper[^platform-sh] and its associated maintenance scripts: registration,[^register-game-sh] removal,[^remove-game-sh] and routing.[^update-caddy-sh]

---

## 🚀 CLI Commands (`platform.sh`)

The entrypoint wrapper script is `platform.sh` located in the repository root.

### `platform.sh start`
Starts the console infrastructure and reconnects active games:
1. Copies `platform/Caddyfile.base` to `platform/Caddyfile`.
2. Appends current routes for all registered games in `platform/registry/games.json`.
3. Runs `docker compose -f platform/docker-compose.yml up -d` to start Caddy, Postgres, and the Portal frontend/backend.
4. Dynamically attaches the Caddy container (`games-caddy-proxy`) to each registered game's isolated network (`<game-id>_default`).

### `platform.sh stop`
Stops the core console portal gateway:
* Runs `docker compose -f platform/docker-compose.yml down`.
* *(Note: This does not automatically stop individual game workloads unless they are explicitly stopped or removed).*

### `platform.sh game list`
Outputs the current registry database (`platform/registry/games.json`) in pretty-printed JSON format:
```bash
./platform.sh game list
```

### `platform.sh game add <path-to-game>`
Registers and runs a new game workload:
```bash
./platform.sh game add ./games/2048
```
**Under the Hood (Execution Flow):**
1. **Validation**: Parses `game.yaml` from the target path, extracting `id`, `runtime.service`, `runtime.port`, and `hosting.hostname`.
2. **Launch**: Spins up the game's compose stack via `docker compose -p <id> -f <game-path>/docker-compose.yml up -d --build`.
3. **Bridge Network**: Connects Caddy to the game's network (`docker network connect <id>_default games-caddy-proxy`).
4. **Health Check**: Polls the container status and inspects health status (via `docker inspect`) up to 40 seconds until it is marked running and healthy.
5. **Registry Update**: Appends or replaces the game definition object in `platform/registry/games.json`.
6. **Route Ingress**: Rebuilds Caddy configurations and reloads the server by running `platform/scripts/update-caddy.sh`.

### `platform.sh game remove <game-id>`
Unregisters and cleans up a game workload:
```bash
./platform.sh game remove 2048
```
**Under the Hood (Execution Flow):**
1. **Registry Clean**: Removes the matching `id` entry from `platform/registry/games.json`.
2. **Route Drop**: Updates Caddy configs and executes a reload (`caddy reload`) so incoming web requests are dropped immediately.
3. **Disconnect Network**: Detaches Caddy from the game's default network.
4. **Workload Drop**: Stops and deletes the game containers by executing `docker compose down` in the game's source directory.

---

## 🛠️ Internal Maintenance Scripts

If manual troubleshooting or execution is required, helper scripts reside in `platform/scripts/`:

* **`register-game.sh <path>`**: Backend logic to spin up, register, and reload routes for a game.
* **`remove-game.sh <id>`**: Backend logic to tear down, unregister, and clean routing table for a game.
* **`update-caddy.sh`**: Copies `Caddyfile.base`, appends active reverse-proxy routing directives for all registered games, and executes a hot reload inside the running `games-caddy-proxy` container:
  ```bash
  docker exec games-caddy-proxy caddy reload --config /etc/caddy/Caddyfile
  ```

[^platform-sh]: Platform CLI script
[^register-game-sh]: Game registration script
[^remove-game-sh]: Game removal script
[^update-caddy-sh]: Caddy update script
