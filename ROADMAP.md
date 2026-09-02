# Web Game Console Platform (WGCP) Roadmap

This document outlines the phased development roadmap, current focus, and future horizons for the Web Game Console Platform.

> [!NOTE]
> The single source of truth for the platform roadmap is maintained under the Open Knowledge Format (OKF v0.2) in the project memory bundle:
> 👉 **[`.agents/memory/roadmap.md`](.agents/memory/roadmap.md)**

---

## 🧭 High-Level Phase Overview

| Phase | Milestone Name | Status | Summary |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Ingress Gateway & Registration Pipeline | `COMPLETED` | Caddy reverse-proxy gateway, `./platform.sh` CLI, and F-Droid v2-style declarative registry. |
| **Phase 2** | Console Portal & Launchpad Experience | `COMPLETED` | React 18 / Vite portal, 2D spatial navigation, gamepad polling, and viewport-first windowing. |
| **Phase 3** | Standalone Game SDK & Backend Services | `COMPLETED` | Decoupled Game SDK (`http://wgcp-sdk.localhost/wgcp-sdk.js`), PostgreSQL/Drizzle backend, and hardened RPC bridge. |
| **Phase 4** | Game Integrations & Hydration Hardening | `COMPLETED` | Cloud save rehydration fallback, legacy local storage auto-migration, and Playwright E2E integration test suite. |
| **Phase 5** | WASM & Emscripten Storage Bridge | `ACTIVE` | IDBFS persistent storage shim and SDK bridging for native WASM games (SuperTux). |
| **Phase 6** | Portal Services UI & Dashboards | `PLANNED` | Visual portal interfaces for achievements, global leaderboards, personal bests, and XP progression. |
| **Phase 7** | Multiplayer Lobbies & Social Systems | `DEFERRED` | Matchmaking queues, room allocation, and player social systems (presence, messaging). |

---

## 🎯 Current Focus: Phase 5 (WASM & Emscripten Storage Bridge)

We are currently resolving storage delegation and persistence for compiled C/C++ and WebAssembly games packaged via Emscripten:
1. **Emscripten IDBFS Sync**: Bridge Emscripten's virtual filesystem (`IDBFS.syncfs`) directly into the WGCP standalone SDK cloud persistence layer.
2. **SuperTux Integration**: Complete packaging and registration of `games/supertux` without storage permission prompts blocking boot.
3. **E2E Validation**: Add automated test coverage verifying persistent save state rehydration for WASM titles.

---

## 🛠️ For AI Agents & Developers

For comprehensive architecture details, decision rationale, deliverable checklists, and verification invariants, inspect the detailed specification:
* **[Platform Architecture Roadmap (`.agents/memory/roadmap.md`)](.agents/memory/roadmap.md)**
* **[Memory Catalog Index (`.agents/memory/index.md`)](.agents/memory/index.md)**
