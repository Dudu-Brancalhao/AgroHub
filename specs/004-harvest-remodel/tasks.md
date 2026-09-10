# Tasks: Shared Harvests, Crop as Junction

**Input**: Design documents from `/specs/004-harvest-remodel/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md)

**Tests**: **Included and mandatory** (Constitution IV). This feature changes shipped work, so the
tests that must keep **passing unchanged** matter as much as the ones being rewritten — Phase 5
exists for exactly that.

**Organization**: Two user stories, then a regression phase covering the two earlier features this
change reaches into.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1–US2)
- Exact file paths in every task

## Path Conventions

Restructuring inside the existing `backend/`. **One migration**, which drops and recreates `crops`
and `harvests` **only** — `producers`, `properties` and every authentication table survive
([R-001](./research.md#r-001)).

---

## Phase 1: Setup

- [X] T001 Create `backend/src/harvests/dto` — harvest handling moves out of `properties/` into its own module, because leaving it there preserves exactly the misconception this feature removes
- [X] T002 Record the pre-change baseline by running the full suite from `backend/package.json` and noting the totals in the branch notes. The last recorded run was **362 tests across 44 suites**; SC-005 requires every behaviour this feature does not intend to change to still pass, and that is only checkable against a number captured before the work starts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema change and the migration. Nothing else can begin until the shape moves.

**⚠️ CRITICAL**: This phase destroys data. Confirm nothing is in production before running the
migration — the deployment posture from feature 002 is still an open decision.

- [X] T003 Reshape `Harvest` in `backend/prisma/schema.prisma` — **remove `propertyId` and the `property` relation**, add `@unique` to `year`, keep `@@map("harvests")`. A valid year runs 1900 to next year, so the table can hold **at most 128 rows ever** ([R-004](./research.md#r-004))
- [X] T004 Reshape `Crop` in `backend/prisma/schema.prisma` — add `propertyId` with `onDelete: Cascade` and an index; change `harvestId` to **`onDelete: Restrict`**; replace the unique with **`@@unique([propertyId, harvestId, nameNormalized])`**. The two relation actions differ deliberately: a crop dies with its farm, but a shared harvest must not cascade or one call would erase a year across every farm ([R-005](./research.md#r-005))
- [X] T005 Update `Property` in `backend/prisma/schema.prisma` — remove `harvests Harvest[]`, add `crops Crop[]`. A property and a harvest are now related **only** through the crops between them
- [X] T006 Generate the migration into `backend/prisma/migrations/` and verify the emitted SQL: `DROP` touches **only** `crops` and `harvests`; `ON DELETE CASCADE` on `property_id`; `ON DELETE RESTRICT` on `harvest_id`; a unique index on `harvests.year`; a unique index on the three crop columns. A `DROP` on `producers`, `properties` or `users` means the migration was generated against the wrong baseline
- [X] T007 Create `HarvestsModule` in `backend/src/harvests/harvests.module.ts` and register it in `backend/src/app.module.ts`
- [X] T008 Update `truncate()` in `backend/test/support/create-db-test-app.ts` — crops must be truncated before harvests now that the relation restricts rather than cascades

**Checkpoint**: Schema migrated, module registered. No endpoint has moved yet.

---

## Phase 3: User Story 1 - Record a Season Once, for Everyone (Priority: P1) 🎯 MVP

**Goal**: A harvest exists once for the whole registry, belongs to nobody, and cannot be deleted out
from under the farms using it.

**Independent Test**: Record 2021 once, list harvests, see a single entry carrying no property.
Record 2021 again and get a 409. Nothing about crops needs to exist.

### Tests for User Story 1

> Write these first and confirm they fail before implementing.

- [X] T009 [P] [US1] Integration-test harvest creation and listing in `backend/test/integration-db/harvests.e2e-spec.ts` covering spec US1 §1, §3, §6 — created once and listed once; **the response body carries no property field**, which is the feature; `401` without a token
- [X] T010 [P] [US1] Integration-test year identity in `backend/test/integration-db/harvests.e2e-spec.ts` (spec US1 §2, FR-008) — a second `POST` for 2021 returns **409**, and exactly one 2021 row exists afterwards
- [X] T011 [P] [US1] Integration-test year bounds in `backend/test/integration-db/harvests.e2e-spec.ts` (spec US1 §5, FR-007) — 1899 rejected, 1900 accepted, `currentYear + 1` accepted, `currentYear + 2` rejected. **This rule is unchanged and the test must pass without alteration** — it is a regression check, not a new behaviour
- [X] T012 [P] [US1] Integration-test correcting a harvest in `backend/test/integration-db/harvests.e2e-spec.ts` (spec US1 §4, FR-009) — changing the year is visible to every property with crops in it, with no property record touched; changing it to a year that already exists returns 409
- [X] T013 [P] [US1] Integration-test the delete refusal in `backend/test/integration-db/harvests.e2e-spec.ts` (FR-010, FR-011) — deleting a harvest with crops returns **409 naming how many crops block it**; deleting one with no crops returns 200 with `{ harvests: 1 }`. **A 200 on the first case means the relation is still cascading and one request can erase a year across the whole registry**
- [X] T014 [US1] Persistence-test the constraints in `backend/test/persistence/harvest-constraints.spec.ts` — 10 concurrent inserts of year 2021 yield exactly one row and nine rejections; a direct `DELETE` of a referenced harvest is refused by the database itself, proving the service count is a message rather than the guard ([R-005](./research.md#r-005))

### Implementation for User Story 1

- [X] T015 [P] [US1] Move `CreateHarvestDto` to `backend/src/harvests/dto/create-harvest.dto.ts`, keeping the year validator that computes `1900 <= year <= currentYear + 1` **at request time** — a hardcoded upper bound is wrong from 1 January
- [X] T016 [P] [US1] Add `HarvestResponseDto` in `backend/src/harvests/dto/harvest-response.dto.ts` exposing `{ id, year, createdAt, updatedAt }` and **no property field**, with pt-BR `@ApiProperty` text matching [contracts/openapi.yaml](./contracts/openapi.yaml)
- [X] T017 [US1] Implement `HarvestsRepository` in `backend/src/harvests/harvests.repository.ts` with `create`, `findById`, `findAll` (ordered by year descending), `update`, `countCrops` and `remove` — the sole Prisma caller for harvests
- [X] T018 [US1] Implement `HarvestsService` in `backend/src/harvests/harvests.service.ts` — translate `P2002` on the year into a 409; on delete, **count referencing crops inside the transaction** and refuse with `"Não é possível excluir esta safra: existem N culturas registradas nela."` when the count is non-zero
- [X] T019 [US1] Add `GET /harvests`, `POST /harvests`, `GET /harvests/:id`, `PATCH /harvests/:id` and `DELETE /harvests/:id` to `backend/src/harvests/harvests.controller.ts` with `@ApiBearerAuth(BEARER_SCHEME)` and pt-BR Swagger text — **no `@Public()`**, which is the whole of FR-027
- [X] T020 [US1] Emit structured logs for harvest creation, update, deletion and refused deletion from `backend/src/harvests/harvests.service.ts`, recording the harvest id, the acting user and — for a refusal — how many crops blocked it

**Checkpoint**: A harvest is a shared record that cannot be destroyed while in use. This is the MVP.

---

## Phase 4: User Story 2 - Record What a Farm Planted in a Season (Priority: P2)

**Goal**: A crop names both a property and a harvest, making it the record that reconciles the two.

**Independent Test**: With one property and the 2021 harvest seeded, record soybeans and read the
crop back carrying both ids.

### Tests for User Story 2

- [X] T021 [P] [US2] Integration-test crop creation in `backend/test/integration-db/crops.e2e-spec.ts` (spec US2 §1) — the created crop carries **both `propertyId` and `harvestId`**, and `nameNormalized` is never exposed
- [X] T022 [P] [US2] Integration-test the duplicate rule in `backend/test/integration-db/crops.e2e-spec.ts` (spec US2 §2–§5, FR-013 – FR-016) — same farm + same harvest + same crop is 409; same farm + same harvest + `"SOJA"` is 409; **different farm**, same harvest, same crop is 201; same farm, **different harvest**, same crop is 201; same farm, same harvest, different crop is 201
- [X] T023 [P] [US2] Integration-test missing parents in `backend/test/integration-db/crops.e2e-spec.ts` (spec US2 §6, FR-012) — a property that does not exist returns 404 **from the path**; a harvest that does not exist returns 404 **from the body**, which is the one place this feature bends feature 002's parent-in-the-path convention ([R-003](./research.md#r-003))
- [X] T024 [P] [US2] Integration-test grouped retrieval in `backend/test/integration-db/crops.e2e-spec.ts` (spec US2 §7, FR-019) — `GET /producers/:id` returns properties whose crops are grouped by harvest year; a property with no crops returns an empty list rather than being omitted
- [X] T025 [P] [US2] Integration-test the ownership asymmetry in `backend/test/integration-db/deletion.e2e-spec.ts` (FR-017) — deleting a property removes its crops and **leaves every harvest standing**; deleting a producer removes properties and crops and leaves harvests standing
- [X] T026 [US2] Persistence-test the composite unique and both relation actions in `backend/test/persistence/registry-integrity.spec.ts` — 10 concurrent inserts of the same `(propertyId, harvestId, name)` yield one row; deleting a property cascades to its crops; deleting a referenced harvest is refused; no orphan crop can exist on either side

### Implementation for User Story 2

- [X] T027 [P] [US2] Add `harvestId` (`@IsUUID()`, required) to `backend/src/properties/dto/create-crop.dto.ts`, keeping the existing name trimming and normalisation untouched
- [X] T028 [P] [US2] Update the crop projection in `backend/src/properties/entities/property.entity.ts` to expose `propertyId` and `harvestId`, and add a `HarvestWithCropsDto` grouping shape per [contracts/openapi.yaml](./contracts/openapi.yaml). `nameNormalized` stays internal
- [X] T029 [US2] Update `CropsRepository` in `backend/src/properties/properties.repository.ts` — `create` takes both ids; `listByProperty` and `listByHarvest` replace the harvest-chained queries; the repository remains the only place `nameNormalized` is derived
- [X] T030 [US2] Update `CropsService` in `backend/src/properties/properties.service.ts` — verify the property exists (404 from the path) **and** the harvest exists (404 from the body) before inserting, and translate `P2002` on the composite unique into `"Esta cultura já está registrada para esta fazenda nesta safra."`
- [X] T031 [US2] Update `backend/src/properties/properties.controller.ts` — `POST /properties/:propertyId/crops` and `GET /properties/:propertyId/crops` replace the harvest-nested routes; add `GET /harvests/:id/crops`; keep `DELETE /crops/:id`
- [X] T032 [US2] Update `PropertiesRepository.removeWithReport` in `backend/src/properties/properties.repository.ts` — the report becomes `{ properties, crops }`; **the `harvests` key is removed**, because harvests are no longer beneath a property and reporting `harvests: 0` would imply the operation considered them ([R-008](./research.md#r-008))
- [X] T033 [US2] Update `ProducersRepository.findByIdDetailed` in `backend/src/producers/producers.repository.ts` — the nested include becomes properties → crops → harvest. The old include walked property → harvest → crop, and that path no longer exists
- [X] T034 [US2] Update `ProducersService` in `backend/src/producers/producers.service.ts` — group each property's crops by harvest year in the service ([R-006](./research.md#r-006)), and change the delete report to `{ producers, properties, crops }`
- [X] T035 [US2] Emit structured logs for crop creation and deletion from `backend/src/properties/properties.service.ts`, carrying the crop id, the property id, the harvest id and the acting user

**Checkpoint**: The junction works end to end, and ownership is asymmetric in the way the model intends.

---

## Phase 5: Regression & Earlier-Feature Alignment

**Purpose**: Bring features 002 and 003 into line, and prove that everything this change did **not**
intend to touch still behaves identically. Enumerated from [R-009](./research.md#r-009) rather than
discovered from failing tests.

- [ ] T036 [P] Update `specs/002-rural-producer-crud/spec.md` — the Harvest entity no longer belongs to a property, US3 scenarios reference shared harvests, and the note explaining why `(propertyId, year)` was deliberately left un-unique is replaced with the reason it is now globally unique
- [X] T037 [P] Update `specs/002-rural-producer-crud/contracts/openapi.yaml` — harvest and crop routes and payload shapes per [contracts/openapi.yaml](./contracts/openapi.yaml), and remove `harvests` from the producer and property deletion reports
- [X] T038 Rewrite `backend/test/integration-db/harvests-crops.e2e-spec.ts` — split into the new `harvests.e2e-spec.ts` and `crops.e2e-spec.ts`, and **invert the safra/safrinha test**: "accepts two harvests in the same year" becomes an assertion that the second is rejected with 409, with a comment recording that this capability was removed deliberately ([R-011](./research.md#r-011))
- [X] T039 Update `backend/test/integration-db/properties.e2e-spec.ts` and `backend/test/integration-db/producers.e2e-spec.ts` for the nested response shape — mechanical changes only; **every assertion about areas, documents and paging must survive untouched**, and it is worth noticing if one does not
- [X] T040 Update `backend/test/security/openapi-contract.spec.ts` — assert the new harvest and crop routes exist, none carries `security: []`, and the deletion report schema no longer lists `harvests` for producers or properties
- [X] T041 [P] Update the setup blocks of `backend/test/integration-db/dashboard.e2e-spec.ts` and `backend/test/integration-db/log-leak-registry.e2e-spec.ts` — create harvests globally and crops against a property. **Setup only: no assertion in either file changes**
- [X] T042 Rebuild the scale seeding in `backend/test/support/dashboard-fixtures.ts` — `seedAtScale` currently creates 50,000 harvests using five distinct years, which a unique year caps at **five**. Seed a handful of harvests and spread 150,000 crops across property-harvest-name combinations; `10,000 properties x 5 harvests x 10 names = 500,000` possible, so SC-006 stays reachable ([R-007](./research.md#r-007))
- [X] T043 Run `backend/test/integration-db/dashboard-by-crop.e2e-spec.ts` after only its setup has been updated, and confirm **every assertion passes unchanged**. This is the evidence for [R-007](./research.md#r-007): the crop chart still counts plantings, soja still counts twice for a farm that planted it in two seasons, and the chart still deliberately fails to reconcile with the farm count
- [X] T044 Verify no dashboard source file changed by diffing `backend/src/dashboard/` against the branch point — the crop breakdown reads neither the harvest nor the property, so a change there means something was altered that did not need to be

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T045 [P] Update `backend/README.md` (**pt-BR**) — a harvest is shared and recorded once, a crop names both the farm and the harvest, a harvest cannot be deleted while in use, and the deletion reports no longer list harvests. Record that safra and safrinha are no longer representable, under the existing limitations section
- [X] T046 Run the full gate from `backend/package.json` — `lint`, `typecheck`, `test:unit`, `test:integration`, `test:integration-db`, `test:persistence`, `test:security` — and compare the totals against the T002 baseline. A drop in passing tests that is not explained by a rewritten file is a regression (SC-005)
- [ ] T047 Execute all 17 manual steps in [quickstart.md](./quickstart.md), especially **step 8** (a harvest in use must refuse deletion), **step 12** (soja must count **2**, not 1), **step 14** (documents, uniqueness and the area rule untouched) and **step 16** (the accepted safra/safrinha loss)
- [X] T048 Confirm the migration destroyed only what was intended by querying the live database via `docker-compose.yml`: `producers`, `properties` and `users` still hold their rows; `crops` and `harvests` are empty and in the new shape ([R-001](./research.md#r-001))

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup — **blocks everything**, because nothing compiles against the old shape
- **US1 (Phase 3)**: needs Foundational
- **US2 (Phase 4)**: needs US1 — a crop cannot reference a harvest that has no endpoint to create it
- **Regression (Phase 5)**: needs US1 and US2; T043 and T044 need Phase 4 complete to mean anything
- **Polish (Phase 6)**: needs everything

### Note on story independence, and why this feature has less of it

The two stories are genuinely separable in substance — a shared harvest is useful before any crop
references it. But this is a **restructure of shipped work**, so the intermediate state does not
compile: the moment the schema changes in Phase 2, every file touching the old harvest–crop
relationship is broken until Phase 4 finishes.

That is unavoidable and worth naming. Unlike the previous three features, **there is no shippable
increment before Phase 4 completes** — Phase 3 is an MVP in the sense of being demonstrable, not in
the sense of being releasable.

### Within Each Phase

- Tests written first and confirmed failing
- Schema → repository → service → controller → logging
- Two tasks touching the same file are never both `[P]`. The shared files are
  `backend/prisma/schema.prisma` (T003–T005),
  `backend/src/properties/properties.repository.ts` (T029, T032),
  `backend/src/properties/properties.service.ts` (T030, T035),
  `backend/src/properties/properties.controller.ts` (T031),
  `backend/src/producers/producers.repository.ts` (T033) and
  `backend/test/integration-db/crops.e2e-spec.ts` (T021–T024) — each strictly sequential

### Parallel Opportunities

- Phase 2: T003–T006 strictly sequential (one file, one migration); T007 and T008 parallel after
- US1: T009–T013 are one file and therefore sequential in practice; T015 and T016 parallel
- US2: T021–T024 share a file; T027 and T028 parallel
- Phase 5: T036, T037 and T041 parallel; T042 before T043

---

## Parallel Example: User Story 2

```bash
# The two DTO/entity changes are independent files:
Task: "Add harvestId to backend/src/properties/dto/create-crop.dto.ts"
Task: "Update the crop projection in backend/src/properties/entities/property.entity.ts"

