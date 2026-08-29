---
type: Investigation
investigation_id: I-010
title: Viewport-First Launch Escape Key Regression
description: Diagnostic report into why the Escape key fails to open the system menu overlay on initial game launch under the viewport-first windowed model.
start_date: "2026-08-29"
status: completed
result: substantiated
generated: { by: antigravity/3.5, at: 2026-08-29T09:20:00+05:30 }
sources:
  - id: launcherview-src
    resource: /portal/frontend/src/views/LauncherView.tsx
    title: LauncherView Component
  - id: supertux-template
    resource: /games/supertux/mk/emscripten/template.html.in
    title: SuperTux HTML Build Template
  - id: launch-proposal
    resource: /proposals/P-004-game-launch-refactor.md
    title: Viewport-First Game Launch Refactoring Proposal
  - id: integration-runbook
    resource: /runbooks/R-001-game-integration-runbook.md
    title: Game Integration and Packaging Runbook
---

# Investigation Report (I-010) - Viewport-First Launch Escape Key Regression

## 1. Context & Symptoms

Following the platform refactoring to a **viewport-first** game launching model (P-004), manual verification revealed that:
1. The user launches a game, which runs windowed (occupying the full viewport of the browser tab).
2. The user presses the **Escape** key to trigger the platform menu, but the keypress is ignored and the menu does not open.
3. The user clicks the semi-transparent **⚙ System Menu** button floating in the top-right corner to access the menu overlay successfully.
4. The user clicks **Resume Game** to exit the menu and continue their playthrough.
5. From this point onward, pressing the **Escape** key successfully toggles the platform menu.

---

## 2. Technical Diagnostics & Findings

An analysis of the focusing logic, event handlers, and React component lifecycle inside `LauncherView.tsx` revealed two distinct root causes:

### Finding A: Cross-Origin Iframe Event Trapping (Initial Launch)
On initial launch, the game iframe loads and receives focus via `scheduleAsyncFocus()`. 
* **Consequence**: Focus is shifted to the window and canvas elements inside the cross-origin iframe context (e.g. `http://supertux.localhost` embedded inside the portal at `http://localhost`).
* **Browser Security Boundary**: Keydown and keyup keyboard events occurring inside a cross-origin iframe are strictly isolated by the browser and **do not bubble or propagate up to the parent window context**.
* **Contrast with Pre-Refactor Behavior**: Prior to the viewport-first refactor, games launched automatically in browser-level fullscreen using the Fullscreen API. Under that design, pressing Escape was intercepted by the browser to exit fullscreen, which fired a global `fullscreenchange` event on the parent document. The parent's event listener caught that change to auto-reveal the menu overlay. With windowed full-viewport as the default, no browser-level fullscreen exits occur, and the parent is left blind to Escape keypresses occurring inside the focused cross-origin iframe.

### Finding B: Stale Closure Focus Abort (Post-Resume)
Why does pressing Escape work after clicking the floating Cog button and resuming? 
* **The Cause**: A stale closure React state bug inside the `LauncherView` focus timers.
* **Mechanism**:
  1. When the menu overlay is open, `isOverlayOpen` is `true`.
  2. Clicking **Resume Game** executes `resumeGame()`:
     ```typescript
     const resumeGame = () => {
       setIsOverlayOpen(false); // Schedules state change
       scheduleAsyncFocus();
     };
     ```
  3. `scheduleAsyncFocus()` schedules `focusIframe()` asynchronously inside requestAnimationFrame and `setTimeout` delays.
  4. Crucially, the function `focusIframe` checks:
     ```typescript
     const focusIframe = () => {
       const iframe = iframeRef.current;
       if (!iframe || isOverlayOpen) return; // Stale closure checks!
       ...
     ```
  5. Because React state updates are batched/asynchronous, `isOverlayOpen` remains `true` within the closure of the render that executed `resumeGame`. All scheduled timeouts capture that exact closure.
  6. When the timeouts execute, they see `isOverlayOpen` as `true` and abort immediately, **failing to focus the iframe**.
  7. Because the iframe is never focused, keyboard focus remains on the parent window context. Thus, if the player attempts to play using the keyboard, they are actually pressing keys in the parent context. When they press Escape, the parent's keydown listener catches it directly, which explains why the menu pops up the second time.
  8. If the player clicks on the game iframe to play, focus shifts to the iframe, and the Escape key regression returns (it fails to register again).

---

## 3. Proposed Solution Pathways

### Option 1: Fix Stale Closure & Implement postMessage Escape Forwarding
1. **Fix Stale Closure**: Use a React Ref (`isOverlayOpenRef`) to track the active menu overlay state dynamically so that `focusIframe` always reads the most up-to-date value, ensuring focus is successfully returned to the iframe upon resumption.
2. **Implement Keyboard Forwarding inside Game Template**:
   * Update the game template `games/supertux/mk/emscripten/template.html.in` to listen for the `Escape` key inside the game window.
   * When `Escape` is pressed, forward it as a secure `WGCP_TOGGLE_MENU` message using the `wgcp_origin` query parameter to the parent portal.
3. **Listen for TOGGLE_MENU in LauncherView**:
   * Add a message handler for `WGCP_TOGGLE_MENU` inside the portal parent to toggle `isOverlayOpen` securely when the message is received.

### Option 2: Document-Level Blur Detection (Focus Grabber)
* Keep focus on the parent window during viewport-first launch and only delegate keyboard focus to the iframe. (This is generally not viable for WASM/Canvas games, which require absolute DOM focus to capture mouse/keyboard inputs without layout scrolling issues).

---

## 4. Resolution & Verification

We implemented **Option 1** with crucial browser hardening for Firefox:
1. **Stale Closure Fix**: Added `isOverlayOpenRef` in `LauncherView.tsx` to fix the stale closure focus bug, allowing correct focus management on resume.
2. **Capturing Phase Listener Hardening**: Intercepting the `Escape` key inside the game frame requires the **capturing phase** (`addEventListener('keydown', ..., true)`). In browsers like Firefox, the game's internal engines (e.g. SDL/WASM in SuperTux or custom input loops in Hextris) register listeners that call `preventDefault()` or `stopPropagation()`, which swallows the keypress before bubble-phase listeners can fire. Registering in the capturing phase ensures the postMessage forwarder runs first and halts further propagation.
3. **Global Integration**: Rolled out the capturing Escape key forwarding script across the HTML build files for all registered games in the workspace:
   * `games/supertux/mk/emscripten/template.html.in` (and live container instance)
   * `games/hextris/index.html` (and live container instance)
   * `games/2048/index.html` (and live container instance)
   * `games/adarkroom/index.html` (and live container instance)
   * `games/BrowserQuest/client/index.html` (and live container instance)
4. **Message Ingress**: Configured the portal to permit the `WGCP_TOGGLE_MENU` RPC payload inside `security.ts` and handle it inside `LauncherView.tsx` to trigger the menu.
5. **Validation**: All unit tests and E2E Playwright tests passed successfully. Manual verification in Firefox confirms the platform menu opens reliably on pressing Escape across all games.
6. **Procedural Cataloging**: The step-by-step procedure for Escape key event forwarding and permission delegation was formalized into a platform runbook standard ([R-001](/runbooks/R-001-game-integration-runbook.md)).[^integration-runbook]

[^integration-runbook]: Game Integration and Packaging Runbook ([R-001](/runbooks/R-001-game-integration-runbook.md))
