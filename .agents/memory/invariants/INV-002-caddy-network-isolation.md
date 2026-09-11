---
type: Invariant
invariant_id: INV-002
title: Caddy Dynamic Gateway & Game Network Isolation Invariant
category: network
status: active
origin: AGENTS.md
generated: { by: antigravity/3.7, at: 2026-09-11T12:53:00+05:30 }
---

# Invariant (INV-002) - Caddy Dynamic Gateway & Game Network Isolation Invariant

## 1. Statement
All hosted games **MUST** remain strictly isolated on their own internal Docker Compose bridge networks. 

Game container ports **MUST NEVER** be published or exposed directly to host machine ports (e.g. `ports: - "8080:80"` is strictly prohibited in game compose definitions). All ingress traffic and origin routing must flow exclusively through the reverse-proxy gateway (`games-caddy-proxy`).

## 2. Rationale & Historical Incident
Exposing game container ports directly to the host breaks the browser Same-Origin Policy boundary and cross-origin security guarantees of the console portal (`http://console.localhost`). Direct host exposure enables malicious iframe scripts to bypass portal authentication, spoof origins, intercept sibling game saves, and collide with local host ports.

## 3. Enforcement & Verification
1. **Docker Compose Audit**: `platform.sh` and orchestration templates must attach game containers only to the internal `caddy-net` network.
2. **Dynamic Ingress**: Ingress routes must be provisioned dynamically via Caddy API / Caddyfile routing (`http://<game>.localhost`).
