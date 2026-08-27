# Directory Update Log

## 2026-08-27
* **Creation**: Added design proposal [`P-004-game-launch-refactor.md`](/proposals/P-004-game-launch-refactor.md) for viewport-first game launch refactoring.

## 2026-08-21
* **Creation**: Added investigation report [`I-008-proposals-iterative-scrutiny.md`](/investigations/I-008-proposals-iterative-scrutiny.md) containing a three-round iterative audit examining the Emscripten FS bridge, binary data transfer, telemetry limit, and queue boundaries.
* **Creation**: Added investigation report [`I-007-proposal-security-and-queue-audit.md`](/investigations/I-007-proposal-security-and-queue-audit.md) auditing P-002 and P-003 on postMessage origin hijacking, pending promise stacking, queue sharing, and session migration race conditions.
* **Update**: Revised design proposals [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) and [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to close the identity-derivation and leaderboard-token gaps found in [`I-006-leaderboard-identity-boundary-audit.md`](/investigations/I-006-leaderboard-identity-boundary-audit.md).
* **Creation**: Added investigation report [`I-006-leaderboard-identity-boundary-audit.md`](/investigations/I-006-leaderboard-identity-boundary-audit.md) auditing the leaderboard score-verification flow and game-identity derivation mechanism proposed in P-002 and P-003.
* **Update**: Revised design proposal [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to trim the game-facing telemetry surface and codify `gameId` derivation across service modules, addressing boundary-scrutiny findings from [`I-005-sdk-completeness-and-boundary-scrutiny.md`](/investigations/I-005-sdk-completeness-and-boundary-scrutiny.md).
* **Update**: Revised design proposal [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) to fix a proven offline-sync data-loss failure mode and document the rejection of a transparent `localStorage` interceptor, addressing findings from [`I-005-sdk-completeness-and-boundary-scrutiny.md`](/investigations/I-005-sdk-completeness-and-boundary-scrutiny.md).

## 2026-08-18
* **Update**: Standardized and aligned `memory_spec.md` with OKF v0.2 spec for path resolution and footnote citations, resolving hardcoded environment-specific absolute filesystem paths across the catalog.
* **Creation**: Added investigation report [`I-004-memory-spec-pathing-portability.md`](/investigations/I-004-memory-spec-pathing-portability.md) documenting memory spec pathing and portability analysis.
* **Update**: Expanded design proposal [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) to incorporate player statistics, personal best models, and leveling progressions.
* **Creation**: Added design proposal [`P-003-game-sdk-services-api.md`](/proposals/P-003-game-sdk-services-api.md) defining the Game Services API Specification.
* **Creation**: Added investigation reports [`I-002-web-game-sdk-archeology.md`](/investigations/I-002-web-game-sdk-archeology.md) and [`I-003-platform-stats-progression-model.md`](/investigations/I-003-platform-stats-progression-model.md) analyzing web game SDK features and native platform statistics paradigms.

## 2026-08-17
* **Update**: Revised design proposal [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) to integrate review feedback on security boundaries, replication models, and storage constraints.
* **Creation**: Added design proposal [`P-002-game-sdk-storage-sync.md`](/proposals/P-002-game-sdk-storage-sync.md) outlining the Game SDK architecture and synchronization capabilities.
* **Creation**: Added investigation report [`I-001-game-storage-archeology.md`](/investigations/I-001-game-storage-archeology.md) to log state persistence methodologies of registered console games.

## 2026-08-15
* **Standardization**: Restructured memory catalog for progressive disclosure by establishing scoped `index.md` and `log.md` files within the `proposals/`, `decisions/`, `findings/`, and `investigations/` subdirectories.
* **Standardization**: Updated `memory_spec.md` to define schema rules and metadata formats for `Decision`, `Finding`, and `Investigation` concept types.
* **Standardization**: Standardized all core catalog memory documents (`architecture.md`, `game_integration.md`, `cli_ops.md`) under the Open Knowledge Format (OKF) v0.2 spec, introducing YAML frontmatter and per-claim footnote citations linked to source manifests.
* **Creation**: Added [`memory_spec.md`](/memory_spec.md) detailing custom types, formatting rules, actor schemas, and validation requirements.
* **Creation**: Added [`index.md`](/index.md) to serve as the root directory index to facilitate progressive disclosure.
* **Initialization**: Initialized the `.agents/memory/` directory containing foundational concept files for [`architecture.md`](/architecture.md), [`game_integration.md`](/game_integration.md), and [`cli_ops.md`](/cli_ops.md).
* **Initialization**: Created [`AGENTS.md`](/AGENTS.md) in the workspace root to instruct all agents to bootstrap their context by reading the memory catalog index.
