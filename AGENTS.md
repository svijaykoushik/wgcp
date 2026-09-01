# Agent Onboarding & Workspace Guide

Welcome, Agent! This repository implements the **Web Game Console Platform (WGCP)**—an extensible, containerized web game console and dynamic gateway for hosting, orchestrating, and launching HTML5/JavaScript games.

---

> [!IMPORTANT]
> **CRITICAL BOOTSTRAP INSTRUCTION:**
> Before proposing any code changes, creating new games, or editing platform configurations, you **must** read the project memory documents located in the `.agents/memory/` directory. These files contain the source-of-truth guidelines for the system's architecture, registration CLI, and game packaging contracts.

---

## 📂 Memory Catalog

The WGCP project memory catalog is structured as a self-contained Knowledge Bundle under the **Open Knowledge Format (OKF) v0.2** standard.

To explore the architecture, specs, and commands, please start by reading the root index:

* **[`index.md`](file://./.agents/memory/index.md)**
  * The entrypoint directory listing for the memory catalog bundle, providing progressive disclosure of all sub-documents.

---

## 🛠️ Key Agent Rules & Constraints

When modifying this repository, adhere strictly to the following guidelines:

* **State Integrity**: Do not manually modify `platform/registry/games.json`. It is a generated file. Always perform game additions or removals via the `./platform.sh` CLI or invoke the registration scripts.
* **Network Isolation**: Ensure all hosted games remain strictly isolated on their own Docker Compose networks. Do not expose game container ports directly to the host machine; all routing must go through the Caddy gateway (`games-caddy-proxy`).
* **Console-First Philosophy**: The portal is designed with a high-fidelity console-like user experience. It supports full spatial keyboard and gamepad navigation. When editing portal files, preserve the focus management engine and ensure that all animations respect user accessibility options (e.g., `prefers-reduced-motion`).
* **Backward Compatibility**: Any modifications to the `game.yaml` contract must maintain backward compatibility with existing registered games (e.g., `2048`, `adarkroom`, `BrowserQuest`, `hextris`).
* **Millisecond Epoch Schema Invariant**: All database timestamp columns storing epoch milliseconds in Drizzle/Postgres schemas (e.g., `updatedAt`, `timestamp`) must be defined as `bigint("...", { mode: "number" })` to avoid 32-bit signed integer overflow (`integer out of range`).
* **Service Rebuild Requirement**: When modifying backend routes, schema definitions, or portal RPC envelope validators, always rebuild and restart the corresponding Docker service using `docker compose -f platform/docker-compose.yml up --build -d <service>`.
* **SDK Feature Centralization**: Do not duplicate SDK features (such as Escape key forwarding or storage syncing) as inline scripts inside game HTML files. All hosted games must rely exclusively on the standalone SDK (`http://wgcp-sdk.localhost/wgcp-sdk.js`).
* **E2E Test Isolation & Clean Slate**: Integration tests interacting with user save states must ensure clean test boundaries by purging game save slots via the `DELETE` API during test setup to prevent revision conflicts (`409 Conflict`).
* **Game Workload Rebuild Invariant**: When modifying game client scripts, assets, or configurations inside `games/<game>`, always rebuild and restart the corresponding container workload using `./platform.sh game add <path>` to ensure the latest image is running.
* **Fresh-Session Cloud Hydration Invariant**: All SDK data retrieval APIs (`storage.load()`, `stats.init()`) must fall back to cloud RPC querying (`WGCP_LOAD`, `WGCP_STATS_GET`) on local cache misses to guarantee state rehydration in private windows and across new devices.
* **First-Launch Save Migration**: Game SDK integration wrappers must detect pre-existing local storage data and automatically upload it to the cloud database on initial boot.
