---
type: Investigation
title: Memory Catalog Pathing and Portability Alignment Analysis
description: Investigation and resolution of pathing ambiguity, footnote citation specifications, and environment-portability bugs in the memory catalog.
status: completed
investigation_id: I-004
start_date: 2026-08-18
result: substantiated
sources:
  - id: okf-spec
    resource: https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/refs/heads/main/okf/SPEC.md
    title: Open Knowledge Format Specification (v0.2)
  - id: local-memory-spec
    resource: /memory_spec.md
    title: Memory Catalog Specification
---

# Investigation Report (I-004) - Memory Catalog Pathing and Portability Alignment

This investigation reports on the path resolution ambiguity, environment-portability issues, and lack of footnote citation specifications in the Web Game Console Platform (WGCP) memory catalog, aligning it with the Open Knowledge Format (OKF) v0.2 specification.[^okf-spec]

---

## 1. Discovered Anomalies & Portability Bugs

During a review of the catalog specification[^local-memory-spec] and its implementation, three major issues were identified:

1. **Non-Portable Filesystem Paths**: Multiple files contained hardcoded, machine-specific `file:///` URIs referring to local file structures on a single developer's system (e.g., `file:///home/vijaykoushik/Evee/My Documents/GitHub/Games/...`). These break the OKF goal of bundle portability and cause rendering errors in CI or alternate environments.
2. **Path Resolution Ambiguity**:
   * Some files (e.g., `game_integration.md`) referenced bundle concepts using repository-relative paths (e.g., `resource: /.agents/memory/proposals/...`).
   * Other files (e.g., `proposals/P-001-game-registry-spec-v2.md`) referenced bundle concepts using bundle-relative paths (e.g., `resource: /decisions/...`).
   * The specification failed to draw a clear line between the root of the **repository/workspace** and the root of the **bundle** for paths starting with `/`.
3. **Missing Footnote Citation Rules**: Although the documents extensively utilized markdown footnotes (e.g., `[^okf-spec]`) for per-claim source attribution, the rules governing their structure, stable labeling, and exclusion of fragile positional indexes (e.g., `[^1]`) were completely undocumented in the memory specification.

---

## 2. Structural & Architectural Solutions

To resolve these issues, the catalog was updated with the following guidelines:

### A. Resolution Domains
Paths starting with `/` are resolved under two strict contexts:
* **Repository-Relative Paths**: Used for source code, platform scripts, and assets outside the memory bundle. The repository root is mapped to `/` (e.g., `/platform.sh`).
* **Bundle-Relative Paths**: Used for cross-linking documents and referring to other concepts within the memory bundle. The bundle root `.agents/memory/` is mapped to `/` (e.g., `/architecture.md`).

### B. Footnote Citations
Footnote labels used for per-claim attribution must map directly and stably to the `id` field of a declared source inside the frontmatter:
* Positional mapping (e.g. `[^1]`) is prohibited to prevent document rewrites from silently misattributing claims.
* Footnote labels must use descriptive, stable IDs matching `sources[].id`.

### C. Portability Enforcement
All hardcoded absolute local filesystem URIs and protocol markers (`file:///`) were scrubbed and replaced with clean repository-relative or bundle-relative paths.

---

## 3. Findings & Resolution Summary

The investigation confirmed that the ambiguities were causing minor parsing issues and major portability failures. The specification has been successfully updated, and the modifications have been applied to 7 files in the memory catalog, creating a fully portable, consistent knowledge graph.

[^okf-spec]: Open Knowledge Format Specification (v0.2)
[^local-memory-spec]: Memory Catalog Specification
