# Investigations Index

This directory holds diagnostics, debugging trails, and active issue investigations.

## Investigations

* [Games Storage & State Persistence Archeology](I-001-game-storage-archeology.md) - Archeological analysis identifying how each registered game stores player data, assets, config, and progress.
* [Web Game SDK Service Analysis](I-002-web-game-sdk-archeology.md) - Technical analysis of CrazyGames and Poki SDKs, focusing on gameplay lifecycle events, data storage integration, advertisement triggers, and user authentication patterns.
* [Platform Stats & Progression Models](I-003-platform-stats-progression-model.md) - Technical analysis of Steamworks, Epic Online Services (EOS), and PlayFab statistics, achievements, personal bests, and player progression integration systems.
* [Memory Catalog Pathing and Portability Alignment Analysis](I-004-memory-spec-pathing-portability.md) - Investigation and resolution of pathing ambiguity, footnote citation specifications, and environment-portability bugs in the memory catalog.
* [WGCP SDK Completeness and Boundary Scrutiny](I-005-sdk-completeness-and-boundary-scrutiny.md) - Architectural completeness audit, monotonic revision offline data-loss proof, localStorage proxy trade-offs, and communication boundary verification.
* [Leaderboard & Identity Boundary Audit](I-006-leaderboard-identity-boundary-audit.md) - Paper audit of the leaderboard score-verification flow and game-identity derivation mechanism proposed in P-002 and P-003, conducted prior to any implementation.
* [Proposal Security, Race-Condition, and Queue Audit](I-007-proposal-security-and-queue-audit.md) - Advanced audit focusing on postMessage origin hijacking, pending promise stacking during conflict overlays, queue sharing, and session migration race conditions.
* [Proposals Iterative Scrutiny](I-008-proposals-iterative-scrutiny.md) - Three-round iterative audit examining the Emscripten FS bridge, binary data memory neutralization, client-side telemetry limits, and local vs. remote sync queueing.



