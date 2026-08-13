# Web Game Console Platform (WGCP)

[![Platform](https://img.shields.io/badge/Platform-Docker%20%7C%20Caddy-blue.svg)](#)
[![Games](https://img.shields.io/badge/Games-HTML5%20%2F%20JavaScript-orange.svg)](#)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](LICENSE)

An extensible, containerized web game console platform and dynamic reverse-proxy gateway for hosting, orchestrating, and launching HTML5/JavaScript games.

---

## 🎮 Overview

**WGCP (Web Game Console Platform)** provides a lightweight, modular infrastructure to host and play independent web games within isolated containerized environments. It decouples the hosting platform completely from game implementation details.

### Key Features

* **Dynamic Ingress & Gateway**: Powered by Caddy to provide automatic virtual-host routing (`http://<game>.localhost`), WebSocket forwarding, and instant zero-downtime reloads.
* **Unified Console Portal**: A console-first web portal hosted at `http://localhost` featuring spatial gamepad/keyboard navigation, cinematic motion transitions, and adaptive input prompts — dynamically discovers and showcases registered games with interactive launch modes.
* **Declarative Game Contract (`game.yaml`)**: Adding a new game requires no changes to platform or portal code—simply declare runtime specifications and metadata.
* **Strict Network Isolation**: Each game runs in its own isolated Docker Compose network, communicating with the outside world strictly through the gateway.
* **Developer CLI (`platform.sh`)**: Simple single-command control for platform lifecycle and game registration.

---

## 🏗️ Architecture

```
                       ┌─────────────────────────┐
                       │      Browser / User     │
                       └────────────┬────────────┘
                                    │
                         port 80    ▼
                    ┌───────────────────────────────┐
                    │      Caddy Gateway Proxy      │
                    │      (games-caddy-proxy)      │
                    └───────┬───────────────┬───────┘
                            │               │
       http://localhost     │               │  http://<game>.localhost
                            ▼               ▼
               ┌─────────────────┐    ┌─────────────────────────────────┐
               │  Console Portal │    │     Isolated Game Workloads     │
               │  (React/Vite)   │    │  ┌────────────┐ ┌────────────┐  │
               └────────┬────────┘    │  │ games/2048 │ │ games/...  │  │
                        │             │  └────────────┘ └────────────┘  │
                        ▼             └─────────────────────────────────┘
               ┌─────────────────┐
               │ games.json      │
               │ (Registry API)  │
               └─────────────────┘
```

For in-depth architectural details, see [ARCHITECTURE.md](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/ARCHITECTURE.md).

---

## 🚀 Quick Start

### Prerequisites

* [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
* [Git](https://git-scm.com/)
* `bash` and `python3` (standard on macOS/Linux)

### 1. Clone the Repository (with Submodules)

```bash
git clone --recurse-submodules https://github.com/svijaykoushik/wgcp.git
cd wgcp
```

*(If cloned without `--recurse-submodules`, initialize them with `git submodule update --init --recursive`)*

### 2. Start the Platform Gateway

```bash
./platform.sh start
```

### 3. Register & Launch Bundled Games

Register any of the included submodules:

```bash
# Register individual games
./platform.sh game add ./games/2048
./platform.sh game add ./games/adarkroom
./platform.sh game add ./games/BrowserQuest
./platform.sh game add ./games/hextris
```

### 4. Open the Web Console

Navigate to **[http://localhost](http://localhost)** in your browser to browse the game catalog and launch games. Individual games are also accessible directly via their virtual hostnames (e.g. `http://2048.localhost`).

---

## 🕹️ Bundled Games

The platform includes submodules for popular open-source HTML5 games:

| Game | Description | Genre | Upstream |
| :--- | :--- | :--- | :--- |
| **2048** | Join the numbers to get to the 2048 tile | Puzzle | [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048) |
| **A Dark Room** | Text-based minimalist adventure game | RPG / Adventure | [doublespeakgames/adarkroom](https://github.com/doublespeakgames/adarkroom) |
| **BrowserQuest** | Multiplayer HTML5/WebSocket action RPG | Multiplayer RPG | [mozilla/BrowserQuest](https://github.com/mozilla/BrowserQuest) |
| **Hextris** | Fast-paced hexagonal puzzle game | Arcade | [Hextris/hextris](https://github.com/Hextris/hextris) |

---

## ➕ Adding a New Game

To make any HTML5 game hostable on the platform:

1. **Add game files** into a subdirectory under `games/<game-name>/` (as a git submodule or directory).
2. **Add a `Dockerfile`** to package static assets (e.g., with Nginx) or server runtime (Node.js/Go/Python).
3. **Add `docker-compose.yml`**:
   ```yaml
   services:
     game-<name>:
       build: .
       container_name: game-<name>
       restart: unless-stopped
   ```
4. **Add `game.yaml` descriptor**:
   ```yaml
   id: mygame
   name: "My Awesome Game"
   runtime:
     type: docker
     service: game-mygame
     port: 80
   hosting:
     hostname: mygame.localhost
   metadata:
     genre: Arcade
     developer: "Developer Name"
     license: MIT
     multiplayer: false
     icon: "🎮"
     description: "A fun HTML5 web game."
   ```
5. **Register the game**:
   ```bash
   ./platform.sh game add ./games/mygame
   ```

---

## 🛠️ CLI Reference

The `./platform.sh` utility manages the platform and game workloads:

```bash
# Platform Management
./platform.sh start                   # Start the Caddy proxy and load current game routes
./platform.sh stop                    # Stop the platform proxy

# Game Lifecycle
./platform.sh game add <path>         # Register, build, start, and wire a new game
./platform.sh game remove <game-id>   # Unregister, stop, and clean up a game
./platform.sh game list               # View all registered games in the registry
```

---

## 📁 Repository Structure

```text
.
├── ARCHITECTURE.md          # Detailed technical architecture specification
├── platform.sh              # CLI platform control tool
├── platform/
│   ├── Caddyfile            # Active dynamically generated Caddy configuration
│   ├── Caddyfile.base       # Base Caddy configuration template
│   ├── docker-compose.yml   # Platform gateway service definition
│   ├── registry/
│   │   └── games.json       # Generated active game registry (Single Source of Truth)
│   └── scripts/
│       ├── register-game.sh # Registration workflow automation
│       ├── remove-game.sh   # Unregistration workflow automation
│       └── update-caddy.sh  # Dynamic Caddyfile route generator
├── portal/
│   ├── frontend/                # Console Portal React/Vite application
│   │   ├── src/
│   │   │   ├── App.tsx          # Application shell with routing & providers
│   │   │   ├── engine/          # Spatial navigation & gamepad polling engines
│   │   │   ├── hooks/           # Custom React hooks (spatial nav, input, transitions)
│   │   │   ├── contexts/        # Input device context provider
│   │   │   ├── components/      # Reusable UI components (GameCard, NavBar, etc.)
│   │   │   └── views/           # Page views (Login, Library, Catalogue, Launcher)
│   │   ├── tailwind.config.js   # Console design tokens & animation keyframes
│   │   └── package.json
│   └── backend/                 # Portal API server (auth, library management)
└── games/                   # Hosted game submodules
    ├── 2048/
    ├── adarkroom/
    ├── BrowserQuest/
    └── hextris/
```

---

## 📄 License

This platform infrastructure, scripts, and portal are licensed under the **[Mozilla Public License 2.0 (MPL-2.0)](LICENSE)**.

> [!NOTE]
> **Third-Party Games Licensing**: The hosted games located in [`games/`](games/) are independent third-party open-source projects included as Git submodules. They are **not** covered by this platform's MPL-2.0 license; each game retains and is governed by its own independent license and copyright (e.g., GPL-3.0, MPL-2.0, MIT, etc.). Please refer to each individual game repository in [`games/`](games/) for its respective licensing terms.

