---
type: Invariant
invariant_id: INV-003
title: SDK Feature Centralization Invariant
category: sdk
status: active
origin: AGENTS.md
generated: { by: antigravity/3.7, at: 2026-09-11T12:53:00+05:30 }
---

# Invariant (INV-003) - SDK Feature Centralization Invariant

## 1. Statement
Platform features—including storage synchronization, Escape key forwarding, achievements, leaderboards, stats reporting, and exit handshakes—**MUST NOT** be duplicated as ad-hoc inline scripts inside game HTML/JS files (`games/<game>/index.html`).

All hosted games **MUST** rely exclusively on the standalone WGCP SDK (`http://wgcp-sdk.localhost/wgcp-sdk.js`) or its official WASM/Emscripten bridge.

## 2. Rationale & Historical Incident
Duplicating postMessage listeners, RPC serialization, or storage interceptors directly inside game source directories leads to severe fragmentation:
* Protocol updates in the portal break uncoordinated inline game scripts.
* Security patches to origin validation cannot be rolled out globally without manually patching every game's HTML files.
* Bug fixes to debounced storage flush are missed when games implement custom synchronization logic.

## 3. Enforcement & Verification
1. **Game Packaging Standards**: Game templates inject `<script src="http://wgcp-sdk.localhost/wgcp-sdk.js"></script>` exclusively.
2. **Lint & Code Review**: Forbid raw `postMessage` implementations in `games/` unless interacting through `window.WGCP`.
