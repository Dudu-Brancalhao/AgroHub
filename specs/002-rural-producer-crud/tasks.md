# Tasks: Rural Producer Registry (CRUD)

**Input**: Design documents from `/specs/002-rural-producer-crud/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md)

**Tests**: **Included and mandatory.** The template treats test tasks as optional; Constitution
Principle IV does not. Per [R-008](./research.md#r-008) this feature's integration suite runs against
a **real disposable Postgres**, not feature 001's in-memory fake — faking cascade rollback and
composite unique constraints would mean faking the parts under test.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1–US5)
- Exact file paths in every task

## Path Conventions

This feature lands on the **existing** `backend/` from feature 001. Nothing in `src/auth/` or
`src/users/` changes. All paths are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Directories and the test harness. Far smaller than feature 001 — the project, tooling,
Docker setup and CI gate already exist.

- [X] T001 Create the module skeleton directories `backend/src/producers/{dto,entities}`, `backend/src/properties/{dto,entities}`, `backend/src/common/constants`, and test directories `backend/test/unit/{producers,properties}`, `backend/test/integration-db`
- [X] T002 Add a fourth Jest project `integration-db` in `backend/jest.config.ts` matching `<rootDir>/test/integration-db/**/*.e2e-spec.ts`, plus a `test:integration-db` script in `backend/package.json` — kept separate from `integration` so feature 001's fast, database-free suite keeps running on machines without Docker
- [X] T003 [P] Add `backend/test/support/create-db-test-app.ts` booting the real `AppModule` against the disposable Postgres (`PERSISTENCE_DATABASE_URL`), applying the same global prefix, `ValidationPipe` and `AllExceptionsFilter` as `create-test-app.ts`, and exposing a `truncate()` that clears `crops`, `harvests`, `properties`, `producers` between tests
- [X] T004 [P] Add `backend/test/support/document-fixtures.ts` exporting the verified sets from [R-002](./research.md#r-002): `VALID_CPFS` (`52998224725`, `39053344705`), `VALID_CNPJS` (`11222333000181`), `REPEATED_DIGIT` (`11111111111`, `00000000000`, `11111111111111`), `BAD_CHECK_DIGIT` (`52998224724`, `12345678900`, `11222333000182`), `WRONG_LENGTH` (`1234567890`, `123456789012345`)
- [X] T005 [P] Add `backend/test/support/area-fixtures.ts` exporting the measured float-drift cases from [R-001](./research.md#r-001) — `{total: 1500.11, arable: 1000, vegetation: 500.11}`, `{total: 0.06, arable: 0.01, vegetation: 0.05}`, `{total: 1500.36, arable: 1000, vegetation: 500.36}` — each of which a naive `a + b <= total` check wrongly rejects
- [X] T006 [P] Add an `npm run test:db:migrate` script in `backend/package.json` that runs `prisma migrate deploy` against `PERSISTENCE_DATABASE_URL`, so the test database can be prepared in one command

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared utilities and module wiring that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Note on the schema**: all four tables land in **one** migration even though they serve different
stories. They form a single referential unit — the cascade chain cannot be introduced piecemeal —
and splitting it would produce four migrations that are meaningless individually.

### Schema

- [X] T007 Add the `DocumentType` enum (`CPF`, `CNPJ`) and the `Producer` model to `backend/prisma/schema.prisma` per [data-model.md](./data-model.md) — `document` **UNIQUE**, `name` `@db.VarChar(200)`, `nameSearch` mapped to `name_search` and indexed, `@@map("producers")`
- [X] T008 Add the `Property` model to `backend/prisma/schema.prisma` — `producerId` FK with **`onDelete: Cascade`** and an index, `farmName` `@db.VarChar(200)`, `city` `@db.VarChar(120)`, `state` `@db.VarChar(2)`, and `totalArea`/`arableArea`/`vegetationArea` as **`@db.Decimal(12, 2)`**, `@@map("properties")`
- [X] T009 Add the `Harvest` and `Crop` models to `backend/prisma/schema.prisma` — both FKs with **`onDelete: Cascade`**; `Crop` carries `name` `@db.VarChar(120)` plus `nameNormalized` with **`@@unique([harvestId, nameNormalized])`**, which *is* FR-025; deliberately **no** unique on `(propertyId, year)`, since safra/safrinha means two harvests in one year is real
- [X] T010 Generate the migration into `backend/prisma/migrations/` and verify the emitted SQL contains `ON DELETE CASCADE` on all three foreign keys and `numeric(12,2)` on the three area columns

### Shared utilities

- [X] T011 [P] Add the frozen 27-entry federative-unit list to `backend/src/common/constants/brazilian-states.ts` as a `readonly` tuple with a derived union type (FR-017, [R-011](./research.md#r-011))
- [X] T012 [P] Implement `backend/src/common/validation/text-normalizer.ts` with `normalizeForSearch(value)` — trim, collapse inner whitespace, lowercase, strip diacritics via `normalize('NFD')` and a combining-marks replace. Used by both `nameSearch` (FR-027) and `nameNormalized` (FR-025)
- [X] T013 [P] Unit-test the normalizer in `backend/test/unit/common/text-normalizer.spec.ts` — `"José Antônio"` → `"jose antonio"`, `"  Milho  safrinha "` → `"milho safrinha"`, `"SOJA"` → `"soja"`, and idempotency (normalizing twice changes nothing)
- [X] T014 [P] Implement `backend/src/common/validation/decimal.transform.ts` exporting a `@Transform` that converts **one** field to `Prisma.Decimal` — document in the file that callers must convert per field and never `new Decimal(a + b)`, because that inherits the drift ([R-001](./research.md#r-001))
- [X] T015 [P] Unit-test the decimal transform in `backend/test/unit/common/decimal.transform.spec.ts` — a JSON number with 2 decimals converts exactly; assert `new Decimal(1000).plus(new Decimal(500.11)).equals(new Decimal(1500.11))` while `1000 + 500.11 > 1500.11` is `true` in plain JS, pinning why the transform exists
- [X] T016 [P] Add `backend/src/common/dto/pagination.dto.ts` with `page` (int, min 1, default 1) and `pageSize` (int, min 1, **max 100**, default 20), plus a generic paged-response shape `{ data, total, page, pageSize }` (FR-026, [R-006](./research.md#r-006))

### Wiring

- [X] T017 Create empty `ProducersModule` in `backend/src/producers/producers.module.ts` and `PropertiesModule` in `backend/src/properties/properties.module.ts` so registration happens once, before the stories fill them
- [X] T018 Register both modules in `backend/src/app.module.ts` and extend the `nestjs-pino` `redact` list with `document`, `*.document`, `cpf`, `cnpj`, `nameSearch` (FR-038, [R-012](./research.md#r-012))
- [X] T019 Extend `backend/test/security/log-leak.spec.ts` with document patterns — the literal fixture CPFs/CNPJs and `/\b\d{11}\b|\b\d{14}\b/` — so the existing gate covers this feature's personal data (SC-009)

**Checkpoint**: Schema migrated, utilities tested, modules registered and redaction extended. No
endpoint exists yet.

---

## Phase 3: User Story 1 - Register a Rural Producer (Priority: P1) 🎯 MVP

**Goal**: A signed-in user records a producer with a genuinely valid, unused CPF or CNPJ.

**Independent Test**: `POST /producers` with a valid unused document returns 201; repeating it
returns 409; `111.111.111-11` returns 400.

### Tests for User Story 1

> Write these first and confirm they fail before implementing.

- [X] T020 [P] [US1] Unit-test document validation in `backend/test/unit/common/document.spec.ts` using every set from T004 — valid CPFs and CNPJs accepted punctuated and unpunctuated; **`11111111111` rejected**, which is the case that *passes* the check-digit arithmetic and is caught only by the explicit repeated-digit rule (FR-006); bad check digits, wrong lengths, empty and non-numeric all rejected
- [X] T021 [P] [US1] Unit-test `CreateProducerDto` in `backend/test/unit/producers/create-producer.dto.spec.ts` — document required and validated, name required and non-empty after trimming, `name` over 200 chars rejected, unknown fields rejected, and both field errors reported at once (FR-035)
- [X] T022 [P] [US1] Integration-test `POST /producers` in `backend/test/integration-db/producers-create.e2e-spec.ts` covering spec US1 §1–§5 — 201 with `documentType: "CPF"` and `document` stored digits-only; 409 for the same document punctuated differently; 400 for each invalid document; 201 for a valid CNPJ with `documentType: "CNPJ"`; exact response key set asserted so `nameSearch` can never leak
- [X] T023 [P] [US1] Integration-test `GET /producers/:id` in `backend/test/integration-db/producers-read.e2e-spec.ts` — 200 for an existing producer, **401 with no token** (proving the inherited global guard covers this route with no new auth code), 404 for an unknown id
- [X] T024 [US1] Persistence-test concurrent duplicate documents in `backend/test/persistence/producer-concurrency.spec.ts` — fire 10 simultaneous inserts of one document and assert exactly one row and 9 `P2002` rejections (FR-008, SC-004)

### Implementation for User Story 1

- [X] T025 [P] [US1] Implement `backend/src/common/validation/document.ts` with `normalizeDocument`, `isValidCpf`, `isValidCnpj`, `detectDocumentType` — check digits computed, and a repeated-digit guard **before** the checksum. Keep every rule in this one file so the alphanumeric-CNPJ change of [R-003](./research.md#r-003) touches one place
- [X] T026 [US1] Implement the `@IsDocument()` constraint in `backend/src/common/validation/is-document.validator.ts` wrapping T025, with the pt-BR message `"Informe um CPF ou CNPJ válido."`
- [X] T027 [P] [US1] Implement `CreateProducerDto` in `backend/src/producers/dto/create-producer.dto.ts` — `@IsDocument()` with a `@Transform` normalising to digits (FR-007), `name` `@IsString` `@MaxLength(200)` with a trim-and-collapse transform (FR-009), pt-BR `@ApiProperty` text
- [X] T028 [P] [US1] Implement the response projection in `backend/src/producers/entities/producer.entity.ts` mapping **only** `{ id, document, documentType, name, createdAt, updatedAt }` — named explicitly, never a spread, so `nameSearch` and future columns stay invisible
- [X] T029 [US1] Implement `ProducersRepository` in `backend/src/producers/producers.repository.ts` with `create` and `findById` — **the only place Prisma is touched for producers**, and the only place `nameSearch` is derived, so a service cannot write `name` and leave search stale ([R-005](./research.md#r-005))
- [X] T030 [US1] Implement `ProducersService.create` and `.findOne` in `backend/src/producers/producers.service.ts` — derive `documentType`, translate Prisma `P2002` to 409 with `"Já existe um produtor cadastrado com este documento."`, and throw `NotFoundException` with `"Produtor não encontrado."` (depends on T027, T028, T029)
- [X] T031 [US1] Add `POST /producers` and `GET /producers/:id` to `backend/src/producers/producers.controller.ts` with `@ApiBearerAuth()` and Swagger responses matching [contracts/openapi.yaml](./contracts/openapi.yaml) — **no `@Public()`**, which is the entirety of the work required to satisfy FR-001
- [X] T032 [US1] Emit structured logs from `backend/src/producers/producers.service.ts` for producer creation, carrying `producerId`, the acting user id and the outcome — **never the document** (FR-037, FR-038); message text in English

**Checkpoint**: Producers can be registered and read. Demonstrable on its own — the MVP.

---

## Phase 4: User Story 2 - Record a Producer's Rural Properties (Priority: P2)

**Goal**: Attach farms to a producer, refusing any whose parts exceed the whole.

**Independent Test**: With one seeded producer, a property with consistent areas is created; one
with arable + vegetation over total is refused.

### Tests for User Story 2

- [X] T033 [P] [US2] Unit-test the area rule in `backend/test/unit/properties/area.rule.spec.ts` — 60+30 vs 100 passes; 70+40 vs 100 fails; **60+40 vs 100 passes** (FR-013 forbids exceeding, not reaching); 0+0 passes; and **every drift fixture from T005 passes**, which is the case a naive `a + b <= total` implementation fails
- [X] T034 [P] [US2] Unit-test `CreatePropertyDto` in `backend/test/unit/properties/create-property.dto.spec.ts` — `state` outside the 27 UFs rejected; negative areas rejected; `totalArea` of 0 rejected while `arableArea`/`vegetationArea` of 0 accepted (FR-015); three decimal places rejected; every failing field reported at once
- [X] T035 [P] [US2] Integration-test `POST /producers/:id/properties` in `backend/test/integration-db/properties-create.e2e-spec.ts` covering spec US2 §1–§4, §6, §7 — including the T005 drift case returning **201**, exceeding returning 400, and a property for a non-existent producer returning **404** (FR-018), not a validation error
- [X] T036 [P] [US2] Integration-test that a producer with no properties returns `properties: []` in `backend/test/integration-db/properties-empty.e2e-spec.ts` (spec US2 §5, FR-011) — having none is a valid state, not an error

### Implementation for User Story 2

- [X] T037 [P] [US2] Implement `backend/src/properties/area.rule.ts` as a named unit taking three `Prisma.Decimal` values and returning whether `arable + vegetation <= total` — a standalone rule because it is invoked from both create and update with different inputs, and is the most important invariant in the feature
- [X] T038 [P] [US2] Implement `CreatePropertyDto` in `backend/src/properties/dto/create-property.dto.ts` — `farmName` max 200, `city` max 120, `state` `@IsIn` the T011 list, the three areas each carrying the T014 per-field decimal transform plus `@IsNumber({ maxDecimalPlaces: 2 })`, `totalArea` `@IsPositive()`, the other two `@Min(0)`
- [X] T039 [P] [US2] Implement the property projection in `backend/src/properties/entities/property.entity.ts` serialising the three areas **as strings** (`"1500.11"`), per the contract, so JSON parsing on the client cannot reintroduce the float drift the server just avoided
- [X] T040 [US2] Implement `PropertiesRepository` in `backend/src/properties/properties.repository.ts` with `create`, `findById` and `listByProducer` — the sole Prisma caller for properties
- [X] T041 [US2] Implement `PropertiesService.create` in `backend/src/properties/properties.service.ts` — verify the producer exists (404 if not), apply the T037 area rule, and reject with a 400 whose `details` names the offending field and message `"A soma da área agricultável e da área de vegetação não pode ultrapassar a área total."` (depends on T037, T038, T040)
- [X] T042 [US2] Add `POST /producers/:id/properties` and `GET /properties/:id` to `backend/src/properties/properties.controller.ts` with pt-BR Swagger text matching the contract
- [X] T043 [US2] Emit structured logs for property creation from `backend/src/properties/properties.service.ts` carrying `propertyId`, `producerId`, actor and outcome

**Checkpoint**: Producers and their farms both work, with the area rule enforced on creation.

---

## Phase 5: User Story 3 - Record What Was Planted, and When (Priority: P3)

**Goal**: Record harvests per property and multiple crops per harvest.

**Independent Test**: With one seeded property, record a 2021 harvest, add soybeans and corn, and
confirm both are stored against that property and season.

### Tests for User Story 3

- [X] T044 [P] [US3] Unit-test the harvest-year rule in `backend/test/unit/properties/harvest-year.spec.ts` — 1899 rejected, 1900 accepted, `currentYear + 1` accepted, `currentYear + 2` rejected. **Use a mocked clock and assert across a year boundary**, since bounds are computed at request time and a hardcoded upper limit is wrong from 1 January (FR-022)
- [X] T045 [P] [US3] Integration-test harvests in `backend/test/integration-db/harvests.e2e-spec.ts` covering spec US3 §1, §3, §5, §6 — a 2021 harvest created; a second 2022 harvest independent of it; **two 2021 harvests on one property accepted** (safra and safrinha are both real, and the spec forbids neither); out-of-range years 400; harvest for a missing property 404
- [X] T046 [P] [US3] Integration-test crops in `backend/test/integration-db/crops.e2e-spec.ts` covering spec US3 §2 — soybeans **and** corn both recorded for the same 2021 harvest with neither replacing the other; a property with no harvests returning `harvests: []`; a crop for a missing harvest 404
- [X] T047 [P] [US3] Integration-test duplicate crops in `backend/test/integration-db/crops-duplicate.e2e-spec.ts` — `"Soja"` then `"Soja"` → 409; `"  soja  "` → 409 (case, accents and whitespace normalised); **`"Soya"` → 201**, the accepted cost of free-text naming recorded in the spec's Assumptions
- [X] T048 [US3] Persistence-test the composite unique under concurrency in `backend/test/persistence/crop-uniqueness.spec.ts` — 10 simultaneous inserts of the same crop name into one harvest yield exactly one row (FR-025)

### Implementation for User Story 3

- [X] T049 [P] [US3] Implement `CreateHarvestDto` in `backend/src/properties/dto/create-harvest.dto.ts` with a custom year validator computing `1900 <= year <= currentYear + 1` **at validation time**, not from a constant
- [X] T050 [P] [US3] Implement `CreateCropDto` in `backend/src/properties/dto/create-crop.dto.ts` — `name` required, max 120, trimmed and inner-whitespace-collapsed, preserving the caller's capitalisation for display (FR-024)
- [X] T051 [P] [US3] Implement harvest and crop projections in `backend/src/properties/entities/` — the crop projection returns `name` as typed and **never** `nameNormalized`
- [X] T052 [US3] Implement `HarvestsRepository` in `backend/src/properties/harvests.repository.ts` and `CropsRepository` in `backend/src/properties/crops.repository.ts` — the crops repository derives `nameNormalized` via T012, the only place it is set
- [X] T053 [US3] Implement `HarvestsService` in `backend/src/properties/harvests.service.ts` — verify the property exists (404), create the harvest
- [X] T054 [US3] Implement `CropsService` in `backend/src/properties/crops.service.ts` — verify the harvest exists (404) and translate `P2002` on `(harvestId, nameNormalized)` into a 409 with `"Esta cultura já está registrada nesta safra."`; the duplicate check is the constraint, never a pre-flight lookup, which would race
- [X] T055 [US3] Add `POST /properties/:id/harvests`, `GET /properties/:id/harvests`, `POST /harvests/:id/crops` and `GET /harvests/:id/crops` across `backend/src/properties/harvests.controller.ts` and `backend/src/properties/crops.controller.ts` with pt-BR Swagger text
- [X] T056 [US3] Emit structured logs for harvest and crop creation from `backend/src/properties/harvests.service.ts` and `backend/src/properties/crops.service.ts`, carrying the record id, its parent id, actor and outcome

**Checkpoint**: The registry records who produces what, where and when.

---

## Phase 6: User Story 4 - Browse and Retrieve the Registry (Priority: P4)

**Goal**: List, page, search and open a producer with the full picture.

**Independent Test**: Seed several producers, list them, confirm paging works and a search by name
returns the expected subset.

### Tests for User Story 4

- [X] T057 [P] [US4] Integration-test paging in `backend/test/integration-db/producers-list.e2e-spec.ts` covering spec US4 §1, §2 — a page plus a `total` exceeding it; page 2 returning different records with **no duplicates and none skipped**; `pageSize` above 100 rejected; deterministic ordering asserted, since an unordered paged query can repeat or skip rows between pages
- [X] T058 [P] [US4] Integration-test search in `backend/test/integration-db/producers-search.e2e-spec.ts` (spec US4 §3) — seed `"José Antônio de Almeida"`, then assert **both** `?search=jose` and `?search=JOSÉ` find it (FR-027), and that a document search works punctuated and unpunctuated
- [X] T059 [P] [US4] Integration-test nested retrieval in `backend/test/integration-db/producers-detail.e2e-spec.ts` (spec US4 §4, §5) — one producer with properties, harvests and crops returned in a single response; an unknown id returning **404 rather than 200 with a null body** (FR-029)

### Implementation for User Story 4

- [X] T060 [P] [US4] Implement `QueryProducerDto` in `backend/src/producers/dto/query-producer.dto.ts` extending the T016 pagination DTO with an optional `search` (max 200), normalised through T012 so the query matches the stored `nameSearch`
- [X] T061 [US4] Add `list` to `backend/src/producers/producers.repository.ts` using `prisma.$transaction([findMany, count])` with a stable `orderBy` (`createdAt` then `id`), searching `nameSearch` by `contains` and `document` by `startsWith` ([R-005](./research.md#r-005), [R-006](./research.md#r-006))
- [X] T062 [US4] Add `findOneDetailed` to `backend/src/producers/producers.repository.ts` with a nested `include` of properties → harvests → crops (FR-028)
- [X] T063 [US4] Add `ProducersService.list` and `.findOneDetailed` in `backend/src/producers/producers.service.ts`, mapping through the T028/T039/T051 projections so no internal column reaches the response
- [X] T064 [US4] Add `GET /producers` and extend `GET /producers/:id` in `backend/src/producers/producers.controller.ts` with the paging and search query parameters documented in pt-BR

**Checkpoint**: The registry is readable, searchable and pageable.

---

## Phase 7: User Story 5 - Correct and Remove Records (Priority: P5)

**Goal**: Fix mistakes and remove records, holding corrections to the same rules as creation.

**Independent Test**: Rename a producer; attempt an update that breaks the area rule and confirm it
is refused with nothing changed; delete a producer and confirm its whole tree goes with it.

### Tests for User Story 5

- [X] T065 [P] [US5] Integration-test producer updates in `backend/test/integration-db/producers-update.e2e-spec.ts` (spec US5 §1, §2) — renaming succeeds and leaves the document untouched; **editing one producer's document to match another's returns 409** (uniqueness holds on update exactly as on creation); renaming updates `nameSearch`, verified by searching the new name
- [X] T066 [P] [US5] Integration-test the partial-update area rule in `backend/test/integration-db/properties-update.e2e-spec.ts` (spec US5 §3) — a stored 100/60/30 property receiving `{"totalArea": 80}` returns **400 and the stored row is unchanged**. This is the single most likely way FR-013 gets bypassed: 80 is a perfectly valid number in isolation, and validating only the submitted field accepts it ([R-009](./research.md#r-009))
- [X] T067 [P] [US5] Integration-test cascade deletion in `backend/test/integration-db/producers-delete.e2e-spec.ts` (spec US5 §4, §5, §7) — deleting a producer with 3 properties, their harvests and crops returns a `deleted` report with correct non-zero counts, then all of them 404; deleting a property leaves its producer intact; deleting an unknown id returns 404
- [X] T068 [US5] Persistence-test cascade atomicity in `backend/test/persistence/cascade-atomicity.spec.ts` (spec US5 §6, FR-032) — force a failure part-way through the delete transaction and assert **every** record survives. A partially applied cascade is exactly how the orphans FR-033 forbids get created
- [X] T069 [US5] Persistence-test the orphan invariant in `backend/test/persistence/no-orphans.spec.ts` (FR-033, SC-005) — after a run of creates and deletes, assert zero properties without a producer, zero harvests without a property, zero crops without a harvest

### Implementation for User Story 5

- [X] T070 [P] [US5] Implement `UpdateProducerDto` in `backend/src/producers/dto/update-producer.dto.ts` — all fields optional, at least one required, each held to the same validators as creation
- [X] T071 [P] [US5] Implement `UpdatePropertyDto` in `backend/src/properties/dto/update-property.dto.ts` — all fields optional, at least one required, areas carrying the same per-field decimal transform
- [X] T072 [US5] Add `update` to `backend/src/producers/producers.repository.ts` and `ProducersService.update` in `backend/src/producers/producers.service.ts` — re-derive `nameSearch` whenever `name` changes, re-validate and re-normalise the document whenever it changes, and translate `P2002` to 409
- [X] T073 [US5] Add `update` to `backend/src/properties/properties.repository.ts` and `PropertiesService.update` in `backend/src/properties/properties.service.ts` implementing **load → merge → validate**: read the stored row, apply the submitted fields to a copy, then run the T037 area rule against **that**, never against the payload alone (FR-014)
- [X] T074 [US5] Implement `ProducersService.remove` in `backend/src/producers/producers.service.ts` using `prisma.$transaction` to count properties, harvests and crops **before** deleting the producer and return those counts — the counts must come from inside the same transaction, since the cascade itself reports only rows removed from the target table ([R-004](./research.md#r-004))
- [X] T075 [US5] Implement `remove` for properties, harvests and crops across `backend/src/properties/properties.service.ts`, `harvests.service.ts` and `crops.service.ts`, each returning the same `DeletionReport` shape from the contract
- [X] T076 [US5] Add `PATCH` and `DELETE` routes for all four resources across `backend/src/producers/producers.controller.ts`, `backend/src/properties/properties.controller.ts`, `harvests.controller.ts` and `crops.controller.ts`, documenting the cascade prominently in the pt-BR descriptions — a caller must not discover the blast radius by trying it
- [X] T077 [US5] Emit structured logs for every update and delete from `backend/src/producers/producers.service.ts`, `backend/src/properties/properties.service.ts`, `harvests.service.ts` and `crops.service.ts`, recording the record id, actor, and for deletes the counts removed (FR-037)

**Checkpoint**: Full CRUD across all four resources.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T078 [P] Extend `backend/README.md` (**pt-BR**) with the registry: the four resources, the area rule, the cascade warning, and the accepted limitations from [quickstart.md](./quickstart.md#known-limitations) — a newcomer must reach a recorded crop without reading source (Constitution III, SC-010)
- [X] T079 [P] Extend `backend/test/security/openapi-contract.spec.ts` to assert the 17 operations from [contracts/openapi.yaml](./contracts/openapi.yaml) exist with their documented status codes, that **no operation carries `security: []`**, and that no response schema exposes `nameSearch` or `nameNormalized`
- [X] T080 Run all five suites defined in `backend/package.json` — `test:unit`, `test:integration`, `test:integration-db`, `test:persistence`, `test:security` — plus `lint` and `typecheck`, and confirm every endpoint has an integration test and every business rule a unit test (Constitution IV)
- [X] T081 Execute all 21 manual steps in [quickstart.md](./quickstart.md), especially **step 6** (the drift case must return 201) and **step 9** (the partial update must return 400)
- [X] T082 Verify the current status of Brazil's **alphanumeric CNPJ** against Receita Federal and record the finding in `backend/README.md`. If it is in force, `backend/src/common/validation/document.ts` must accept letters in the first twelve characters using the ASCII-minus-48 weighting, and T004's fixtures need alphanumeric cases — see [R-003](./research.md#r-003) and plan Risk 2
- [X] T083 Confirm the deployment posture before any public exposure: the registry is shared with no roles and self-registration is open, so anyone who registers can erase any producer's history (plan Risk 1). Record the decision — restrict registration, restrict network access, or accept — in `backend/README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup — **blocks every user story**
- **US1 (Phase 3)**: needs Foundational
- **US2 (Phase 4)**: needs US1 — a property needs a producer to hang from
- **US3 (Phase 5)**: needs US2 — a harvest needs a property
- **US4 (Phase 6)**: needs US1 for listing; the nested read (T062) needs US2 and US3 to have anything to nest
- **US5 (Phase 7)**: needs the resources it edits and deletes to exist
- **Polish (Phase 8)**: needs the stories you intend to ship

