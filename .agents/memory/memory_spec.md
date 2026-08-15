---
type: Specification
title: Memory Catalog Specification
description: Rules, types, and actor conventions for the WGCP memory catalog under OKF.
status: stable
generated: { by: antigravity/2.0, at: 2026-08-15T12:10:00Z }
verified: { by: human:vijaykoushik, at: 2026-08-15T12:10:00Z }
sources:
  - id: okf-spec
    resource: https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/refs/heads/main/okf/SPEC.md
    title: Open Knowledge Format Specification (v0.2)
---

# WGCP Memory Catalog Specification

This specification defines how memory, metadata, and curated insights are structured, updated, and validated for the Web Game Console Platform (WGCP) using the **Open Knowledge Format (OKF) v0.2**.[^okf-spec]

---

## 1. Directory Structure

The memory catalog is structured as a single self-contained Knowledge Bundle located in the `.agents/memory/` directory of the repository root.

```text
.agents/memory/
  index.md             # Bundle-root index and registry (carries okf_version)
  log.md               # Chronological update log (newest first, ISO 8601)
  memory_spec.md       # This specification document
  architecture.md      # Platform architecture and routing design
  game_integration.md  # Contract and requirements for game developers
  cli_ops.md           # CLI commands and internal scripts documentation
  proposals/           # Subdirectory for design proposals and RFCs (P-###)
  decisions/           # Subdirectory for architectural decisions (D-###)
  findings/            # Subdirectory for static findings and analysis (F-###)
  investigations/      # Subdirectory for active investigations and bugs (I-###)
```

---

## 2. Concept Types

Every markdown concept file in this bundle must declare one of the following `type` fields in its frontmatter:

1. **`Specification`**: For documents defining developer standards, integration contracts, or guidelines (e.g. `game_integration.md`, `memory_spec.md`).
2. **`Architecture`**: For documentation explaining system design, network configurations, and routing topology (e.g. `architecture.md`).
3. **`Reference`**: For functional user manuals, command-line usage logs, or operational runbooks (e.g. `cli_ops.md`).
4. **`Proposal`**: For design proposals and specification RFCs. Uses ID format `P-###-<slug>.md`.
5. **`Decision`**: For architectural design choices and consensus records. Uses ID format `D-###-<slug>.md`.
6. **`Finding`**: For codebase analysis findings, audits, or performance metrics. Uses ID format `F-###-<slug>.md`.
7. **`Investigation`**: For debugging tracks, diagnostics, and issue tracking. Uses ID format `I-###-<slug>.md`.

---

## 3. Proposal Guidelines

Proposals represent architectural reviews or design transitions. They must follow these rules:
* **Naming**: Saved under `proposals/P-###-<title_slug>.md` where `###` is a sequential 3-digit padded number.
* **Frontmatter Metadata**:
  * `type: Proposal` (Required)
  * `proposal_id`: String (e.g., `P-001`)
  * `status`: Must be one of `proposed` (open for feedback), `accepted` (approved), or `rejected` (declined).
* **Cross-References**: Active proposals should link back to the architecture or specs they influence.

---

## 4. Decision Guidelines

Decisions capture choices made during project execution. They must follow these rules:
* **Naming**: Saved under `decisions/D-###-<title_slug>.md` where `###` is a sequential 3-digit padded number.
* **Frontmatter Metadata**:
  * `type: Decision` (Required)
  * `decision_id`: String (e.g., `D-001`)
  * `status`: Must be one of `proposed` (under review), `accepted` (active decision), `superseded` (replaced by a newer decision), or `deprecated` (no longer active).

---

## 5. Investigation Guidelines

Investigations record active diagnostic runs, debugging logs, and investigations of anomalous behavior. They must follow these rules:
* **Naming**: Saved under `investigations/I-###-<title_slug>.md` where `###` is a sequential 3-digit padded number.
* **Frontmatter Metadata**:
  * `type: Investigation` (Required)
  * `investigation_id`: String (e.g., `I-001`)
  * `start_date`: ISO 8601 Date `YYYY-MM-DD` (Required)
  * `status`: Must be one of `ongoing` (active run) or `completed` (finished).
  * `result`: Must be one of `substantiated` (issue verified), `unsubstantiated` (no issue found), `exonerated` (system cleared of fault), or `closed` (terminated without conclusion).

---

## 6. Finding Guidelines

Findings record static code audits, static analyses, or structural insights. They must follow these rules:
* **Naming**: Saved under `findings/F-###-<title_slug>.md` where `###` is a sequential 3-digit padded number.
* **Frontmatter Metadata**:
  * `type: Finding` (Required)
  * `finding_id`: String (e.g., `F-001`)
  * `status`: Must be one of `active` (unresolved vulnerability or issue) or `resolved`.

---

## 7. Log File Specification (`log.md`)

A `log.md` file records the chronological update history for a given scope. It can reside in the bundle root (`.agents/memory/log.md`) to capture high-level catalog adjustments or inside concept subdirectories (e.g., `.agents/memory/proposals/log.md`) to isolate sub-scope logs.

Log files must adhere to the following constraints from the OKF specification:
* **No Frontmatter**: Log files MUST NOT contain any YAML frontmatter.
* **Header**: The document MUST start with a level-1 header specifying the log's scope (e.g., `# Directory Update Log` or `# Decisions Update Log`).
* **Date Grouping**: Updates are grouped under level-2 headings using the ISO 8601 date format `## YYYY-MM-DD`.
* **Reverse-Chronological Ordering**: Date sections MUST be listed in descending order (newest date section first).
* **Entry Format**: Individual log events are represented as bullet points. Each bullet point MUST begin with a bolded revision classification (e.g., `**Initialization**`, `**Standardization**`, `**Creation**`, `**Update**`, `**Deprecation**`) followed by a brief description of the change and relative links to affected files.

---

## 8. Index File Specification (`index.md`)

An `index.md` file maps a directory's contents to enable progressive disclosure. It can reside in the bundle root (`.agents/memory/index.md`) or inside subdirectories (e.g., `.agents/memory/proposals/index.md`).

Index files must adhere to the following constraints from the OKF specification:
* **Frontmatter Constraint**:
  * The bundle-root `index.md` file MUST contain exactly one YAML frontmatter property: `okf_version: "0.2"`. No other frontmatter keys are allowed.
  * Subdirectory `index.md` files MUST NOT contain any frontmatter.
* **Header**: The document MUST start with a level-1 header specifying the index catalog's scope (e.g., `# Proposals Index`).
* **Grouping**: Items are grouped into categories under level-2 headings (e.g., `## Core Concepts`, `## Proposals`, `## Categories & Subdirectories`).
* **Bullet Listing**: Within each category, entries are listed as unordered bullets containing a Markdown link to the target document or subdirectory, followed by a hyphen and its one-line description:
  * Syntax: `* [Title](/absolute-or-relative-path) - description`
  * The description SHOULD match the `description` key declared in the target concept's frontmatter.

---

## 9. Actor Conventions

All `generated.by` and `verified.by` metadata fields must adhere to the OKF Actor Convention:

* **Agents**: `antigravity/<version>` (e.g. `antigravity/2.0`)
* **Humans**: `human:<username>` (e.g. `human:vijaykoushik`)
* **Processes**: `process:<job_name>` (e.g. `process:nightly-build`)

---

## 10. Provenance Rules

* All files in the bundle must reference their external/internal sources under the `sources` YAML frontmatter key.
* When referencing other repository files, use bundle-relative absolute paths (e.g. `/README.md` or `/platform.sh`) where the workspace root is mapped relative to the repository.

[^okf-spec]: Open Knowledge Format Specification (v0.2)
