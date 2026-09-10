# Data Model: Shared Harvests, Crop as Junction

**Feature**: `004-harvest-remodel` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

Two tables are reshaped. None is added. `producers`, `properties` and everything belonging to
authentication are untouched ([R-001](./research.md#r-001)).

---

## The shape change

```
before                                  after

Producer                                Producer
   |                                       |
   v                                       v
Property                                Property ------\
   |                                                     >--- Crop
   v                                    Harvest --------/
Harvest                                 (shared, belongs to nobody)
   |
   v
Crop
```

A property and a harvest are now related **only** through the crops that connect them. There is no
path from a property to a harvest that does not pass through a crop, and that is the point: a
harvest is not something a farm has.

---

## `Harvest` — reshaped

| Field | Type | Constraints | Change |
|-------|------|-------------|--------|
| `id` | `String` (uuid) | PK | unchanged |
| ~~`propertyId`~~ | — | — | **removed** — this is the feature |
| `year` | `Int` | **UNIQUE**, 1900 ≤ year ≤ currentYear + 1 | gains UNIQUE |
| `createdAt` / `updatedAt` | `DateTime` | | unchanged |

**The year is the identity.** FR-008 makes it unique across the registry, so "2021" names exactly
one record and cannot be entered twice.

**The table can never exceed 128 rows.** A valid year runs 1900 to next year, so the whole set of
possible harvests is bounded and small. It stops being a growing table and becomes a reference
list — which is a neat confirmation that a harvest really is a shared fact, and has a practical
consequence for test fixtures ([R-007](./research.md#r-007)).

**Bounds are still computed at request time**, not held as a constant, exactly as before — a
hardcoded upper limit is wrong from 1 January.

**Relationships**: has many `Crop`, `onDelete: Restrict` — see below. It has **no** relationship to
`Property`.

---

## `Crop` — now the junction

| Field | Type | Constraints | Change |
|-------|------|-------------|--------|
| `id` | `String` (uuid) | PK | unchanged |
| `propertyId` | `String` | FK → `Property.id`, **cascade**, indexed | **added** |
| `harvestId` | `String` | FK → `Harvest.id`, **restrict**, indexed | relation action changes |
| `name` | `String` (120) | required | unchanged |
| `nameNormalized` | `String` (120) | part of the composite unique | unchanged |
| `createdAt` / `updatedAt` | `DateTime` | | unchanged |

**Composite UNIQUE on `(propertyId, harvestId, nameNormalized)`** — this is FR-013, translated from
the old `(harvestId, nameNormalized)` by adding the property. The duplicate rule now applies within
one farm-and-season pair:

| Case | Outcome | Requirement |
|------|---------|-------------|
| Same farm, same harvest, same crop | rejected | FR-013 |
| Same farm, same harvest, "Soja" then "SOJA" | rejected — compared on the normalised name | FR-013 |
| **Different** farms, same harvest, same crop | accepted | FR-014 |
| Same farm, **different** harvests, same crop | accepted | FR-015 |
| Same farm, same harvest, different crops | accepted | FR-016 |

**The two foreign keys behave differently, and deliberately so:**

- `propertyId` **cascades**. A crop belongs to its farm and dies with it (FR-017), exactly as
  before.
- `harvestId` **restricts**. A harvest belongs to nobody, so a cascade would let one call erase a
  year across every farm in the registry. The database refuses; the service counts first so it can
  say how many crops are blocking ([R-005](./research.md#r-005)).

That asymmetry is the whole ownership model in two lines of schema.

---

## Deleting things

| Delete | Effect | Report |
|--------|--------|--------|
| Producer | its properties and their crops | `{ producers, properties, crops }` |
| Property | its crops; the producer and every harvest survive | `{ properties, crops }` |
| Harvest with crops | **refused**, 409, naming how many crops block it | — |
| Harvest with no crops | removed | `{ harvests: 1 }` |
| Crop | just the crop | `{ crops: 1 }` |

**Neither producer nor property deletion reports a harvest count any more** — there is nothing
beneath them to report, and a `harvests: 0` would imply the operation considered them
([R-008](./research.md#r-008)). This is a visible contract change on two endpoints that keep working
either way, which is exactly why it is easy to miss.

The refusal count is taken **inside the delete transaction**. Between counting zero and issuing the
delete, another request can record a crop — the same check-then-act race feature 002 avoided for
duplicate documents. The `Restrict` constraint is the backstop for that window; the count is only
there to make the message useful.

---

## Reading it back

`GET /producers/:id` returns producer → properties → **crops grouped by harvest year**:

```json
{
  "id": "…", "name": "José Antônio",
  "properties": [
    {
      "id": "…", "farmName": "Fazenda Santa Helena", "totalArea": "1500.11",
      "harvests": [
        { "harvestId": "…", "year": 2021, "crops": [ { "id": "…", "name": "Soja" },
                                                     { "id": "…", "name": "Milho" } ] },
        { "harvestId": "…", "year": 2022, "crops": [ { "id": "…", "name": "Soja" } ] }
      ]
    }
  ]
}
```

The grouping happens **in the service**, over crops fetched with their harvest — a nested database
include cannot walk property → harvest any more, because that path no longer exists
([R-006](./research.md#r-006)). The response shape stays close to what it is today, so a consumer
sees a familiar structure even though the storage beneath it is quite different.

A property with no crops returns an empty `harvests` list, exactly as it returns an empty list
today.

---

## Prisma schema sketch

Indicative; the authoritative version lands in `backend/prisma/schema.prisma`.

```prisma
model Harvest {
  id        String   @id @default(uuid())
  year      Int      @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  crops     Crop[]

  @@map("harvests")
}

model Crop {
  id             String   @id @default(uuid())
  propertyId     String   @map("property_id")
  property       Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  harvestId      String   @map("harvest_id")
  harvest        Harvest  @relation(fields: [harvestId], references: [id], onDelete: Restrict)
  name           String   @db.VarChar(120)
  nameNormalized String   @map("name_normalized") @db.VarChar(120)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([propertyId, harvestId, nameNormalized])
  @@index([propertyId])
  @@index([harvestId])
  @@map("crops")
}
```

`Property` gains `crops Crop[]` and loses `harvests Harvest[]`. Nothing else in the schema moves.

---

## What this removes

**Safra and safrinha.** The old model let one property hold two harvests in the same year, so a farm
could record soybeans in a main planting and again in a second one. A unique year plus a crop unique
per farm-and-season makes that unrepresentable.

The dashboard is unaffected — that farm contributes one crop record instead of two, and the chart
counts records. What is lost is the ability to record the second planting at all
([R-011](./research.md#r-011)).

---

## Requirement coverage

| Requirement | Where it is satisfied |
|-------------|----------------------|
| FR-001 (harvest independent of property) | `propertyId` removed from `Harvest` |
| FR-002 / FR-003 (crop is the junction) | `Crop` carries both foreign keys |
| FR-004 / FR-005 (empty harvest, empty property) | No constraint requires either to have crops |
| FR-007 (year bounds) | Validator computing bounds at request time |
| FR-008 (one season per year) | `Harvest.year` UNIQUE |
| FR-010 (refuse delete while in use) | `onDelete: Restrict` + counted refusal |
| FR-011 (delete an unused harvest) | Allowed once no crop references it |
| FR-013 – FR-016 (crop duplicate rules) | Composite UNIQUE on the three columns |
| FR-017 (property delete removes crops) | `propertyId` cascade |
| FR-019 (crops grouped by season) | Service-side grouping |
| FR-021 – FR-026 (dashboard unchanged) | No dashboard query reads either key |
| FR-028 (existing rules intact) | Producers, properties, areas and documents untouched |
