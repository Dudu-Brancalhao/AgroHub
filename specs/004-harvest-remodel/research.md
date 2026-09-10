# Phase 0 Research: Shared Harvests, Crop as Junction

**Feature**: `004-harvest-remodel` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

Decisions taken before design, with the alternatives rejected. This is the first feature that
**changes work already shipped**, so most of what follows is about blast radius: what has to move,
what must not, and what the change costs that the specification could not have known.

Three (R-001, R-007, R-009) are carried into the plan.

---

## R-001: Drop only what has to be dropped

**Decision**: The migration drops and recreates **`crops` and `harvests` only**. `producers` and
`properties` are left untouched, along with everything belonging to authentication.

**Rationale**: The specification's Q3 answer is "rebuild from empty", and its Assumptions say the
existing producers, properties, harvests and crops are discarded. What that answer actually
licensed was *not writing a data migration* — and only the crop and harvest tables need one.

`producers` and `properties` are structurally unchanged by this feature: a property simply stops
owning harvests and starts owning crops, which is a change to the *other* table's foreign key. So
destroying them buys nothing and costs whatever anyone had entered while testing.

Doing less damage than the specification permits is the right way round to be wrong. Recorded here
rather than done quietly, because the Assumptions wording is broader than this and should be read
as intent rather than instruction.

**Alternatives considered**:

- *`prisma migrate reset`* — drops every table including `users`, so everyone loses their login for
  no reason connected to this change. Rejected.
- *Dropping producers and properties too, as the Assumptions literally say* — satisfies the letter
  and destroys working data for nothing. Rejected.
- *Writing a data migration after all* — explicitly out of scope by Q3, and the point of that answer
  was to keep this feature small.

---

## R-002: The name stays `Harvest`

**Decision**: Keep `Harvest` / `harvests` / `harvestId` in the schema, the code and the API. The
specification's word "season" was prose, used only to distinguish the new shared record from the
old per-property one while both were being discussed.

**Rationale**: *Safra* translates to *harvest*, and it is the word a Brazilian agricultural user
says. Renaming would touch the schema, ten source files, the contract, the README and every test,
produce a large and entirely mechanical diff, and change nothing a user experiences.

The specification explicitly left this to the plan, and a rename is churn masquerading as clarity.

---

## R-003: One parent in the path, the other in the body

**Decision**:

| Operation | Route |
|-----------|-------|
| Create a harvest | `POST /harvests` |
| List harvests | `GET /harvests` |
| Update / delete a harvest | `PATCH /harvests/:id`, `DELETE /harvests/:id` |
| Record a crop | `POST /properties/:propertyId/crops`, with `harvestId` in the body |
| List a property's crops | `GET /properties/:propertyId/crops` |
| List a harvest's crops | `GET /harvests/:id/crops` |
| Delete a crop | `DELETE /crops/:id` |

