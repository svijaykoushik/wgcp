---
type: Investigation
investigation_id: I-006
title: Leaderboard & Identity Boundary Audit
description: Paper audit of the leaderboard score-verification flow and game-identity derivation mechanism proposed in P-002 and P-003, conducted prior to any implementation.
start_date: "2026-08-21"
status: completed
result: substantiated
sources:
  - id: p002-proposal
    resource: /proposals/P-002-game-sdk-storage-sync.md
    title: Game SDK & Portal Synchronization Specification
  - id: p003-proposal
    resource: /proposals/P-003-game-sdk-services-api.md
    title: Game Services API Specification
  - id: i005-boundary-audit
    resource: /investigations/I-005-sdk-completeness-and-boundary-scrutiny.md
    title: WGCP SDK Completeness and Boundary Scrutiny
---

# Investigation Report (I-006) - Leaderboard & Identity Boundary Audit

This investigation audits the game-identity derivation mechanism (P-002 §1.3, P-003 §2.2) and the leaderboard score-verification flow (P-003 §3.3) for logical gaps. It is scoped narrowly to these two boundaries at the request of the proposal owner, following [I-005](/investigations/I-005-sdk-completeness-and-boundary-scrutiny.md).

## 0. Method & Confidence Caveat

**P-002 and P-003 have no implementation.** No Game SDK, portal bridge, or backend service exists yet for either specification — the codebase referenced in prior investigations (e.g. `LauncherView.tsx` in I-005) covers only the existing iframe launcher, not the proposed message protocol or backend validation logic.

Every finding below is therefore a **text-level audit**: a gap, ambiguity, or contradiction that is provable by reading the specification as written, independent of runtime behavior. This is the same method I-005 used for its data-loss proof (the sync algorithm was proven flawed by tracing the documented steps, not by running code). It is a valid way to catch design bugs before they are built, but it cannot catch implementation bugs, timing issues, or anything contingent on how the portal and backend are actually coded. Treat `result: substantiated` below as "substantiated against the written spec," not "verified against a running system." A follow-up prototype or implementation-stage security review is still warranted before these boundaries are treated as load-bearing for production trust decisions — see §4.

---

## 1. Identity Derivation: Internal Inconsistency Between P-002 and P-003

P-002 §1.3 describes `gameId` derivation as:

> "The portal backend/wrapper identifies the game by mapping the active iframe element (`document.activeElement` or cross-referenced frame ID) to its registered registry entry."

This offers **two different mechanisms joined by "or"**, and the first of them is unsound:

