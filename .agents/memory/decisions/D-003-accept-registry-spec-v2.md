---
type: Decision
title: Adopt Game Registry Specification (v2)
description: Decision to adopt the F-Droid v2 inspired Game Registry Specification (v2).
status: accepted
decision_id: D-003
generated: { by: antigravity/2.0, at: 2026-08-15T12:15:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-15T12:15:00Z }
sources:
  - id: registry-proposal
    resource: /proposals/P-001-game-registry-spec-v2.md
    title: Game Registry Specification (v2) Proposal
---

# Decision: Adopt Game Registry Specification (v2)

## Context
As detailed in the Game Registry Specification (v2) Proposal,[^registry-proposal] the initial flat array format of the registry (`games.json`) was insufficient for advanced platform capabilities like internationalization (i18n), tracking multiple release channels (stable, beta, nightly) for a single game, and separating static descriptive listings from dynamic system runtime details. We needed a scalable metadata model.

## Decision
We will adopt and implement the **Game Registry Specification (v2)**.[^registry-proposal] The new specification restructures `games.json` using the F-Droid index structure:
1. Replaces the root games array with an object map (keyed by game ID) for $O(1)$ lookups.
2. Implements localized dictionaries for names, summaries, and descriptions.
3. Separates user-facing descriptive `metadata` from container/reverse-proxy `releases` details.

## Consequences
* **Positive**:
  * Native translation support for the portal UI.
  * Extensible structure for supporting rollbacks and multiple release channels simultaneously.
  * Cleaner division of concerns between static game parameters and Caddy/Docker runtime specs.
* **Negative**:
  * Platform integration scripts (e.g. `register-game.sh`, `update-caddy.sh`) and portal frontend parsing engines must be refactored to parse the new schema.

[^registry-proposal]: Game Registry Specification (v2) Proposal ([P-001](/proposals/P-001-game-registry-spec-v2.md))
