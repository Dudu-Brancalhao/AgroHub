# Implementation Plan: Rural Producer Registry (CRUD)

**Branch**: `002-rural-producer-crud` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-rural-producer-crud/spec.md`

## Summary

Build the registry of who farms what and where: producers identified by a validated CPF or CNPJ,
their properties, the harvests recorded against those properties, and the crops planted in each
harvest. Full CRUD over four resources, plus a paged and searchable producer list.

Technically this is the first feature to land on an **existing** codebase, and most of its
non-functional requirements are already met. Authentication needs no code at all — the global
`JwtAuthGuard` from feature 001 protects every new route by virtue of it not carrying `@Public()`.
The error envelope, the aggregating `ValidationPipe`, structured logging and the log-leak gate are
all inherited.

What is genuinely new: exact decimal arithmetic for the area rule, check-digit validation for
Brazilian documents, a transactional cascade delete that reports what it removed, and
accent-insensitive search. Frontend remains out of scope.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 22 LTS (unchanged)

**Primary Dependencies**: No new runtime dependencies. Uses the NestJS 11 / Prisma 6 stack already
installed; `Prisma.Decimal` (decimal.js, already present via `@prisma/client`) carries area values

**Storage**: PostgreSQL 16 via Prisma — four new tables: `producers`, `properties`, `harvests`,
`crops`, joined to the existing schema but not to `users`

**Testing**: Jest + Supertest. **Deviation from feature 001**: this feature's integration suite runs
against the disposable Postgres rather than the in-memory Prisma fake — see
[R-008](./research.md#r-008) and Risk 3

**Target Platform**: Linux container (Docker), unchanged

**Project Type**: Web service — new feature modules inside the existing `backend/`

**Performance Goals**: First page of a 10,000-producer list under one second (SC-007). An indexed
`LIMIT/OFFSET` with a `COUNT(*)` at that scale is far inside the budget

**Constraints**: Areas are `Decimal(12,2)` and **must never be added as JavaScript numbers**
([R-001](./research.md#r-001)); cascade deletes must be atomic (FR-032); documents must not reach any
log (FR-038); harvest-year bounds are relative to the current year, so the validator computes them at
request time rather than holding a constant

**Scale/Scope**: 4 resources, 4 tables, ~14 endpoints, 2 new modules. Single-digit thousands of
producers expected in the first year

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Principle | Status | How this design satisfies it |
|---|-----------|--------|------------------------------|
| I | Code Quality (SOLID, KISS, Clean Code) | ✅ PASS | One responsibility per class. `DocumentValidator` (check digits), `AreaRule` (the invariant), `TextNormalizer` (search and crop keys), one service and one repository per resource. The area rule is a named unit, not a condition buried in a service method. |
| II | Layered Architecture | ✅ PASS | Controllers parse/delegate/map only. Services hold every rule, including the post-change area validation ([R-009](./research.md#r-009)) which *cannot* live in a DTO. Repositories are the sole Prisma callers. |
| III | Explicit API Contracts | ✅ PASS | All endpoints in [contracts/openapi.yaml](./contracts/openapi.yaml), DTOs validated by the inherited global pipe, Swagger served. README (pt-BR) updated as a task. |
| IV | Test Coverage (NON-NEGOTIABLE) | ⚠️ PASS w/ recorded interpretation | Every rule gets a unit test; every endpoint an integration test. The "no external real state" reading established in feature 001 (*state the test does not own*) is leaned on harder here — the whole integration tier now uses an owned, disposable container. Reasoning in [R-008](./research.md#r-008). |
| V | Security by Default | ✅ PASS | **No new auth code.** Every route is protected because the global `APP_GUARD` denies by default and none of these carry `@Public()`. Documents are redacted from logs (FR-038). Unknown fields rejected by the inherited `forbidNonWhitelisted`. |
| VI | Observability | ✅ PASS | Structured log per create/update/delete carrying actor, record id and outcome (FR-037), by id never by document. The existing log-leak gate is extended with document patterns. |
| VII | Mandated Technology Stack | ✅ PASS | No new dependency of any kind, so the Principle VII boundary is not even approached this time. |
| VIII | Language Policy | ✅ PASS | Code, comments, commits, logs in English; API messages, OpenAPI text and README in pt-BR. Domain terms stay Portuguese where they are proper nouns (`CPF`, `CNPJ`, the UF codes). |

### Notes on the gates

**Principle V is satisfied by inheritance, and that is the point.** The only work required to
protect fourteen new endpoints is to not write `@Public()` on them. That is
[R-007 from feature 001](../001-user-auth/research.md#r-007) paying for itself; it is worth stating
explicitly, because "we did nothing" can otherwise read as an oversight in review.

**The security posture the spec chose is broader than a gate can check.** FR-002 makes the registry
shared with no roles, and feature 001 allows open self-registration, so any member of the public can
register and then edit or delete any record — with deletes cascading. This is recorded and accepted
in the spec's Assumptions. The constitution does not forbid it (every mutating route *is*
authenticated, which is what Principle V requires), so this is not a gate failure — but it is Risk 1
below rather than something the checklist can catch.

### Post-Phase-1 re-check

Re-evaluated against the completed design ([data-model.md](./data-model.md),
[contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)): **no new
violations**. The Complexity Tracking table below stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-rural-producer-crud/
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

Additions to the existing `backend/`. Nothing in `src/auth/` or `src/users/` changes; the two touch
points are `app.module.ts` (register two modules) and the pino redact list.

```text
backend/
├── prisma/
│   ├── schema.prisma                    # + Producer, Property, Harvest, Crop
│   └── migrations/                      # + one migration
├── src/
│   ├── app.module.ts                    # + ProducersModule, PropertiesModule; redact list
│   ├── common/
│   │   ├── constants/
│   │   │   └── brazilian-states.ts      # the 27 UFs (R-011)
│   │   ├── validation/
│   │   │   ├── document.ts              # CPF/CNPJ check digits (R-002, R-003)
│   │   │   ├── is-document.validator.ts # class-validator constraint
│   │   │   ├── text-normalizer.ts       # accents + case + whitespace (R-005, R-010)
│   │   │   └── decimal.transform.ts     # number -> Prisma.Decimal, PER FIELD (R-001)
│   │   └── dto/
│   │       └── pagination.dto.ts        # page/pageSize + paged response (R-006)
│   ├── producers/
│   │   ├── producers.module.ts
│   │   ├── producers.controller.ts      # /producers, /producers/:id/properties
│   │   ├── producers.service.ts
│   │   ├── producers.repository.ts      # sole Prisma caller; maintains nameSearch
│   │   ├── dto/{create,update,query}-producer.dto.ts
│   │   └── entities/producer.entity.ts  # explicit response projection
│   └── properties/
│       ├── properties.module.ts
│       ├── properties.controller.ts     # /properties, /properties/:id/harvests
│       ├── properties.service.ts        # owns the area rule (R-009)
│       ├── properties.repository.ts
│       ├── area.rule.ts                 # the invariant, as its own unit
│       ├── harvests.controller.ts       # /harvests, /harvests/:id/crops
│       ├── harvests.service.ts
│       ├── harvests.repository.ts
│       ├── crops.controller.ts          # /crops
│       ├── crops.service.ts
│       ├── crops.repository.ts
│       ├── dto/…
│       └── entities/…
└── test/
    ├── unit/{producers,properties,common}/
    ├── integration/producers/           # real Postgres (R-008)
    ├── persistence/                     # existing tier, extended
    └── security/                        # log-leak gate extended with document patterns
