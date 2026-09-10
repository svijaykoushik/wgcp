# Findings Index

This directory holds static code audits, static analyses, and structural insights for WGCP.

## Active Findings

* [Incremental Achievement Progress Calculation Disconnect](F-001-incremental-achievement-progress-scaling.md) - The backend achievement increment handler treats the submitted step parameter directly as a percentage increase rather than scaling against the manifest's declared maxSteps.
* [Hardcoded Anti-Cheat Heuristic Violating Platform Trust Boundaries](F-002-hardcoded-anti-cheat-heuristic-boundary.md) - The backend enforces an arbitrary, hardcoded rate-of-play check (2000 points per second) on leaderboard submissions, violating the platform architectural invariant and breaking speedrunners and high-multiplier games.
* [Missing Composite Database Indexes on Leaderboards Schema](F-003-missing-database-composite-indexes-leaderboards.md) - The leaderboards PostgreSQL table lacks composite B-tree indexes on (gameId, leaderboardId, score, updatedAt), causing sequential table scans and filesorts on ranking queries.
* [Static Frontend Fallback Data Violating Dynamic Ingestion Invariant](F-004-static-frontend-game-services-fallback.md) - Portal views for achievements and leaderboards rely on hardcoded TypeScript mock arrays (gameServicesData.ts) rather than dynamically ingesting services from the platform registry (games.json).
