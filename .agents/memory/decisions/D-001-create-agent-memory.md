---
type: Decision
title: Create Agent Memory Catalog
description: Decision to establish a dedicated memory directory for onboarding agents.
status: accepted
decision_id: D-001
generated: { by: antigravity/2.0, at: 2026-08-15T12:10:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-15T12:10:00Z }
sources: []
---

# Decision: Create Agent Memory Catalog

## Context
As the Web Game Console Platform (WGCP) expands, multiple development agents (AI systems) and human developers need to collaborate on the repository. Traditional text files (like `README.md` and `ARCHITECTURE.md`) are often too broad or lack the structural guidelines needed by agentic tools to guarantee consistency. In addition, there is a need to prevent context drift and ensure agents follow specific guidelines (e.g., preserving network isolation, not modifying generated files).

## Decision
We will establish a dedicated agent memory catalog located at `.agents/memory/` in the repository root. This catalog will store structural knowledge, developer contracts, operational references, and decision logs.

## Consequences
* **Positive**:
  * AI agents can read a single entry point (`AGENTS.md`) and load high-fidelity context documents on session start.
  * Ensures compliance with repository boundaries, architecture layout, and CLI operations.
* **Negative**:
  * Catalog documentation must be updated as platform scripts, schemas, or routing interfaces change.
