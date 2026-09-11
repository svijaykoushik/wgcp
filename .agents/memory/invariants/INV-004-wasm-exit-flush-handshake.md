---
type: Invariant
invariant_id: INV-004
title: Graceful Game Exit & WASM State Flush Invariant
category: lifecycle
status: active
origin: P-007
generated: { by: antigravity/3.7, at: 2026-09-11T12:53:00+05:30 }
---

# Invariant (INV-004) - Graceful Game Exit & WASM State Flush Invariant

## 1. Statement
The console portal launcher (`LauncherView.tsx`) **MUST NOT** immediately unmount a game `<iframe />` from the DOM when a player exits to the library or closes the session. 

The portal **MUST** execute the bidirectional `WGCP_PREPARE_EXIT` RPC handshake with the game SDK, awaiting the `WGCP_PREPARE_EXIT_ACK` response (or an absolute 1500ms safety timeout) before unmounting the iframe.

## 2. Rationale & Historical Incident
As documented in investigation [`I-013`](/investigations/I-013-supertux-unload-save-sync-failure.md) and finding [`F-005`](/findings/F-005-supertux-wasm-unload-cloud-sync-failure.md), abrupt DOM unmounting synchronously fires the browser's `unload` event, instantly terminating pending asynchronous microtasks, Web Crypto checksum calculations, IndexedDB sync transactions, and in-flight cloud upload requests. Games using the 500ms debounced WASM bridge consistently suffer total loss of progress made within the final 500ms of gameplay if exited abruptly.

## 3. Enforcement & Verification
1. **Portal Teardown Logic**: `LauncherView.tsx` sets `isClosing = true`, posts `WGCP_PREPARE_EXIT`, and waits for `WGCP_PREPARE_EXIT_ACK`.
2. **Playwright E2E Tests**: Integration tests asserting save persistence after rapid exit triggers must pass with 100ms exit delays.
