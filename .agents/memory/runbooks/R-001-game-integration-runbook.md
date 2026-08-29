---
type: Runbook
runbook_id: R-001
title: Game Integration and Packaging Runbook
description: Standard operational runbook and checklist for containerizing, configuring capabilities, delegating permissions, and forwarding window inputs for WGCP games.
status: active
generated: { by: antigravity/3.5, at: 2026-08-29T09:40:00+05:30 }
sources:
  - id: game-integration-spec
    resource: /game_integration.md
    title: Game Integration Specification
  - id: escape-investigation
    resource: /investigations/I-010-viewport-escape-regression.md
    title: Viewport-First Launch Escape Key Regression
  - id: permission-decision
    resource: /decisions/D-005-storage-permission-delegation.md
    title: Interactive Storage Permission Decision
---

# Game Integration and Packaging Runbook (R-001)

This runbook defines the step-by-step developer checklist and coding standards for integrating and packaging HTML5/JS/WASM games into the Web Game Console Platform (WGCP). Adhering to these guidelines ensures proper keyboard focus management, security compliance, and capability delegation.[^game-integration-spec]

---

## 🗂️ Checklist Overview

1. [ ] **Step 1**: Write the Game Manifest (`game.yaml`)
2. [ ] **Step 2**: Containerize with Docker & Configure Network Isolation
3. [ ] **Step 3**: Implement Capturing-Phase Escape Key Forwarding
4. [ ] **Step 4**: Implement Storage Permission Delegation (If using IndexedDB/Persistence)
5. [ ] **Step 5**: Test and Register the Game Workload

---

## 🛠️ Step-by-Step Implementation

### Step 1: Write the Game Manifest (`game.yaml`)
Every game must include a declarative `game.yaml` configuration in its folder root containing the schema definition:
* Define unique game `id`.
* Set `hosting.hostname` matching `<game-id>.localhost`.
* List required sandboxing and browser feature permissions under `hosting.capabilities` (e.g. `autoplay`, `gamepad`, `fullscreen`, `persistent-storage`).

---

### Step 2: Containerize with Docker & Configure Network Isolation
1. **Dockerfile**: Create a lightweight production Dockerfile (e.g., `nginx:alpine`) to serve static client-side web assets on port `80`.
2. **Docker Compose**: Define a standard `docker-compose.yml` for the game:
   * **Banned Wildcards**: Under no circumstances should game containers expose host port mappings (e.g., `"80:80"` is forbidden).
   * **Isolated Network**: Route all container ingress through the `games-caddy-proxy` gateway by using the default bridge network (`<game-id>_default`).

---

### Step 3: Implement Capturing-Phase Escape Key Forwarding
Under the viewport-first windowed model (P-004), the game iframe receives direct keyboard focus. Because cross-origin iframes trap keyboard inputs, you **must** forward Escape keypresses via the `postMessage` protocol to trigger the platform's system settings menu.

#### ⚠️ Critical Firefox & Engine Swallowing Rule:
Many game loops (such as SDL/WASM or custom canvas key managers) capture keypresses on the canvas level and call `e.stopPropagation()` or `e.preventDefault()`, which prevents bubble-phase listeners on `window` from ever firing.
To prevent this, you **must register your keydown listener in the Capturing Phase** (`true` as the third parameter of `addEventListener`), forcing your forwarder to run first.[^escape-investigation]

Place this script tag inside the `<head>` of your game's entry HTML file:

```html
<script>
  if (window.self !== window.top) {
    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        // Halt event immediately so the game engine does not swallow it
        e.preventDefault();
        e.stopPropagation();
        
        // Generate UUIDv4 correlation ID to pass security envelope checks
        var correlationId = (function() {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            try { return crypto.randomUUID(); } catch (err) {}
          }
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        })();

        // Resolve parent origin dynamically and emit secure message
        var urlParams = new URLSearchParams(window.location.search);
        var portalOrigin = urlParams.get('wgcp_origin') || 'http://localhost';
        
        window.parent.postMessage({
          id: correlationId,
          type: 'WGCP_TOGGLE_MENU',
          source: 'WGCP_SDK',
          version: '2.0.0'
        }, portalOrigin);
      }
    }, true); // Crucial: Capturing phase listener
  }
</script>
```

---

### Step 4: Implement Storage Permission Delegation
If your game uses local file storage (like Emscripten `IDBFS` or browser IndexedDB) and requires persistent storage approval to prevent browser disk-space evictions:
1. Hijack the native `navigator.storage.persist` API using a proxy shim inside the game iframe.
2. Delegate the request via postMessage using the custom `WGCP_REQUEST_PERMISSION` envelope.[^permission-decision]
3. Wait for the `WGCP_REQUEST_PERMISSION_ACK` message from the parent console portal before resolving your persistence promise.

---

### Step 5: Test and Register the Game Workload
Once your files are configured:
1. Run registration via the CLI:
   ```bash
   ./platform.sh game add ./games/<your-game-folder>
   ```
2. Launch the game in Firefox and verify:
   * [ ] Game loads fully windowed, taking up the full viewport.
   * [ ] Gameplay works correctly with keyboard and controller.
   * [ ] Pressing the **Escape** key during gameplay successfully triggers the console menu overlay.
   * [ ] Clicking **Resume Game** successfully returns keyboard focus to the game canvas.

---

[^game-integration-spec]: Game Integration Specification ([/game_integration.md](/game_integration.md))
[^escape-investigation]: Escape Key Regression Investigation ([/investigations/I-010-viewport-escape-regression.md](/investigations/I-010-viewport-escape-regression.md))
[^permission-decision]: Storage Permission Delegation Decision ([/decisions/D-005-storage-permission-delegation.md](/decisions/D-005-storage-permission-delegation.md))
