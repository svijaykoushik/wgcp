---
type: Decision
title: Implement Interactive Storage Permission Delegation for Cross-Origin Game Iframes
description: Choice to handle persistent storage permissions using a combination of a game-side postMessage delegation shim and a portal-side modal overlay to capture user gestures securely.
status: accepted
decision_id: D-005
generated: { by: antigravity/3.5, at: 2026-08-28T22:40:00+05:30 }
verified: { by: human:vijaykoushik, at: 2026-08-28T22:40:00+05:30 }
sources:
  - id: supertux-storage-investigation
    resource: /investigations/I-009-supertux-persistent-storage-issue.md
    title: SuperTux Persistent Storage Request Failure Investigation
---

# Decision: Implement Interactive Storage Permission Delegation for Cross-Origin Game Iframes

## Context
As documented in the SuperTux Persistent Storage Request Failure Investigation[^supertux-storage-investigation], standard web browsers block cross-origin iframes (like `supertux.localhost` embedded inside the portal `localhost`) from requesting storage persistence natively via `navigator.storage.persist()`.
To bypass this limitation, we previously designed a `postMessage`-based permission delegation mechanism. However, this failed in practice because:
1. Third-party games like SuperTux call native `navigator.storage.persist()` and are not naturally integrated with custom postMessage protocols.
2. Even when messages are sent to the parent, calling `navigator.storage.persist()` asynchronously inside a `message` event handler runs without a user activation context (user gesture), causing browsers like Firefox to silently deny the prompt.

## Decision
We decided to adopt the **Interactive Portal Modal & Game Shim** architecture:
1. **Dynamic Origin Injection**: During URL resolution in the portal launcher ([`LauncherView.tsx`](/portal/frontend/src/views/LauncherView.tsx)), we append the portal's parent origin as a query parameter (`wgcp_origin`) to the game's iframe source URL.
2. **Game-Side Delegation Shim**: In game build templates (e.g., [`template.html.in`](/games/supertux/mk/emscripten/template.html.in)), we check if the game is framed. If so, we override `navigator.storage.persist` to hijack the native API, intercepting the request and delegating it via `postMessage` to the verified `wgcp_origin` parent.
3. **Portal-Side Permission Modal**: When [`LauncherView.tsx`](/portal/frontend/src/views/LauncherView.tsx) receives the delegated `WGCP_REQUEST_PERMISSION` message, it sets React state to display a user-friendly modal overlay dialog asking the user to allow or deny persistent storage.
4. **User-Gesture-Powered Permission Request**: The click handler of the modal's "Allow" button runs within a valid user-gesture tick. This click handler executes `navigator.storage.persist()` in the first-party context, triggering the browser's native permission prompts successfully, before sending the `WGCP_REQUEST_PERMISSION_ACK` back to the game.

## Consequences
* **Positive**:
  * Restores functional persistent storage capabilities for games inside cross-origin iframes.
  * Captures user gestures cleanly, ensuring Firefox and other browsers display their native permission prompts without silent rejection.
  * Preserves game isolation by keeping the custom protocol shim entirely contained in the HTML build template rather than polluting the game's core C++ or WASM source code.
  * Allows native Permissions Policy (`allow="camera; microphone; gamepad; fullscreen"`) to handle standard delegable APIs natively, avoiding custom boilerplate for other features.
* **Negative**:
  * Introduces a portal-level dialog when a game first requests storage persistence, adding one click of friction for the user.

[^supertux-storage-investigation]: SuperTux Persistent Storage Request Failure Investigation ([I-009](/investigations/I-009-supertux-persistent-storage-issue.md))
