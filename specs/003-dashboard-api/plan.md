# Implementation Plan: Dashboard Summary (Backend)

**Branch**: `003-dashboard-api` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-dashboard-api/spec.md`

## Summary

One read-only endpoint returning everything a dashboard needs: how many farms are registered, how
many hectares they cover, and three breakdowns ready to plot — hectares by federative unit, crop
records by crop, and hectares by land use.

This is the smallest feature so far and the only one that stores nothing. It adds no table, no
column, no migration and no write path; it reads what `002-rural-producer-crud` already records.
Authentication needs no code at all, for the third feature running.

What it does need care with: computing every figure from **one database snapshot** so the totals and
the breakdowns can never contradict each other, coalescing empty aggregates that come back `null`,
and choosing crop labels by a rule that produces the spelling people actually use.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 22 LTS (unchanged)

**Primary Dependencies**: **None added.** NestJS 11 and Prisma 6 as already installed;
`Prisma.Decimal` carries every hectare figure

**Storage**: PostgreSQL 16, read-only. No schema change, **no migration** — the first feature in
this project to ship none

**Testing**: Jest. `integration-db` tier against the disposable Postgres for the aggregation itself,
plus pure unit tests for the label rule, the zero filter and the sort
([R-010](./research.md#r-010))

**Target Platform**: Linux container (Docker), unchanged

**Project Type**: Web service — one new feature module inside the existing `backend/`

**Performance Goals**: SC-002 asks for under 2 s at 10,000 properties / 50,000 harvests / 150,000
crops. **Measured at ~35 ms** against exactly that shape, ~50x inside budget
([R-004](./research.md#r-004))

**Constraints**: All figures from one snapshot (FR-024) — which requires an explicit isolation
level, not merely a transaction; hectares summed as `Decimal` and never as numbers; empty
aggregates return `null` and must be coalesced; no personal data in the response (FR-027)

**Scale/Scope**: 1 endpoint, 1 module, 0 tables, 0 migrations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Principle | Status | How this design satisfies it |
|---|-----------|--------|------------------------------|
| I | Code Quality (SOLID, KISS, Clean Code) | ✅ PASS | One responsibility per unit: `DashboardRepository` fetches raw aggregates, `CropLabelResolver` picks a display label, `BreakdownBuilder` filters zeroes and sorts, `DashboardService` assembles. The label rule is its own testable function rather than a `reduce` buried in a service method. |
| II | Layered Architecture | ✅ PASS | Controller parses and delegates only. The service holds the rules (coalescing, unclassified arithmetic, filtering, ordering). The repository is the sole Prisma caller and owns the transaction boundary. |
| III | Explicit API Contracts | ✅ PASS | One endpoint in [contracts/openapi.yaml](./contracts/openapi.yaml), typed response DTOs, Swagger served. README (pt-BR) updated as a task. |
| IV | Test Coverage (NON-NEGOTIABLE) | ✅ PASS | Every rule gets a unit test; the endpoint gets integration tests. No new interpretation needed — this feature reuses the `integration-db` tier established in feature 002 rather than widening it. |
| V | Security by Default | ✅ PASS | Protected because the controller has no `@Public()`. Read-only, so nothing to authorise beyond that. FR-027 forbids any producer document in the response, and the existing log-leak gate covers it. |
| VI | Observability | ✅ PASS | A failure to produce the dashboard is logged with context (FR-026). Successful reads are **not** logged per request — see the note below. |
| VII | Mandated Technology Stack | ✅ PASS | No new dependency of any kind. The Principle VII boundary is not approached. |
| VIII | Language Policy | ✅ PASS | Code, comments, commits, logs English; OpenAPI text and land-use labels pt-BR. State keys stay UF codes, which are proper nouns either way ([R-012](./research.md#r-012)). |

### Note on Principle VI

Principle VI requires a structured log for "every significant business operation". A dashboard read
changes nothing and is likely to be called on a timer by a browser once the frontend exists, so
logging every success would produce steady noise that buries the events that matter — the
registrations, logins and cascade deletes from earlier features. Failures are logged in full.

This is a reading, not an exemption: a read that alters no state is not a business *operation* in
the sense the principle is aimed at. Recorded here so a reviewer can disagree deliberately.

### Post-Phase-1 re-check

Re-evaluated against the completed design ([data-model.md](./data-model.md),
[contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)): **no
violations, and no interpretations required**. This is the first feature whose Constitution Check
is clean on every principle without a recorded reading beyond the Principle VI note above. The
Complexity Tracking table stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-dashboard-api/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output — read model, no stored entities
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

One new module. The only file touched outside it is `app.module.ts`, to register it.

```text
backend/
├── src/
│   ├── app.module.ts                     # + DashboardModule (one line)
│   └── dashboard/
│       ├── dashboard.module.ts
│       ├── dashboard.controller.ts       # GET /dashboard
│       ├── dashboard.service.ts          # coalescing, unclassified, assembly
│       ├── dashboard.repository.ts       # sole Prisma caller; owns the transaction
│       ├── crop-label.resolver.ts        # most-used spelling, tie alphabetical (R-003)
│       ├── breakdown.builder.ts          # zero filter + deterministic sort (R-007, R-008)
│       └── dto/
│           └── dashboard-response.dto.ts # typed response, units declared
└── test/
    ├── unit/dashboard/
    │   ├── crop-label.resolver.spec.ts
    │   └── breakdown.builder.spec.ts
    └── integration-db/
        └── dashboard.e2e-spec.ts
