---
type: Investigation
investigation_id: I-002
title: Web Game SDK Service Analysis
description: Technical analysis of CrazyGames and Poki SDKs, focusing on gameplay lifecycle events, data storage integration, advertisement triggers, and user authentication patterns.
start_date: "2026-08-18"
status: completed
result: substantiated
generated: { by: antigravity/2.0, at: 2026-08-18T22:54:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-18T22:54:00Z }
sources:
  - id: crazygames-dev-docs
    resource: https://developer.crazygames.com
    title: CrazyGames Developer Portal Documentation
  - id: poki-dev-docs
    resource: https://developers.poki.com
    title: Poki for Developers Portal Documentation
---

# Investigation Report (I-002) - Web Game SDK Service Analysis

This investigation analyzes the technical implementations and architectural approaches of leading web game portals (CrazyGames and Poki) to determine best practices for integrating hosted games into the Web Game Console Platform (WGCP). These findings directly inform the service proposals in [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md).

---

## 1. CrazyGames SDK Analysis

CrazyGames relies on a modular, event-driven JavaScript SDK wrapper loaded within the game’s iframe boundary.

### 1.1. Data Persistence (Cloud Saves)
* **API Pattern**: Implements a Key-Value storage abstraction replicating the standard browser `localStorage` interface:
  * `getItem(key)`, `setItem(key, value)`, `removeItem(key)`, `clear()`.
* **State Behavior**:
  * For logged-in users, the SDK automatically forwards saves to the CrazyGames cloud servers, ensuring cross-device synchronization.
  * For anonymous/guest users, the SDK gracefully falls back to writing directly to the browser's local sandbox `localStorage`.

### 1.2. Leaderboards & Scoring
* **API Pattern**: Exposes endpoints to submit scores and fetch ranking listings.
* **Security & Verification**:
  * Uses developer-assigned API credentials generated via the Developer Portal.
  * The SDK allows batch score submissions (up to 100 entries at once).
  * Highly competitive leaderboards enforce server-side validation rules to restrict direct client overrides.

### 1.3. User Accounts & Session Identity
* **API Pattern**:
  * Accesses basic profile payloads: `username`, `avatarUrl`, and a platform user identifier.
  * Emits events to handle authentication state transitions (e.g. prompt-to-login overlay).

### 1.4. Telemetry and Gameplay Events
* Mandates specific game state signals:
  * `gameplayStart()`: Signals active play loops (used to pause portal backgrounds and track duration metrics).
  * `gameplayStop()`: Signals menu, paused, or dead state.

---

## 2. Poki SDK Analysis

Poki utilizes an asynchronous, event-driven, utility-focused SDK tailored to performance tracking, lifecycle management, and lightweight platform integration.

### 2.1. Gameplay Lifecycle
Poki enforces a strict initialization lifecycle:
* `gameLoadingFinished()`: Triggered when loading finishes.
* `gameplayStart()`: Signals when player begins active gameplay.
* `gameplayStop()`: Signals pause, main menu, or shop interfaces.

### 2.2. Platform UI Elements (Poki Pill)
* **Overlay Positioning**: Since the game renders full-viewport inside an iframe, Poki injects a dynamic floating UI element (the "Poki Pill" logo/profile) overlay. The SDK provides helper coordinates to shift the pill dynamically, preventing it from overlapping game UI controls.

### 2.3. Scoreboards & Verification
* Similar to CrazyGames, Poki aggregates high scores and manages leaderboard visual displays.
* Supports fetching secure user session tokens to verify claims on third-party developer servers.

### 2.4. Custom Telemetry & Quality Auditing (Poki Inspector)
* Includes custom event instrumentation via a generic `measure()` endpoint.
* Includes a testing dashboard ("Poki Inspector") allowing developers to mock platform events (ad breaks, login, saves) to debug event behaviors locally.

---

## Conclusion & Architectural Insights for WGCP
1. **Key-Value Persistence Dominance**: In the web platform space, developers favor simple Key-Value storage models over complex relational database tables.
2. **Mandatory Lifecycle Events**: Tracking the transitions between loading, gameplay start, and gameplay stop is critical for platform-level analytics and UI overlay coordination.
3. **Identity Decoupling**: Allowing the SDK to read identity properties safely without exposing session tokens or credentials prevents client-side vulnerabilities.