### Honest note on story independence

The template's ideal is independent stories, and a strict parent-child hierarchy cannot deliver
that: a property needs a producer, a harvest needs a property, a crop needs a harvest. Each story is
independently **testable** — seed the parent and exercise the child — but the delivery order is
genuinely P1 → P2 → P3 → P4 → P5. Parallelism lives *within* phases, which is what the examples
below reflect rather than pretending otherwise.

### Within Each User Story

- Tests written first and confirmed failing
- Constants and utilities → DTOs and projections → repositories → services → controllers → logging
- Two tasks touching the same file are never both `[P]`. The shared files are
  `backend/prisma/schema.prisma` (T007–T009), `backend/src/app.module.ts` (T018),
  `backend/src/producers/producers.repository.ts` (T029, T061, T062, T072),
  `backend/src/producers/producers.service.ts` (T030, T063, T072, T074),
  `backend/src/producers/producers.controller.ts` (T031, T064, T076),
  `backend/src/properties/properties.service.ts` (T041, T073, T075) and
  `backend/src/properties/properties.controller.ts` (T042, T076) — each strictly sequential

### Parallel Opportunities

- Setup: T003–T006 in parallel after T002
- Foundational: T011–T016 all in parallel; T007–T010 strictly sequential (one file, one migration)
- Every story's test tasks are parallel with each other
- US1: T025, T027, T028 in parallel; US2: T037, T038, T039 in parallel
- US5: T070 and T071 in parallel

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests together (they must fail first):
Task: "Unit-test document validation in backend/test/unit/common/document.spec.ts"
Task: "Unit-test CreateProducerDto in backend/test/unit/producers/create-producer.dto.spec.ts"
Task: "Integration-test POST /producers in backend/test/integration-db/producers-create.e2e-spec.ts"
Task: "Integration-test GET /producers/:id in backend/test/integration-db/producers-read.e2e-spec.ts"

