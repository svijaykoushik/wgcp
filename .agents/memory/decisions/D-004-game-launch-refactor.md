---
type: Decision
title: Implement Viewport-First Game Launching and Menu Fullscreen Toggle
description: Decision to launch games in full viewport by default rather than browser-level fullscreen, delegating fullscreen triggers to the platform overlay menu.
status: accepted
decision_id: D-004
generated: { by: antigravity/3.5, at: 2026-08-28T00:37:00+05:30 }
verified: { by: human:vijaykoushik, at: 2026-08-28T00:37:00+05:30 }
sources:
  - id: launch-proposal
    resource: /proposals/P-004-game-launch-refactor.md
    title: Viewport-First Game Launch Refactoring Proposal
---

# Decision: Implement Viewport-First Game Launching and Menu Fullscreen Toggle

## Context
As proposed in the Viewport-First Game Launch Refactoring Proposal,[^launch-proposal] the WGCP arcade portal previously forced browser-level fullscreen using the Fullscreen API immediately upon launching a game or resuming it. This approach caused multiple UX and compatibility issues:
1. Modern browsers block fullscreen requests unless triggered directly inside ephemeral user actions, resulting in runtime exceptions or ignored requests during transition phases.
2. It removed standard browser navigation controls intrusively.
3. Placing fullscreen controls inside the pausible Platform / System Menu provides a clean, console-like setting structure.

## Decision
We will adopt the **Viewport-First Game Launch** architecture:
1. **Windowed Full Viewport Default**: Remove automatic fullscreen requests from `handleLaunchComplete` and `resumeGame` inside `LauncherView`.
2. **Explicit User Toggle**: Add a dedicated button within the pauses-triggered `<SystemMenuOverlay />` that enables manual entry/exit of browser fullscreen.
3. **Synchronized Fullscreen State**: Subscribe to browser `fullscreenchange` and `webkitfullscreenchange` events to track React `isFullscreen` state dynamically.

## Consequences
* **Positive**:
  * Improves compatibility with strict browser security mechanisms (no more blocked unsolicited fullscreen request errors on startup).
  * Enhances UX by launching in full viewport default, with clean user-initiated toggle option.
  * Preserves clean console setting alignment.
* **Negative**:
  * The user must explicitly press Escape and toggle fullscreen to enter browser-level fullscreen manually if desired.

[^launch-proposal]: Viewport-First Game Launch Refactoring Proposal ([P-004](/proposals/P-004-game-launch-refactor.md))
