---
type: Invariant
invariant_id: INV-005
title: Platform vs Game Trust Boundary Invariant
category: security
status: active
origin: AGENTS.md
generated: { by: antigravity/3.7, at: 2026-09-11T12:53:00+05:30 }
---

# Invariant (INV-005) - Platform vs Game Trust Boundary Invariant

## 1. Statement
The WGCP platform backend **MUST NEVER** enforce game-specific scoring rules, rate-of-play heuristics, or hardcoded gameplay anti-cheat algorithms in core services. 

The platform's sole responsibility is user authentication, origin/sandbox isolation, transport payload hygiene (finite numbers, max 2KB metadata), storage ranking, and UI presentation. Gameplay simulation, score calculations, and in-game anti-tamper belong strictly to the game client or dedicated game servers.

## 2. Rationale & Historical Incident
Embedding game-specific score logic (e.g. "2048 tiles must be powers of two" or "SuperTux coin increment cannot exceed 10/sec") into backend Fastify routes creates brittle platform coupling. Every game update or new game integration would require redeploying core platform services, violating the platform's multi-tenant extensibility contract.

## 3. Enforcement & Verification
1. **Backend Validation Schemas**: Fastify route schemas validate generic data types (e.g. `score: { type: 'number', minimum: 0 }`, finite check) rather than game-specific formulas.
2. **Architecture Audits**: Ensure backend routes remain agnostic to individual game IDs.
