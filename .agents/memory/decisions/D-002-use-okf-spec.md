---
type: Decision
title: Adopt Open Knowledge Format (OKF) v0.2
description: Decision to standardize WGCP agent memory catalog using the OKF specification.
status: accepted
decision_id: D-002
generated: { by: antigravity/2.0, at: 2026-08-15T12:10:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-15T12:10:00Z }
sources:
  - id: okf-spec
    resource: https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/refs/heads/main/okf/SPEC.md
    title: Open Knowledge Format Specification (v0.2)
---

# Decision: Adopt Open Knowledge Format (OKF) v0.2

## Context
With the introduction of the agent memory catalog, we need a standard format that is easily parseable by AI agents while remaining readable and editable by human developers. An ad-hoc documentation layout results in varied structure, missing update timestamps, lack of source provenance tracking, and inconsistent category naming.

## Decision
We will adopt the **Open Knowledge Format (OKF) v0.2** specification[^okf-spec] to structure the WGCP memory catalog. All catalog files will:
* Carry YAML frontmatter specifying `type`, `title`, `description`, `status`, `generated` (by actor, at datetime), `verified`, and `sources`.
* Reside in directory structures grouped by concept types.
* Incorporate standard directory listings (`index.md`) and chronological update logs (`log.md`).

## Consequences
* **Positive**:
  * Outlines clear, machine-readable headers containing credibility signals (generation/verification actors).
  * Promotes progressive disclosure of information through structured indexes.
  * Captures directory update lineages in a uniform, diffable history file (`log.md`).
* **Negative**:
  * Frontmatter must be manually maintained or programmatically kept up to date when documentation is edited.

[^okf-spec]: Open Knowledge Format Specification (v0.2)
