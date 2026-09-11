# Invariants Index

This directory holds permanent platform invariants, runtime safety rules, and architectural constraints under OKF v0.2.

## Invariants Catalog

* [INV-001 Millisecond Epoch Timestamp BigInt Schema Invariant](INV-001-millisecond-epoch-bigint.md) - Mandates `bigint("...", { mode: "number" })` for all epoch millisecond database columns to prevent 32-bit integer overflow. [Category: schema, Status: active]
* [INV-002 Caddy Dynamic Gateway & Game Network Isolation Invariant](INV-002-caddy-network-isolation.md) - Forbids publishing game ports directly to the host machine; all traffic must flow through Caddy reverse-proxy gateway. [Category: network, Status: active]
* [INV-003 SDK Feature Centralization Invariant](INV-003-sdk-feature-centralization.md) - Forbids duplicating platform features as inline scripts in game HTML/JS; all games must use standalone `wgcp-sdk.js`. [Category: sdk, Status: active]
* [INV-004 Graceful Game Exit & WASM State Flush Invariant](INV-004-wasm-exit-flush-handshake.md) - Mandates `WGCP_PREPARE_EXIT` RPC handshake before portal unmounts game iframe to prevent asynchronous save loss. [Category: lifecycle, Status: active]
* [INV-005 Platform vs Game Trust Boundary Invariant](INV-005-platform-trust-boundary.md) - Forbids hardcoded game-specific anti-cheat and scoring logic in platform backend services. [Category: security, Status: active]
