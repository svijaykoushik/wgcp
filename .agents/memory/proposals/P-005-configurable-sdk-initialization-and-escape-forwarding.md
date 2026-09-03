---
type: Proposal
proposal_id: P-005
title: Configurable Game SDK Initialization and Escape Key Handling
description: Proposal for extensible SDK initialization options (WGCPInitOptions) and configurable Escape key interception to prevent key collision in games with native pause menus.
status: accepted
generated: { by: antigravity/3.7, at: 2026-09-03T23:44:00+05:30 }
sources:
  - id: p002-storage-sync
    resource: /proposals/P-002-game-sdk-storage-sync.md
    title: Game SDK & Portal Synchronization Specification
  - id: p004-launch-refactor
    resource: /proposals/P-004-game-launch-refactor.md
    title: Viewport-First Game Launch Refactoring
  - id: d006-invariants
    resource: /decisions/D-006-epoch-timestamp-and-sdk-invariants.md
    title: BigInt Timestamps, SDK Feature Centralization, and Test Isolation
  - id: i010-viewport-escape
    resource: /investigations/I-010-viewport-escape-regression.md
    title: Viewport-First Launch Escape Key Regression
---

# Proposal (P-005) - Configurable Game SDK Initialization and Escape Key Handling

## 1. Context & Motivation

Under P-004[^p004-launch-refactor] and D-006,[^d006-invariants] the standalone WGCP Game SDK (`wgcp-sdk.js`) centralized capturing-phase `Escape` key interception inside `WGCP.init()` to toggle the portal system overlay menu (`WGCP_TOGGLE_MENU`) and prevent keyboard trapping inside cross-origin game iframes.[^i010-viewport-escape]

While this global behavior works seamlessly for casual web games (e.g. *2048*, *Hextris*, *A Dark Room*, *BrowserQuest*) that do not utilize the `Escape` key, it creates a fatal input collision in complex desktop and WebAssembly games (e.g. *SuperTux*, *Doom*, *Quake*, emulators):
1. **In-game Pause Menu Hijack**: In SuperTux, `Escape` is the primary controller for the in-game pause menu, sub-menu back navigation, and clean level quitting.
2. **Prevented Save Sequence**: Calling `e.preventDefault()` and `e.stopPropagation()` in the SDK's capturing-phase listener completely starved the Emscripten/SDL2 engine of `Escape` events.
3. **Abrupt Process Termination**: Players unable to reach the native in-game pause menu or "Save and Quit" dialog closed windows abruptly, missing game save triggers and causing perceived data loss.

---

## 2. Proposed Specification

### 2.1 The `WGCPInitOptions` Interface

To allow game developers to customize platform behavior while maintaining backwards compatibility with existing hosted games, `WGCP.init()` accepts an extensible options object:

```typescript
export interface WGCPInitOptions {
  /** Optional array of allowed origins for postMessage validation */
  allowedOrigins?: string[];

  /**
   * Whether the SDK should intercept and consume the raw 'Escape' keypress
   * to toggle the console platform overlay.
   * 
   * @default true
   */
  captureEscape?: boolean;

  /**
   * Optional custom shortcut descriptor for toggling the platform menu.
   * Defaults to 'Shift+Escape' when captureEscape is false.
   */
  menuShortcut?: string;
}
```

### 2.2 Dual-Tier Keyboard Handling Mechanics

The key listener attached by `WGCP.init()` operates with dual-tier evaluation:

1. **Default Mode (`captureEscape: true` or omitted)**:
   * Intercepts raw `Escape` keypresses (`e.key === 'Escape' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey`).
   * Calls `e.preventDefault()` and `e.stopPropagation()` to prevent iframe trapping.
   * Dispatches `WGCP_TOGGLE_MENU` RPC message to parent portal.
   * *Backwards compatibility*: Existing casual games require zero code changes.

2. **Passthrough Mode (`captureEscape: false`)**:
   * Skips intercepting raw `Escape` keypresses, allowing them to bubble untouched into the game engine's event loop (e.g. SDL2/Emscripten keydown handlers).
   * Automatically recognizes the **`Shift + Escape`** chord (`e.key === 'Escape' && e.shiftKey`) as a dedicated platform overlay trigger.
   * Calls `preventDefault()` / `stopPropagation()` only on `Shift + Escape` to dispatch `WGCP_TOGGLE_MENU`.

---

## 3. Working Architecture & Integration Example

```mermaid
sequenceDiagram
    autonumber
    actor Player
    participant Engine as SuperTux (Emscripten / SDL2)
    participant SDK as WGCP Standalone SDK
    participant Portal as WGCP Console Portal

    Note over Engine,SDK: Boot Sequence (captureEscape: false)
    SDK->>Portal: WGCP_INIT Handshake
    Portal-->>SDK: WGCP_INIT_ACK (Settings & Session)
    
    rect rgb(240, 248, 255)
    Note over Player,Portal: In-Game Action: Press Escape
    Player->>SDK: keydown ('Escape')
    Note over SDK: captureEscape == false<br/>Pass event through!
    SDK->>Engine: keydown ('Escape')
    Engine->>Engine: Open In-Game Pause Menu
    Player->>Engine: Select "Save & Quit"
    Engine->>SDK: FS.syncfs(false)
    SDK->>Portal: WGCP_SAVE ('gameState', payload)
    end

    rect rgb(255, 245, 238)
    Note over Player,Portal: System Overlay Action: Press Shift + Escape
    Player->>SDK: keydown ('Escape', shiftKey=true)
    Note over SDK: Matches Platform Shortcut!<br/>preventDefault & stopPropagation
    SDK->>Portal: WGCP_TOGGLE_MENU
    Portal->>Portal: Toggle Console System Menu Overlay
    end
```

### 3.1 SuperTux Integration Blueprint

In `mk/emscripten/template.html.in`:

```javascript
Module.preRun.push(function () {
  if (typeof window.WGCP !== 'undefined') {
    Module.addRunDependency('wgcp_init');

    window.WGCP.init({
      captureEscape: false // Pass raw Escape to SuperTux pause menu
    }).then(function () {
      wasmBridge = window.WGCP.wasm.install({
        mountPath: root,
        slot: 'gameState',
        fs: typeof FS !== 'undefined' ? FS : (window.FS || Module.FS),
        debounceMs: 500
      });
      return wasmBridge.restoreFromCloud();
    }).finally(function () {
      Module.removeRunDependency('wgcp_init');
    });
  }
});
```

---

## 4. Acceptance Invariants

1. **Backwards Compatibility**: Calling `WGCP.init()` without arguments defaults `captureEscape` to `true`, ensuring all previously integrated games behave identically.
2. **Deterministic In-Game Menus**: Games passing `captureEscape: false` receive 100% of raw `Escape` keystrokes without interference from SDK listeners.
3. **Guaranteed Console Escape Hatch**: Regardless of `captureEscape` configuration, `Shift + Escape` is always registered as a global console overlay toggle.

---

[^p002-storage-sync]: Game SDK & Portal Synchronization Specification (`/proposals/P-002-game-sdk-storage-sync.md`)
[^p004-launch-refactor]: Viewport-First Game Launch Refactoring (`/proposals/P-004-game-launch-refactor.md`)
[^d006-invariants]: BigInt Epoch Timestamps, SDK Feature Centralization, and Test Isolation (`/decisions/D-006-epoch-timestamp-and-sdk-invariants.md`)
[^i010-viewport-escape]: Viewport-First Launch Escape Key Regression (`/investigations/I-010-viewport-escape-regression.md`)