```

**Structure Decision**: A single `DashboardModule`, deliberately not folded into
`PropertiesModule`. The dashboard reads across producers, properties, harvests and crops at once —
putting it inside any one of those modules would make that module the owner of a concern that spans
all of them. It also stays read-only, so keeping it separate means a reviewer can see at a glance
that nothing here writes.

`crop-label.resolver.ts` and `breakdown.builder.ts` are separate files rather than private service
methods because both are pure functions over already-fetched rows, and both have interesting edge
cases — ties, accents, empty input, all-zero input — that deserve exhaustive unit tests without a
database in the way.

## Risks

**Risk 1 — the consistency bug that testing will not catch.** FR-024 and FR-011 require the
breakdowns to reconcile with the totals. Under PostgreSQL's default Read Committed isolation, each
*statement* takes a fresh snapshot, so four independent queries see four points in time. A property
inserted mid-request yields a response whose slices do not sum to its own total — and nothing in
the code looks wrong, no test fails, and it only occurs under concurrent writes. Mitigated by
computing everything inside one transaction at **Repeatable Read**
([R-001](./research.md#r-001)). The obvious `Promise.all` implementation is the wrong one.

**Risk 2 — a 500 on a brand-new installation.** Prisma's `_sum` returns `null`, not zero, on an
empty table — measured, not assumed. Reading it directly and calling `.toFixed(2)` throws, so the
very first dashboard request against a fresh database fails. The count and the `groupBy` both behave
sensibly, which is what makes it easy to miss ([R-002](./research.md#r-002)). SC-004 exists to make
this a release gate.

**Risk 3 — the crop label nobody would choose.** The one-line `_min: { name: true }` is
deterministic and satisfies a careless reading of FR-016, but it picks `"SOJA"` over `"Soja"`
because uppercase sorts first in ASCII — surfacing the least-used spelling as the label. Measured
([R-003](./research.md#r-003)). Mitigated by grouping on `(nameNormalized, name)` and reducing in
the service.

**Risk 4 — two charts that invite an invalid comparison.** State slices are hectares; crop slices
are counts of plantings. Their totals will not match, by design (spec FR-021, FR-023). Someone will
eventually report it as a bug. The mitigation is documentation, not code: the payload declares each
breakdown's unit ([R-005](./research.md#r-005)), and the OpenAPI description says plainly that the
crop chart counts plantings and is not comparable with the farm count. The frontend feature that
follows will need to label them accordingly.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

No entries. No violations, and — unlike the two features before it — no interpretations of the
constitution were needed to reach a pass, beyond the Principle VI note on not logging successful
reads.