* `document.activeElement` is a DOM *focus* concept. It identifies which element currently has keyboard focus — it has no defined relationship to which iframe *sent* a given `postMessage`. A backgrounded iframe (e.g. a preloaded next-game instance, a second game tab, or any future multi-iframe portal layout) can dispatch a `postMessage` while a *different* iframe holds focus. If the portal's identity derivation literally uses `document.activeElement`, a message from Game B could be attributed to Game A simply because Game A's iframe currently has focus — this is precisely the `gameId`-spoofing class of bug P-002 §1.3 and P-003 §2.2 both claim to prevent.
* The correct mechanism — matching `event.source` (the `postMessage` event's actual sender window reference) against the known content-window reference of each spawned iframe — is the one this investigation's own P-003 §2.2 revision documents, following I-005's original recommendation. That mechanism is sound: `event.source` is set by the browser to the true sending window and cannot be forged by the sending page.

**Finding**: P-002 §1.3's wording is not just imprecise, it names a mechanism (`document.activeElement`) that does not actually bind identity to message provenance. Because P-003 §2.2 was written to reference "the same way P-002 resolves it," the inconsistency should be closed at the source: **P-002 §1.3 should be revised to state `event.source` matching as the sole derivation mechanism**, and the `document.activeElement` / "cross-referenced frame ID" alternatives should be removed, not offered as equivalent options. A future revision of P-002 is required to close this before either proposal is safe to accept on the identity boundary.

---

## 2. Leaderboard Verification Token Authenticates the Channel, Not the Payload

P-003 §3.3 describes score submission as a two-phase flow:

1. `submitScore` triggers a token request from the SDK to the portal.
2. The portal registers a temporary write transaction with the backend, embedding client telemetry (session length, game activity).
3. The backend validates the token when the score is submitted and **rejects direct, non-brokered requests**.

This flow proves that a submission passed through the portal-brokered channel. It does **not**, as written, bind the token to a specific score value or score range at issuance time. Nothing in §3.3 states that the token is scoped to "a score of approximately X, given Y session activity" — only that a token was issued and later redeemed.

**Consequence**: a legitimate, portal-brokered game session can still submit an arbitrary score value through the properly authenticated channel. The two-phase check stops an attacker who bypasses the portal entirely (e.g. a hand-crafted HTTP request to the backend), but does not stop a compromised or modified game client — still running inside the legitimate iframe, still requesting a real token — from calling `submitScore(leaderboardId, 999999999)` with a fabricated score. The backend-side "velocity, anomaly, signature checks" mentioned in the P-003 §2.1 trust-tier table are the only defense against this, but §3.3 never specifies what data those checks run against, or whether the token's embedded telemetry (session length, game activity) is actually compared to the submitted score's plausibility. As written, the anomaly check is a named box with no defined contract.

**Finding**: the score-verification-token flow needs an explicit binding rule — e.g. the token should carry the telemetry snapshot at issuance, and the backend anomaly check must be specified as comparing the submitted score against that snapshot (not just checking "was a valid token redeemed"), or the proposal should state plainly that score plausibility is a game-specific bounds check configured per leaderboard (analogous to the "self-trusted, bounds-validated" model already used for Player Stats in §2.1). Currently P-003 implies the token flow *is* the anti-cheat mechanism; it is only half of one.

---

## 3. Cross-Proposal Interaction: Offline Queue Meets Score Tokens

P-002 §2.4 allows `saveState`/`submitScore`-class calls to queue while offline, with deduplication and retry on reconnect. P-003 §3.3's token flow does not state a token's validity window or single-use semantics, nor does it address what happens when a `submitScore` call that acquired a token is queued (per P-002 §2.4) and only actually transmitted much later on reconnect.

If a token is reusable or long-lived, and a queued score submission is retried after a delay, the telemetry embedded at token-issuance time (session length, game activity) may no longer correspond to the state of the game when the score is actually submitted — widening the same payload-binding gap from §2 above. This is not addressed in either document; it sits at the seam between them and neither proposal currently owns it.

**Finding**: P-003 §3.3 should define token expiry/single-use semantics, and explicitly state how (or whether) the token flow interacts with P-002's offline queue — e.g. tokens for untrusted-claim calls (`submitScore`, `unlockAchievement`) may need to be excluded from offline queuing entirely and require an online round-trip, rather than being queued like self-trusted persistence writes.

---

## 4. Adjacent Observation (Not Deep-Audited): Achievement Unlock Trust

P-002 §5.2 requires achievement unlocks to be idempotent via a transaction ID, and P-003 §3.2's sequence diagram shows the SDK generating `txId`. Neither document states whether unlock legitimacy (i.e., "did the player actually kill boss 1") is checked server-side beyond idempotency deduplication, or whether the `unlockAchievement(achievementId)` call is trusted at face value once a unique `txId` is presented. This mirrors the leaderboard gap in §2 — presented here only as a noted parallel, not audited to the same depth, since it falls outside this investigation's requested scope.

---

## 5. Summary

| Boundary | Status | Action Required |
| :--- | :--- | :--- |
| Identity derivation (`gameId`) | **Substantiated inconsistency** — P-002 §1.3 names an unsound mechanism alongside the sound one used elsewhere. | Revise P-002 §1.3 to require `event.source` matching exclusively. |
| Leaderboard score verification | **Substantiated gap** — token authenticates the channel, not the score value. | Define explicit score/telemetry binding in P-003 §3.3, or fold leaderboard scores into the bounds-validated model used for Player Stats. |
| Offline queue × score tokens | **Open question** — no defined interaction between P-002 §2.4 and P-003 §3.3. | Specify token expiry/single-use rules and whether untrusted-claim calls bypass offline queuing. |
| Achievement unlock legitimacy | **Noted, not audited** — same shape as the leaderboard gap. | Out of scope here; recommend a follow-up pass if accepted for a future investigation. |

All findings in this report are spec-text audits, not implementation verification — see §0. Given that a prior human-verified pass on P-002 already missed the data-loss bug I-005 later proved, and this second paper pass has again found substantive gaps, a further round of scrutiny (or a prototype spike) is recommended before formally accepting either proposal, particularly on the leaderboard boundary, which is the highest-value target for a cheating player and has not yet received any implementation-level review.
