# Tasks: Dashboard Summary (Backend)

**Input**: Design documents from `/specs/003-dashboard-api/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md)

**Tests**: **Included and mandatory.** The template treats test tasks as optional; Constitution
Principle IV does not. Integration tests use the `integration-db` tier against real Postgres — the
behaviour under test *is* the aggregation, so a fake would be testing a reimplementation of the
thing that could be wrong ([R-010](./research.md#r-010)).

**Organization**: Grouped by user story. All four stories extend **one endpoint**, each adding a
section to its response, so each is a complete and independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1–US4)
- Exact file paths in every task

## Path Conventions

Lands on the existing `backend/` from features 001 and 002. **No migration, no schema change, no
new dependency.** The only file touched outside `src/dashboard/` is `app.module.ts`.

---

## Phase 1: Setup

**Purpose**: Directories and fixtures. Nearly nothing to do — the project, tooling, test tiers,
Docker setup and CI gate all already exist.

- [X] T001 Create `backend/src/dashboard/dto` and `backend/test/unit/dashboard`
- [X] T002 [P] Add `backend/test/support/dashboard-fixtures.ts` exporting the worked-example dataset from [data-model.md](./data-model.md#worked-example) — four properties (MG 1000.11/600/300, MG 200/100/50, SP 500.36/500.36/0, BA 25/0/0) whose expected results are known: 4 farms, `"1725.47"` hectares, arable `"1200.36"`, vegetation `"350.00"`, unclassified `"175.11"`. The decimals are chosen to drift under naive floating-point addition
- [X] T003 [P] Add a scale-seeding helper to `backend/test/support/dashboard-fixtures.ts` producing 10,000 properties, 50,000 harvests and 150,000 crops via `createMany`, for the SC-002 benchmark in T038

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The response shape, the two pure helpers every breakdown uses, and the transaction
boundary.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Define the response DTOs in `backend/src/dashboard/dto/dashboard-response.dto.ts` — `CategoryDto` (`key: string`, `label: string`, `value: string | number`), `BreakdownDto` (`unit: 'hectares' | 'count'`, `categories: CategoryDto[]`), `TotalsDto` (`farms: number`, `hectares: string`), `DashboardSummaryDto` (`totals`, `byState`, `byCrop`, `byLandUse`), with pt-BR `@ApiProperty` text matching [contracts/openapi.yaml](./contracts/openapi.yaml)
- [X] T005 [P] Implement `sumOrZero` in `backend/src/dashboard/decimal.util.ts` coalescing a possibly-`null` Prisma `_sum` result to `Prisma.Decimal(0)` — **measured behaviour: `_sum` returns `null`, not `0`, on an empty table** ([R-002](./research.md#r-002)), so reading it directly makes the first request against a fresh installation throw
- [X] T006 [P] Unit-test `sumOrZero` in `backend/test/unit/dashboard/decimal.util.spec.ts` — `null` becomes `Decimal(0)`; a real Decimal passes through unchanged; the result always formats to two decimal places
- [X] T007 Implement `buildBreakdown` in `backend/src/dashboard/breakdown.builder.ts` taking raw `{key, label, value}` entries and a unit, then **filtering out every category whose value is zero** (FR-022) and **sorting by value descending, then key ascending** (FR-024 ordering, SC-007)
- [X] T008 [P] Unit-test the builder in `backend/test/unit/dashboard/breakdown.builder.spec.ts` — zero-valued categories dropped; an all-zero input yields an empty array, not an array of zeroes; ties broken by key so two runs over the same input are identical; Decimal and number values both sort correctly; an empty input yields an empty array
- [X] T009 Implement `DashboardRepository` in `backend/src/dashboard/dashboard.repository.ts` exposing one method that opens **`prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })`** and returns the raw aggregates. **Read Committed — the PostgreSQL default — gives each *statement* a fresh snapshot, so independent queries see different points in time and the breakdowns stop reconciling with the totals** ([R-001](./research.md#r-001)). This is the only Prisma caller in the feature
- [X] T010 Create `DashboardModule` in `backend/src/dashboard/dashboard.module.ts` and register it in `backend/src/app.module.ts` — one line, and the only file this feature touches outside its own directory

**Checkpoint**: Response shape defined, both pure helpers tested, transaction boundary in place. No
endpoint yet.

---

## Phase 3: User Story 1 - See the Headline Totals (Priority: P1) 🎯 MVP

**Goal**: `GET /dashboard` returns how many farms are registered and how many hectares they cover.

**Independent Test**: With the T002 fixture loaded, the endpoint reports 4 farms and `"1725.47"`
hectares. Against an empty registry it reports 0 and `"0.00"` and succeeds. No breakdown needs to
exist.

### Tests for User Story 1

> Write these first and confirm they fail before implementing.

- [X] T011 [P] [US1] Integration-test the totals in `backend/test/integration-db/dashboard-totals.e2e-spec.ts` covering spec US1 §1–§6 — 4 farms and `"1725.47"` from the T002 fixture; **an empty registry returning `0` and `"0.00"` with status 200**; producers with no properties still yielding zeroes; `401` with no token, proving the inherited global guard covers this route; totals dropping after a property is deleted
- [X] T012 [P] [US1] Integration-test decimal exactness in `backend/test/integration-db/dashboard-totals.e2e-spec.ts` — the fixture totals `1000.11 + 200 + 500.36 + 25` must serialise as exactly `"1725.47"`, never `"1725.4700000000003"`, which is what appears if the sum is done in JavaScript numbers rather than Decimal

### Implementation for User Story 1

- [X] T013 [US1] Add the totals aggregate to `backend/src/dashboard/dashboard.repository.ts` — `property.aggregate({ _count: true, _sum: { totalArea, arableArea, vegetationArea } })` inside the T009 transaction. All three sums are fetched here, because US4 needs the other two and re-querying would break the single-snapshot guarantee
- [X] T014 [US1] Implement `DashboardService.getSummary` in `backend/src/dashboard/dashboard.service.ts` assembling `totals` through `sumOrZero`, serialising hectares with `toFixed(2)` as a **string** — `1725.47` parsed as a JSON number is not exactly 1725.47, and any client arithmetic reintroduces the drift the server just avoided
- [X] T015 [US1] Add `GET /dashboard` to `backend/src/dashboard/dashboard.controller.ts` with `@ApiBearerAuth(BEARER_SCHEME)` and Swagger responses matching the contract — **no `@Public()`**, which is the whole of FR-001
- [X] T016 [US1] Log a failure to build the dashboard from `backend/src/dashboard/dashboard.service.ts` with enough context to diagnose it (FR-026), and **do not** log successful reads — a read that changes nothing, called on a timer by a browser, would bury the registration and deletion events that matter (plan, Note on Principle VI)

**Checkpoint**: The endpoint exists and answers the two headline questions. This is the MVP.

---

## Phase 4: User Story 2 - See How Farms Are Spread Across States (Priority: P2)

**Goal**: Add `byState` — hectares per federative unit, ready to plot.

**Independent Test**: With the T002 fixture, `byState` returns exactly three categories — MG
`"1200.11"`, SP `"500.36"`, BA `"25.00"` — which sum to the hectare total.

### Tests for User Story 2

- [X] T017 [P] [US2] Integration-test the state breakdown in `backend/test/integration-db/dashboard-by-state.e2e-spec.ts` covering spec US2 §1–§5 — three categories with `unit: "hectares"` and the values above; **the 24 federative units with no properties absent rather than present with zero**; an empty registry returning an empty `categories` array with status 200; ordering largest-first
- [X] T018 [P] [US2] Integration-test the reconciliation in `backend/test/integration-db/dashboard-by-state.e2e-spec.ts` (FR-011) — the state categories sum **exactly** to `totals.hectares`, asserted in Decimal rather than by parsing floats, since parsing to compare would reintroduce the very error being checked for

### Implementation for User Story 2

- [X] T019 [US2] Add `property.groupBy({ by: ['state'], _sum: { totalArea: true } })` to `backend/src/dashboard/dashboard.repository.ts`, inside the same transaction as T013
- [X] T020 [US2] Assemble `byState` in `backend/src/dashboard/dashboard.service.ts` via the T007 builder with `unit: 'hectares'`, using the UF code as both `key` and `label` ([R-012](./research.md#r-012)), and normalising the state on read so casing or padding could never split one unit into two categories (FR-010)
- [X] T021 [US2] Document `byState` in the controller Swagger text in `backend/src/dashboard/dashboard.controller.ts`, stating that it is measured in hectares and reconciles with `totals.hectares`

**Checkpoint**: Totals plus a state breakdown that provably agrees with them.

---

## Phase 5: User Story 3 - See What Is Being Planted (Priority: P3)

**Goal**: Add `byCrop` — a count of crop records per crop, with spelling variants collapsed.

**Independent Test**: One property recording `Soja` and `Milho` in a 2021 harvest and `SOJA` in a
2022 harvest yields two categories: `soja` with value 2 labelled `"Soja"`, and `milho` with value 1.
A second property with no harvest is absent from the breakdown while still counting in the totals.

### Tests for User Story 3

- [X] T022 [P] [US3] Unit-test the label rule in `backend/test/unit/dashboard/crop-label.resolver.spec.ts` — given `Soja` x2 and `SOJA` x1, the label is **`"Soja"`**, not `"SOJA"`. **This is the case that catches the tempting one-line implementation**: Prisma's `_min: { name: true }` returns `"SOJA"` because uppercase sorts before lowercase in ASCII, surfacing the spelling used once out of three ([R-003](./research.md#r-003)). Also cover an exact tie resolving alphabetically, accent variants (`Café`/`Cafe`) grouping under one key, and empty input
- [X] T023 [P] [US3] Integration-test the crop breakdown in `backend/test/integration-db/dashboard-by-crop.e2e-spec.ts` covering spec US3 §1–§7 — two crops in one harvest producing two categories (FR-014); the same crop in two harvests counting **twice** (FR-017); `Soja`/`soja`/`SOJA` collapsing to one category while `Soja` and `Soya` stay two; `unit: "count"`; an empty registry returning an empty array
- [X] T024 [P] [US3] Integration-test the exclusion rule in `backend/test/integration-db/dashboard-by-crop.e2e-spec.ts` (FR-013) — a property with no harvest, and a harvest with no crop, contribute **nothing** to `byCrop` while counting **in full** towards `totals.farms` and `totals.hectares`. Both halves asserted in one response, since the requirement is that they hold simultaneously
- [X] T025 [P] [US3] Integration-test the deliberate non-reconciliation in `backend/test/integration-db/dashboard-by-crop.e2e-spec.ts` (FR-023) — with 3 farms where one recorded 4 crops, the crop categories total 4 and **do not** equal the farm count. A future change that made them match would mean crop records were being dropped

### Implementation for User Story 3

- [X] T026 [P] [US3] Implement `resolveCropLabel` in `backend/src/dashboard/crop-label.resolver.ts` reducing `(nameNormalized, name, count)` rows into one entry per normalised key: sum the counts, and pick as label **the spelling with the highest count, ties broken alphabetically**
- [X] T027 [US3] Add `crop.groupBy({ by: ['nameNormalized', 'name'], _count: { _all: true } })` to `backend/src/dashboard/dashboard.repository.ts`, inside the same transaction. Grouping on **both** columns is what lets T026 pick a sensible label; grouping on the key alone forces `_min`
- [X] T028 [US3] Assemble `byCrop` in `backend/src/dashboard/dashboard.service.ts` via T026 and the T007 builder with `unit: 'count'`, using the normalised name as `key` and the resolved spelling as `label`
- [X] T029 [US3] Document `byCrop` in the controller Swagger text in `backend/src/dashboard/dashboard.controller.ts`, **stating plainly that it counts plantings and does not reconcile with the farm count** (FR-023) — the mitigation for this is documentation, not code, and someone will otherwise report it as a bug

**Checkpoint**: All three of the registry's questions answered — how big, where, and what.

---

## Phase 6: User Story 4 - See How the Land Is Used (Priority: P4)

**Goal**: Add `byLandUse` — hectares split between arable, vegetation and any unclassified remainder.

**Independent Test**: With the T002 fixture, `byLandUse` returns arable `"1200.36"`, vegetation
`"350.00"` and unclassified `"175.11"`, which sum exactly to `"1725.47"`.

### Tests for User Story 4

- [X] T030 [P] [US4] Integration-test the land-use breakdown in `backend/test/integration-db/dashboard-by-land-use.e2e-spec.ts` covering spec US4 §1–§5 — the three categories above; their exact sum equalling `totals.hectares`; an empty registry returning an empty array; a property with zero arable and zero vegetation contributing its whole area to unclassified
- [X] T031 [P] [US4] Integration-test the zero-omission rule in `backend/test/integration-db/dashboard-by-land-use.e2e-spec.ts` (FR-022, SC-011) — a registry where **every** property fully classifies its land returns only the categories that are non-zero, with `unclassified` **absent entirely** rather than present with `"0.00"`. Cover the case where vegetation is also zero, leaving a single-category breakdown

### Implementation for User Story 4

- [X] T032 [US4] Assemble `byLandUse` in `backend/src/dashboard/dashboard.service.ts` from the sums already fetched in T013 — keys `arable`, `vegetation`, `unclassified` with the pt-BR labels `Área agricultável`, `Vegetação` and `Área não classificada`, computing the remainder as `sum(total) − sum(arable) − sum(vegetation)` **in Decimal**, then passing all three through the T007 builder so the zero filter applies uniformly
- [X] T033 [US4] Assert in `backend/src/dashboard/dashboard.service.ts` that the unclassified remainder is **not negative**, failing with a logged error rather than emitting a negative slice. Feature 002 guarantees `arable + vegetation <= total` per property, so a negative value here means the registry was corrupted outside the API — and the dashboard is the only place that would notice ([R-011](./research.md#r-011))
- [X] T034 [US4] Document `byLandUse` in the controller Swagger text in `backend/src/dashboard/dashboard.controller.ts`, noting that it reconciles with `totals.hectares` and that `unclassified` appears only when there is a remainder

**Checkpoint**: All four sections of the dashboard complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T035 [P] Extend `backend/README.md` (**pt-BR**) with a dashboard section explaining what each figure means, that `byState` and `byLandUse` reconcile with the hectare total while `byCrop` deliberately does not, and the limitations from [quickstart.md](./quickstart.md#known-limitations) (Constitution III, SC-010)
- [X] T036 [P] Extend `backend/test/security/openapi-contract.spec.ts` to assert `/api/dashboard` exists, requires a bearer token, documents `200`, `401` and `500`, and that its response schema exposes no producer field
- [X] T037 [P] Add `backend/test/integration-db/dashboard-no-personal-data.e2e-spec.ts` (FR-027, SC-009) — seed producers with known CPF/CNPJ values, request the dashboard, and assert the serialised response contains neither those documents nor any 11- or 14-digit run
- [X] T038 Benchmark the dashboard in `backend/test/integration-db/dashboard-performance.e2e-spec.ts` using the T003 seed helper and report the elapsed time against the SC-002 budget of 2 s. **Measured at ~35 ms during planning** ([R-004](./research.md#r-004)); assert generously (under 2 s) so the test checks for structural regression rather than machine speed
- [X] T039 Execute all 18 manual steps in [quickstart.md](./quickstart.md), especially **step 2** (an empty registry must not 500), **step 5** (`match: true`), **step 8** (unclassified disappears at zero) and **step 10** (`label: "Soja"`, not `"SOJA"`)
- [X] T040 Run the full gate from `backend/package.json` — `lint`, `typecheck`, `test:unit`, `test:integration`, `test:integration-db`, `test:persistence`, `test:security` — and confirm every rule has a unit test and the endpoint has integration tests (Constitution IV)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup — **blocks every user story**
- **US1 (Phase 3)**: needs Foundational. Creates the endpoint
- **US2 (Phase 4)**: needs US1 — adds a section to the response US1 created
- **US3 (Phase 5)**: needs US1 for the endpoint; independent of US2
- **US4 (Phase 6)**: needs US1, and specifically the sums fetched in T013
- **Polish (Phase 7)**: needs the stories you intend to ship

### Note on story independence

Unlike the previous two features, these four stories are **genuinely independent in substance** —
they read different columns and answer different questions. What couples them is that all four
sections live in **one endpoint and one transaction**, which FR-024 requires: separate endpoints
would mean separate snapshots and the totals could disagree with the breakdowns.

So US1 must land first because it creates the endpoint, but US2, US3 and US4 can then be built in
any order, or in parallel by different people, each adding its own section. That is a real
difference from features 001 and 002, where the delivery order was forced by the data hierarchy.

### Within Each User Story

- Tests written first and confirmed failing
- Repository query → service assembly → Swagger documentation
- Two tasks touching the same file are never both `[P]`. The shared files are
  `backend/src/dashboard/dashboard.repository.ts` (T009, T013, T019, T027),
  `backend/src/dashboard/dashboard.service.ts` (T014, T016, T020, T028, T032, T033) and
  `backend/src/dashboard/dashboard.controller.ts` (T015, T021, T029, T034) — each strictly
  sequential

### Parallel Opportunities

- Setup: T002 and T003 in parallel
- Foundational: T005+T006 and T007+T008 are two independent pairs
- Every story's test tasks are parallel with each other
- **US2, US3 and US4 are parallel with each other once US1 lands**, subject to the shared-file list
  above

---

## Parallel Example: User Story 3

```bash
# Write all US3 tests together (they must fail first):
Task: "Unit-test the crop label rule in backend/test/unit/dashboard/crop-label.resolver.spec.ts"
Task: "Integration-test the crop breakdown in backend/test/integration-db/dashboard-by-crop.e2e-spec.ts"
Task: "Integration-test the exclusion rule in backend/test/integration-db/dashboard-by-crop.e2e-spec.ts"
Task: "Integration-test the deliberate non-reconciliation in backend/test/integration-db/dashboard-by-crop.e2e-spec.ts"

