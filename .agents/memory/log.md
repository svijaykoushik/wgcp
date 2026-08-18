# Directory Update Log

## 2026-08-18
* **Update**: Expanded design proposal [`P-003-game-sdk-services-api.md`](file://./proposals/P-003-game-sdk-services-api.md) to incorporate player statistics, personal best models, and leveling progressions.
* **Creation**: Added design proposal [`P-003-game-sdk-services-api.md`](file://./proposals/P-003-game-sdk-services-api.md) defining the Game Services API Specification.
* **Creation**: Added investigation reports [`I-002-web-game-sdk-archeology.md`](file://./investigations/I-002-web-game-sdk-archeology.md) and [`I-003-platform-stats-progression-model.md`](file://./investigations/I-003-platform-stats-progression-model.md) analyzing web game SDK features and native platform statistics paradigms.

## 2026-08-17
* **Update**: Revised design proposal [`P-002-game-sdk-storage-sync.md`](file://./proposals/P-002-game-sdk-storage-sync.md) to integrate review feedback on security boundaries, replication models, and storage constraints.
* **Creation**: Added design proposal [`P-002-game-sdk-storage-sync.md`](file://./proposals/P-002-game-sdk-storage-sync.md) outlining the Game SDK architecture and synchronization capabilities.
* **Creation**: Added investigation report [`I-001-game-storage-archeology.md`](file://./investigations/I-001-game-storage-archeology.md) to log state persistence methodologies of registered console games.

## 2026-08-15
* **Standardization**: Restructured memory catalog for progressive disclosure by establishing scoped `index.md` and `log.md` files within the `proposals/`, `decisions/`, `findings/`, and `investigations/` subdirectories.
* **Standardization**: Updated `memory_spec.md` to define schema rules and metadata formats for `Decision`, `Finding`, and `Investigation` concept types.
* **Standardization**: Standardized all core catalog memory documents (`architecture.md`, `game_integration.md`, `cli_ops.md`) under the Open Knowledge Format (OKF) v0.2 spec, introducing YAML frontmatter and per-claim footnote citations linked to source manifests.
* **Creation**: Added [`memory_spec.md`](file://./memory_spec.md) detailing custom types, formatting rules, actor schemas, and validation requirements.
* **Creation**: Added [`index.md`](file://./index.md) to serve as the root directory index to facilitate progressive disclosure.
* **Initialization**: Initialized the `.agents/memory/` directory containing foundational concept files for [`architecture.md`](file://./architecture.md), [`game_integration.md`](file://./game_integration.md), and [`cli_ops.md`](file://./cli_ops.md).
* **Initialization**: Created [`AGENTS.md`](file:///home/vijaykoushik/Evee/My%20Documents/GitHub/Games/AGENTS.md) in the workspace root to instruct all agents to bootstrap their context by reading the memory catalog index.
