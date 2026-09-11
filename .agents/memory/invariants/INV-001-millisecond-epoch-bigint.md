---
type: Invariant
invariant_id: INV-001
title: Millisecond Epoch Timestamp BigInt Schema Invariant
category: schema
status: active
origin: AGENTS.md
generated: { by: antigravity/3.7, at: 2026-09-11T12:53:00+05:30 }
---

# Invariant (INV-001) - Millisecond Epoch Timestamp BigInt Schema Invariant

## 1. Statement
All database timestamp columns storing epoch milliseconds in Drizzle/Postgres schemas (e.g., `updatedAt`, `timestamp`, `createdAt`, `unlockedAt`) **MUST** be defined as `bigint("...", { mode: "number" })`. 

Under no circumstances may integer types (`integer()`) be used for epoch millisecond storage.

## 2. Rationale & Historical Incident
PostgreSQL `integer` is a 32-bit signed integer with a maximum positive value of $2,147,483,647$ ($2^{31}-1$). In Unix epoch timestamps:
* $2,147,483,647$ seconds corresponds to January 19, 2038.
* $2,147,483,647$ milliseconds corresponds to **January 25, 1970**.

Any JavaScript `Date.now()` value (exceeding $1.7 \times 10^{12}$ ms) inserted into an `integer` column triggers a fatal Postgres runtime exception: `integer out of range` (SQLSTATE `22003`), crashing backend save and stats endpoints.

## 3. Enforcement & Verification
1. **Drizzle Schema Definition**: Verify `platform/backend/src/db/schema.ts` uses `bigint("...", { mode: "number" })`.
2. **Automated Unit Tests**: Backend integration tests inserting `Date.now()` payloads into database tables must pass without numeric overflow errors.