# The resolver is a pure function and can be written alongside the repository query:
Task: "Implement resolveCropLabel in backend/src/dashboard/crop-label.resolver.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1
4. **Stop and validate**: quickstart steps 1–4 pass
5. Demo: the endpoint answers "how many farms, how many hectares" and survives an empty registry

MVP is T001–T016 (16 tasks). The smallest MVP of the three features so far, because everything
underneath it — auth, error envelope, logging, the registry itself — already exists.

### Incremental Delivery

| Increment | Tasks | Delivers |
|-----------|-------|----------|
| Setup + Foundational | T001–T010 | Response shape, both pure helpers, transaction boundary |
| + US1 | T011–T016 | **MVP** — the endpoint, totals, empty-registry safety |
| + US2 | T017–T021 | Hectares by state, reconciling with the total |
| + US3 | T022–T029 | Crop distribution with variants collapsed |
| + US4 | T030–T034 | Land use, with the remainder closing the sum |
| + Polish | T035–T040 | pt-BR README, contract gate, personal-data gate, benchmark |

### Parallel Team Strategy

One developer takes Setup + Foundational + US1 to create the endpoint. After that, three developers
can take US2, US3 and US4 simultaneously — each writes one repository query and one service section
— converging only on `dashboard.service.ts` and `dashboard.controller.ts`, which the shared-file
list above identifies as the collision points.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task
- Every task names its file path; ids run T001–T040 with no gaps
- Verify tests fail before implementing
- Commit per task or logical group, messages in English (Constitution VIII)
- Four small tasks carry weight out of proportion to their size, each pinned by a measurement taken
  during planning: **T005** (`_sum` returns `null`, so an empty registry 500s), **T009**
  (Read Committed breaks reconciliation invisibly), **T022** (`_min` picks the least-used spelling)
  and **T033** (a negative slice means corrupted data, and this is the only place that would notice)
