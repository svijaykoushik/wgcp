---
type: Decision
decision_id: D-008
title: Adopt Configurable SDK Initialization (WGCPInitOptions) and Shift+Escape Fallback
description: Choice to implement WGCPInitOptions in WGCP.init() with captureEscape: false support and Shift+Escape chord handling for native pause menus.
status: accepted
generated: { by: antigravity/3.7, at: 2026-09-03T23:44:00+05:30 }
sources:
  - id: p005-sdk-init-options
    resource: /proposals/P-005-configurable-sdk-initialization-and-escape-forwarding.md
    title: Configurable Game SDK Initialization and Escape Key Handling
  - id: d006-invariants
    resource: /decisions/D-006-epoch-timestamp-and-sdk-invariants.md
    title: BigInt Timestamps, SDK Feature Centralization, and Test Isolation
  - id: supertux-template
    resource: /games/supertux/mk/emscripten/template.html.in
    title: SuperTux HTML Build Template
---

# Architectural Decision Record (D-008) - Adopt Configurable SDK Initialization and Shift+Escape Fallback

## 1. Context & Problem

The platform console standard established in P-004 and D-006 requires the standalone Game SDK (`wgcp-sdk.js`) to intercept keyboard `Escape` events inside hosted game iframes to toggle the portal system overlay menu and prevent focus trapping.

During manual testing and integration of *SuperTux* (a C++/SDL2 WebAssembly game), this global interception caused a critical collision:
1. SuperTux's native in-game pause menu and level exit dialogs are bound strictly to `Escape`.
2. The SDK's capturing-phase listener consumed all `Escape` events with `e.preventDefault()` and `e.stopPropagation()`.
3. Players could not reach the in-game pause menu, prevented SuperTux from reaching save checkpoints, and triggered perceived save loss when forcibly closing the iframe.

---

## 2. Decision

We have decided to adopt **Proposal P-005: Configurable Game SDK Initialization and Escape Key Handling**.[^p005-sdk-init-options]

Specifically:
1. **Extend `WGCP.init` Signature**: Update the initialization function to accept a typed options object `WGCPInitOptions`:
   ```typescript
   export interface WGCPInitOptions {
     allowedOrigins?: string[];
     captureEscape?: boolean; // Defaults to true
     menuShortcut?: string;
   }
   ```
2. **Selective Escape Passthrough**:
   * When `captureEscape === false`: Raw `Escape` key events are **not** prevented or stopped, passing directly to the game's canvas/event listeners.
   * When `captureEscape !== false` (default): Raw `Escape` key events toggle the platform console menu.
3. **Dedicated Platform Chord (`Shift + Escape`)**:
   * Even when `captureEscape: false` is configured, pressing `Shift + Escape` is reserved globally to toggle the console platform overlay menu.
4. **SuperTux Configuration**:
   * SuperTux initializes the SDK in `Module.preRun` with `window.WGCP.init({ captureEscape: false })`.

---

## 3. Consequences & Invariants

* **Positive Consequences**:
  - Complex desktop/WASM ports (e.g. *SuperTux*) regain 100% control over their native pause and cancel flows without breaking platform overlays.
  - Casual games (*2048*, *Hextris*, *A Dark Room*, *BrowserQuest*) remain 100% backwards-compatible without code changes.
  - Players retain an explicit keyboard shortcut (`Shift + Escape`) and UI buttons to open the console menu from any game.
* **Negative Consequences**:
  - Developers of games using native `Escape` menus must be informed to set `captureEscape: false` during SDK initialization (documented in runbook `R-001`).

---

[^p005-sdk-init-options]: Configurable Game SDK Initialization and Escape Key Handling (`/proposals/P-005-configurable-sdk-initialization-and-escape-forwarding.md`)
[^d006-invariants]: BigInt Timestamps, SDK Feature Centralization, and Test Isolation (`/decisions/D-006-epoch-timestamp-and-sdk-invariants.md`)