# The earlier-feature spec updates are independent of all code:
Task: "Update specs/002-rural-producer-crud/spec.md"
Task: "Update specs/002-rural-producer-crud/contracts/openapi.yaml"
```

---

## Implementation Strategy

### There is no partial release here

The usual "ship US1, then US2" does not apply. Phase 2 changes the schema, and from that moment the
codebase does not compile until Phase 4 lands. Plan the work as **one unit through T035**, with
Phase 3 as an internal checkpoint rather than a release candidate.

### Incremental Delivery

| Increment | Tasks | State |
|-----------|-------|-------|
| Setup + Foundational | T001–T008 | Schema moved; **build broken by design** |
| + US1 | T009–T020 | Harvests work; crops still broken |
| + US2 | T021–T035 | **First point the system runs again** |
| + Regression | T036–T044 | Earlier features aligned; regressions proven absent |
| + Polish | T045–T048 | pt-BR README, full gate, quickstart, migration audit |

### Parallel Team Strategy

Poor fit. The schema change is a single choke point and the resulting breakage spans both modules,
so two people would spend more time coordinating than the work saves. One developer through T035,
then Phase 5 splits cleanly — spec and contract updates, dashboard fixtures, and the test rewrites
are three independent tracks.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task
- Every task names its file path; ids run T001–T048 with no gaps
- Verify tests fail before implementing
- Commit per task or logical group, messages in English (Constitution VIII)
- Five tasks carry weight out of proportion to their size:
  - **T004** — `Restrict` on `harvestId`; leave it cascading and one call erases a year registry-wide
  - **T006** — verifying the migration drops only two tables; the wrong baseline destroys producers
  - **T013** — the delete refusal, the single most consequential new behaviour
  - **T042** — the scale fixture, which otherwise fails in a way that looks like a product bug
  - **T043** — the proof that the dashboard genuinely did not change
