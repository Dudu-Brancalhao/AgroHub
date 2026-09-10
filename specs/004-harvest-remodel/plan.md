# Implementation Plan: Shared Harvests, Crop as Junction

**Branch**: `004-harvest-remodel` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-harvest-remodel/spec.md`

## Summary

Make a harvest a shared record — one "2021" for the whole registry rather than one per farm — and
make a crop the junction that connects a property to it.

This is the first feature that **changes work already shipped**, so its cost is mostly in reach
rather than depth: ten source files and ten test files move, across two earlier features. The new
logic itself is small — two constraints, one refusal, one regrouped response.

Two things it is worth being precise about, because both differ from what the request originally
assumed. **The dashboard does not change at all** — verified against the query, not inferred. And
**only `crops` and `harvests` are destroyed**, not the whole registry, because that is all the "no
migration" answer actually required.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 22 LTS (unchanged)

**Primary Dependencies**: **None added.** NestJS 11 and Prisma 6 as installed

**Storage**: PostgreSQL 16. One migration that **drops and recreates `crops` and `harvests` only**
([R-001](./research.md#r-001)). `producers`, `properties` and everything belonging to authentication
are untouched

**Testing**: Jest, tiers unchanged. `integration-db` against the disposable Postgres for the
constraint and cascade behaviour that is the substance of this change
([R-010](./research.md#r-010))

**Target Platform**: Linux container (Docker), unchanged

**Project Type**: Web service — restructuring inside the existing `backend/`

**Performance Goals**: Unchanged. SC-006 still requires the dashboard under two seconds at 10,000
properties and 150,000 crops; the fixture that produces that shape must be rebuilt because it can no
longer create 50,000 harvests ([R-007](./research.md#r-007))

**Constraints**: A year identifies exactly one harvest, so the table holds **at most 128 rows ever**;
a harvest may not be deleted while any crop references it; a crop must be unique per farm, harvest
and normalised name; nothing outside the harvest–crop relationship may change behaviour

**Scale/Scope**: 2 tables reshaped, 0 new tables, 10 source files, 10 test files, ~9 routes changed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Principle | Status | How this design satisfies it |
|---|-----------|--------|------------------------------|
| I | Code Quality (SOLID, KISS, Clean Code) | ✅ PASS | The restructure improves it: `HarvestsService` stops taking a property it never owned, and the crop service gains one honest responsibility — validating two parents. Harvest handling moves out of the property module into its own, so a module no longer owns a concern that is not its own. |
| II | Layered Architecture | ✅ PASS | Unchanged chain. The harvest-delete refusal is a business rule and lives in the service, with the database constraint as a backstop, not as the rule ([R-005](./research.md#r-005)). |
| III | Explicit API Contracts | ✅ PASS | Every changed route in [contracts/openapi.yaml](./contracts/openapi.yaml), typed DTOs, Swagger served. The two delete endpoints whose report shape changes are documented explicitly ([R-008](./research.md#r-008)). |
| IV | Test Coverage (NON-NEGOTIABLE) | ✅ PASS | Every new rule gets a unit or integration test; every changed endpoint keeps one. The regression surface is enumerated in [R-009](./research.md#r-009) rather than trusted to memory. |
| V | Security by Default | ✅ PASS | Routes stay protected by the global guard; none carries `@Public()`. The new refusal *reduces* destructive reach — a shared harvest can no longer be deleted out from under other farms. |
| VI | Observability | ✅ PASS | Harvest and crop events keep their structured logs; the refusal logs how many crops blocked it. |
| VII | Mandated Technology Stack | ✅ PASS | No new dependency. |
| VIII | Language Policy | ✅ PASS | Code and logs English; API text pt-BR. `Harvest` is kept precisely because *safra* is the domain word ([R-002](./research.md#r-002)). |

### Note on changing shipped work

Nothing in the constitution covers amending a delivered feature, and this is the first time it has
come up. The reading applied: **a change to shipped behaviour is held to the same gates as new
behaviour, and additionally must leave every untouched behaviour provably intact.** That is what
FR-027 – FR-032 and SC-005 exist for, and why [R-009](./research.md#r-009) enumerates the blast
radius instead of relying on the test suite to catch omissions.

### Post-Phase-1 re-check

Re-evaluated against the completed design: **no violations**. Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-harvest-remodel/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

No new directory. Harvest handling moves out of `properties/` into its own module — the change this
feature is fundamentally about, expressed in the file layout.

```text
backend/
├── prisma/
│   ├── schema.prisma                     # Harvest loses producerless propertyId; Crop gains it
│   └── migrations/                       # + one migration: drop and recreate crops + harvests
├── src/
│   ├── app.module.ts                     # + HarvestsModule
│   ├── harvests/                         # NEW — a harvest belongs to nobody
│   │   ├── harvests.module.ts
│   │   ├── harvests.controller.ts        # /harvests
│   │   ├── harvests.service.ts           # incl. the delete refusal
│   │   ├── harvests.repository.ts
│   │   └── dto/{create-harvest,harvest-response}.dto.ts
│   ├── properties/
│   │   ├── properties.controller.ts      # /properties/:id/crops
│   │   ├── properties.service.ts         # crop creation validates two parents
│   │   ├── properties.repository.ts      # crop queries carry propertyId
│   │   ├── crops.*.ts                    # moved out of the harvest chain
│   │   ├── dto/create-crop.dto.ts        # + harvestId
│   │   └── entities/property.entity.ts   # crops grouped by harvest
│   ├── producers/
│   │   ├── producers.repository.ts       # include: properties -> crops -> harvest
│   │   └── producers.service.ts          # detail mapping + delete report
│   └── dashboard/                        # UNCHANGED — see R-007
└── test/
    ├── integration-db/harvests.e2e-spec.ts   # NEW — shared harvests, delete refusal
    └── …                                     # 10 existing files per R-009