# Then the independent pieces together:
Task: "Document validation in backend/src/common/validation/document.ts"
Task: "CreateProducerDto in backend/src/producers/dto/create-producer.dto.ts"
Task: "Producer projection in backend/src/producers/entities/producer.entity.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1
4. **Stop and validate**: quickstart steps 1–5 pass
5. Demo: producers can be registered with genuinely validated documents

MVP is T001–T032 (32 tasks). Note how much smaller the foundation is than feature 001's: no auth, no
error envelope, no logging framework, no Docker setup — all inherited.

### Incremental Delivery

| Increment | Tasks | Delivers |
|-----------|-------|----------|
| Setup + Foundational | T001–T019 | Schema, utilities, wiring, extended log gate |
| + US1 | T020–T032 | **MVP** — validated producers |
| + US2 | T033–T043 | Farms, with the area rule enforced |
| + US3 | T044–T056 | Harvests and multiple crops per season |
| + US4 | T057–T064 | Paged, searchable, nested reads |
| + US5 | T065–T077 | Corrections and cascading deletion |
| + Polish | T078–T083 | pt-BR README, contract gate, CNPJ check, posture decision |

**US5 is where the risk concentrates.** It introduces the only irreversible operation in the system,
and T068 (atomicity) plus T069 (no orphans) are what stand between a cascade and a corrupted
registry.

### Parallel Team Strategy

Two developers after Foundational: one takes US1 → US4 (the producer thread through
`producers.*`), the other takes US2 → US3 (the property/harvest/crop thread through `properties.*`),
converging on US5, which touches both. The shared-file list above is the collision map.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task
- Every task names its file path; ids run T001–T083 with no gaps
- Verify tests fail before implementing
- Commit per task or logical group, messages in English (Constitution VIII)
- Four tasks carry weight out of proportion to their size — **T033** (drift fixtures in the area
  rule), **T066** (partial update validated on the merged record), **T068** (cascade atomicity) and
  **T074** (counts taken inside the delete transaction). Each is small, and each silently breaks a
  requirement if skipped