```

**Structure Decision**: Two feature modules rather than four. `ProducersModule` owns the producer
resource; `PropertiesModule` owns properties, harvests and crops, because those three are one
strictly hierarchical unit that is always navigated together and always deleted together — splitting
them into three modules would produce three modules that import each other and nothing else. Each
resource still gets its own controller, service and repository inside that module, so Principle II's
chain stays visible per resource.

The area rule lives in `area.rule.ts` as a named unit rather than inside `PropertiesService`, because
it is invoked from two places (create and update) with different inputs and is the single most
important invariant in the feature.

## Risks

**Risk 1 — the registry is publicly writable, by decision.** FR-002 (shared, no roles) plus open
self-registration in feature 001 plus cascading deletes means anyone who registers an account can
erase any producer's entire history in one call. Raised during `/speckit-specify`, decided by the
user, recorded in the spec's Assumptions. **Not a blocker for building it**; it is a blocker for
exposing it beyond a trusted network. The mitigations are closing self-registration or adding roles,
both out of scope here. FR-032 and FR-034 bound the damage — never half-deleted, and the caller is
told how many records went — but nothing recovers them.

**Risk 2 — alphanumeric CNPJ.** The spec's rule is 14 numeric digits. Brazil has been rolling out an
alphanumeric CNPJ format during 2026; if it is live, this system will reject newly issued valid
CNPJs and the user will read it as a data-entry error. My information may be stale, so this needs
confirming against Receita Federal before real producers touch it. Design cost of being wrong is one
function and one fixture set ([R-003](./research.md#r-003)) — which is precisely why validation is
isolated rather than inlined into DTOs.

**Risk 3 — the integration tier now needs Docker.** [R-008](./research.md#r-008) moves this feature's
integration tests onto a real disposable Postgres, because faking cascade rollback and composite
unique constraints means faking the parts under test. The cost is that these tests cannot run on a
machine without a container runtime, and they are slower than feature 001's. Accepted: the unit
tier, where every business rule lives, stays pure and instant.

**Risk 4 — float drift is invisible until it is a support ticket.** A naive implementation of the
area rule wrongly rejects a 1000 ha + 500.11 ha farm on a 1500.11 ha property — measured, not
hypothetical ([R-001](./research.md#r-001)). It passes every hand-written test using round numbers.
The mitigation is a fixture set built from the drifting values specifically, and the design rule that
areas are converted to `Decimal` per field at the boundary and never added as numbers.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

No entries. The one interpretation recorded — what "external real state" means for tests — was
already established in feature 001 and is applied more heavily here, not newly invented. Nothing in
this design needs an exception to the constitution.