**Rationale**: A crop now has two parents, which breaks the clean rule
[feature 002 established](../002-rural-producer-crud/research.md#r-013) — parent in the path, so a
missing parent is a 404 on the path rather than a validation error about a field.

The property is the better one to keep in the path, for a reason that is structural rather than
aesthetic: **the property owns the crop and the harvest does not.** Deleting a property deletes its
crops; deleting a harvest is refused while crops exist (R-005). The path should follow ownership.
It also matches how the work is actually done — someone manages one farm's plantings, choosing which
season each belongs to.

A missing property therefore stays a 404 on the path; a missing harvest becomes a 404 raised from
the body, which is the one place this feature has to bend feature 002's convention.

**Alternatives considered**:

- *`POST /crops` with both ids in the body* — most honest about the junction, but loses the
  path-404 convention entirely and reads as an anonymous table insert.
- *`POST /properties/:propertyId/harvests/:harvestId/crops`* — explicit, and implies the harvest is
  nested under the property, which is exactly the misconception this feature exists to remove.

---

## R-004: Constraints, and a table that can never grow

**Decision**: `harvests.year` UNIQUE. `crops` UNIQUE on `(propertyId, harvestId, nameNormalized)`.

**Rationale**: The year unique constraint *is* FR-008, and the composite unique *is* FR-013 —
translated from the old `(harvestId, nameNormalized)` by adding the property, so the duplicate rule
still applies within one farm-and-season pair and not across farms.

**A consequence nobody has mentioned yet**: a valid year runs from 1900 to next year, so the
`harvests` table can hold **at most 128 rows, ever**. It stops being a growing table and becomes a
small reference list. That is a pleasant confirmation of the reasoning behind the change — a season
really is a shared fact — and it has a practical consequence in R-007.

---

## R-005: Refusing to delete a harvest, counted in the service and enforced in the database

**Decision**: The crop-to-harvest relation becomes `onDelete: Restrict`. `HarvestsService.remove`
counts the referencing crops inside a transaction and refuses with a 409 naming that count.

**Rationale**: FR-010 requires both a refusal *and* the number of crops blocking it, and those need
different mechanisms. The count has to come from application code, because a foreign-key violation
tells you that something referenced the row, never how many things did.

The database constraint is not redundant. Between the service counting zero and the service issuing
the delete, another request can record a crop — a check-then-act race identical in shape to the one
[feature 002 avoided](../002-rural-producer-crud/research.md#r-011) for duplicate documents. There
the answer was to let the constraint be the check; here the constraint is the backstop and the count
is for the message.

Note this inverts the current relation: today a crop cascades from its harvest. A shared harvest
must not cascade, or deleting "2021" would erase a year across every farm in the registry from a
single call.

---

## R-006: Nested reads group by harvest in the service

**Decision**: `GET /producers/:id` returns producer → properties → **crops grouped by harvest year**.
The grouping is done in the service over crops fetched with their harvest, not by a nested database
include.

**Rationale**: FR-019 asks for crops grouped by season so the response stays readable. The old
nested include walked property → harvest → crop, and that path no longer exists — a harvest is not
reachable from a property except through the crops that connect them.

Fetching each property's crops with their harvest and grouping in the service is one query and
keeps the response shape stable for whoever consumes it. A property with no crops yields an empty
list of seasons, exactly as it yields an empty list of harvests today.

---

## R-007: The dashboard does not change — verified, not assumed

**Decision**: No change to any dashboard query, figure, DTO or document. The only dashboard work is
mechanical updates to **test setup**.

**Rationale**: The crop breakdown is:

```ts
tx.crop.groupBy({ by: ['nameNormalized', 'name'], _count: { _all: true } })
```

It reads neither the harvest nor the property. This restructure moves data that query never
touched, so its numbers, its ordering and its documentation all stand.

That is the outcome of the specification's fourth iteration: the `COUNT(DISTINCT property_id)`
correction was withdrawn, so the chart keeps counting plantings and feature `003-dashboard-api`
needs no requirement changed and no assertion rewritten.

**But the scale fixture breaks, and it is not obvious.** `seedAtScale` creates 50,000 harvests using
`year: 2019 + (i % 5)` — five distinct years across fifty thousand rows. Under a unique year it can
create **five**. Measured:

```
valid years 1900..2027            -> 128 harvests possible in total, ever
fixture asks for                  -> 50,000
fixture can now create            -> 5
max crops = 10,000 x 5 x 10 names -> 500,000, so SC-006's 150,000 crops is still reachable
```

The fixture must be rebuilt to seed a handful of harvests and spread 150,000 crops across
property-harvest-name combinations. Without that, the performance test fails on a unique-constraint
violation and reads like a bug in the feature rather than in its own setup.

---

## R-008: Deletion reports lose their harvest count

**Decision**: `DELETE /producers/:id` reports `{ producers, properties, crops }`.
`DELETE /properties/:id` reports `{ properties, crops }`. Neither reports harvests any more.

**Rationale**: Harvests are no longer beneath a producer or a property, so there is nothing to
report — and reporting `harvests: 0` would imply the operation considered them, which it did not.

This is a visible contract change on two endpoints that feature 002 documented and tested, and it
is the kind of thing that gets missed because the endpoints still work.

---

## R-009: Blast radius, enumerated

**Decision**: Ten source files and ten test files change. Enumerated here so the task list can be
checked against it rather than assembled from memory.

| Source file | Why |
|---|---|
| `prisma/schema.prisma` | Harvest loses `propertyId`; Crop gains it; both unique constraints |
| `properties/properties.repository.ts` | Harvest queries lose the property; crop queries gain it; delete reports |
| `properties/properties.service.ts` | Harvest creation no longer takes a property; crop creation validates two parents; delete refusal |
| `properties/properties.controller.ts` | Routes per R-003 |
| `properties/entities/property.entity.ts` | Property detail returns crops grouped by harvest |
| `properties/dto/create-harvest.dto.ts` | Unchanged in validation; moves conceptually to a top-level resource |
| `properties/dto/create-crop.dto.ts` | Gains `harvestId` |
| `properties/properties.module.ts` | Harvest controller/service become their own registration |
| `producers/producers.repository.ts` | Nested include: properties → crops → harvest |
| `producers/producers.service.ts` | Detail mapping and the delete report |

| Test file | Kind of change |
|---|---|
| `integration-db/harvests-crops.e2e-spec.ts` | **Semantic** — split into harvest and crop suites; safra/safrinha now rejected |
| `integration-db/deletion.e2e-spec.ts` | **Semantic** — report shape; harvest delete refusal |
| `integration-db/properties.e2e-spec.ts` | Mechanical — nested shape |
| `integration-db/producers.e2e-spec.ts` | Mechanical — nested shape |
| `integration-db/dashboard.e2e-spec.ts` | Mechanical — setup only |
| `integration-db/dashboard-by-crop.e2e-spec.ts` | **Mechanical only** — every assertion still holds |
| `integration-db/dashboard-performance.e2e-spec.ts` | Setup — see R-007 |
| `integration-db/log-leak-registry.e2e-spec.ts` | Mechanical — setup |
| `persistence/registry-integrity.spec.ts` | **Semantic** — cascade chain and the new constraints |
| `security/openapi-contract.spec.ts` | **Semantic** — routes and shapes |
| `unit/properties/harvest-year.spec.ts` | Unchanged — the year rule is untouched |
| `support/dashboard-fixtures.ts` | Rebuilt per R-007 |
| `support/create-db-test-app.ts` | Truncate order |

That `dashboard-by-crop.e2e-spec.ts` needs **no assertion changed** is the clearest evidence for
R-007: the chart's behaviour is genuinely untouched.

---

## R-010: Testing approach is inherited, and the interesting tests are the new refusals

**Decision**: Same tiers as features 002 and 003 — `integration-db` against real Postgres for
anything touching constraints or cascades, unit tests for pure rules.

**Rationale**: What is new here is almost entirely constraint behaviour: a unique year, a composite
unique across three columns, a restricted delete, a cascade that no longer reaches harvests. Every
one of those is a property of the database, so the reasoning in
[R-008 of feature 002](../002-rural-producer-crud/research.md#r-008) applies unchanged.

The rules worth unit-testing did not change: the harvest year bounds, crop-name normalisation, the
area rule. Their tests should pass untouched, and it is worth noticing if they do not.

---

## R-011: The capability this removes, restated once more

**Decision**: Proceed with a globally unique year, as answered.

**Rationale, recorded because it is the one irreversible part**: feature 002 deliberately left
`(propertyId, year)` un-constrained so that **safra and safrinha** — a main crop and a second
planting in one calendar year — could both be recorded, and that choice was documented with its
reason. A unique year removes it, and there is a passing test asserting the current behaviour that
will have to be inverted.

The loss is narrow: the chart is unaffected, since that farm contributes one record instead of two
and the chart counts records. What is lost is the ability to *record* the second planting at all.

Restoring it later means giving a harvest a label alongside its year and making the pair unique —
a schema change plus a data migration on whatever exists by then, rather than a configuration
change. That is the whole of the risk in this feature; the junction itself is additive and
mechanical.

---

## Resolved unknowns summary

| Unknown | Resolution |
|---------|-----------|
| How much to destroy | Only `crops` and `harvests`; producers, properties and users survive (R-001) |
| Naming | `Harvest` stays; "season" was prose (R-002) |
| Route shape for a two-parent resource | Property in the path, harvest in the body (R-003) |
| Constraints | `year` unique; `(propertyId, harvestId, nameNormalized)` unique (R-004) |
| Refusing a harvest delete | `Restrict` in the database, counted in the service (R-005) |
| Nested read shape | Crops grouped by harvest in the service (R-006) |
| Dashboard impact | **None** — verified against the query; only fixtures move (R-007) |
| Deletion report shape | Loses `harvests` on two endpoints (R-008) |
| Blast radius | 10 source files, 10 test files, enumerated (R-009) |
| Test tiers | Inherited unchanged (R-010) |
| The irreversible part | Safra/safrinha, gone with the unique year (R-011) |