```

**Structure Decision**: A `harvests/` module of its own, rather than leaving harvest code inside
`properties/`. Keeping it there would preserve exactly the misconception the feature removes — that
a harvest is something a property has. Crops stay with properties, because the property owns them
and a crop dies with its farm.

## Risks

**Risk 1 — safra and safrinha stop being recordable, and it cannot be undone cheaply.** Feature 002
deliberately left `(propertyId, year)` un-constrained so a farm could record a main crop and a
second planting in one calendar year, and documented why. A globally unique year removes that; a
passing test asserting the current behaviour has to be inverted. The chart is unaffected — that farm
contributes one record instead of two, and the chart counts records — so what is lost is the
ability to *record* the fact, not to count it. Restoring it later means giving a harvest a label and
making the pair unique: a schema change plus a migration on whatever data exists by then
([R-011](./research.md#r-011)). **This is the only irreversible part of the feature.**

**Risk 2 — the scale fixture breaks in a way that looks like a product bug.** `seedAtScale` creates
50,000 harvests across five distinct years. Under a unique year it can create five, and the
performance test fails on a constraint violation that reads like a defect in the feature rather than
in its own setup. Measured and quantified in [R-007](./research.md#r-007); the fixture must be
rebuilt to seed a handful of harvests and spread 150,000 crops across property-harvest-name
combinations, which is still comfortably reachable.

**Risk 3 — silent contract drift on two delete endpoints.** `DELETE /producers/:id` and
`DELETE /properties/:id` stop reporting a harvest count, because harvests are no longer beneath
either. Both endpoints keep working, which is exactly why the change gets missed
([R-008](./research.md#r-008)). The contract test is the guard.

**Risk 4 — a regression in the two-thirds of the system this feature does not intend to touch.**
Producers, properties, areas, documents, authentication and every dashboard figure must come through
unchanged. Mitigated by enumerating the blast radius up front ([R-009](./research.md#r-009)) rather
than discovering it from failing tests, and by SC-005 requiring every previously passing behaviour
to still pass.

**Risk 5 — destroying more than necessary.** The specification's Assumptions license discarding
producers and properties as well. The plan deliberately does less ([R-001](./research.md#r-001)),
because "rebuild from empty" was an answer about *not writing a migration*, and only two tables need
one. Flagged because it is a deliberate departure from the wording, in the safer direction.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

No entries. One reading was recorded — that amending shipped work is held to the same gates plus a
duty to leave untouched behaviour provably intact — which is an addition to the bar, not an
exception to it.
