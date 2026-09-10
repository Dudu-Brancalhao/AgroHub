# Data Model: Rural Producer Registry

**Feature**: `002-rural-producer-crud` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

Four new tables forming a strict chain: **Producer → Property → Harvest → Crop**, each child
belonging to exactly one parent. Nothing here relates to `users`: FR-002 makes the registry shared
with no ownership, so there is deliberately no `createdBy` column
([R-007](./research.md#r-007)).

---

## `Producer`

Spec entity: **Producer**. A person or company that farms.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (uuid) | PK | The document is *not* the key — FR-005 allows correcting a mistyped CPF, and a mutable natural key cascades through every child row. |
| `document` | `String` | **UNIQUE**, indexed | Digits only, punctuation stripped (FR-007). The unique constraint is what delivers FR-008 under concurrency. |
| `documentType` | `Enum(CPF, CNPJ)` | required | Derived from length at validation time and stored, so a consumer need not re-derive it and a future format change is visible in the data. |
| `name` | `String` | required, max 200 | Trimmed, inner whitespace collapsed (FR-009). Caller's capitalisation preserved. |
| `nameSearch` | `String` | indexed | Lowercased, diacritics stripped. Exists only to be searched (FR-027, [R-005](./research.md#r-005)). |
| `createdAt` / `updatedAt` | `DateTime` | | |

**Validation rules** (DTO unless noted):

- `document` — required; normalised to digits; must pass check-digit validation for CPF (11) or
  CNPJ (14) and must not be a single repeated digit (FR-005, FR-006).
- `name` — required, non-empty after trimming, max 200 characters.
- `nameSearch` is **never accepted from the client**. It is derived in `ProducersRepository`, the
  only place that writes the row — a service could otherwise write `name` without it and leave
  search silently stale.
- Unknown fields rejected by the inherited `forbidNonWhitelisted` (FR-036).

**Relationships**: has many `Property`, `onDelete: Cascade`.

**Response projection**: `{ id, document, documentType, name, createdAt, updatedAt }` — named
explicitly, never a spread, so `nameSearch` and any future column stay invisible until deliberately
exposed.

---

## `Property`

Spec entity: **Property**. A farm belonging to exactly one producer.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (uuid) | PK | |
| `producerId` | `String` | FK → `Producer.id`, **cascade**, indexed | FR-018: a property cannot exist without its producer. |
| `farmName` | `String` | required, max 200 | |
| `city` | `String` | required, max 120 | Free text — no municipality list is in scope. |
| `state` | `String` | required, exactly 2 | One of the 27 UFs ([R-011](./research.md#r-011)). |
| `totalArea` | `Decimal(12,2)` | > 0 | Hectares. |
| `arableArea` | `Decimal(12,2)` | ≥ 0 | Hectares. |
| `vegetationArea` | `Decimal(12,2)` | ≥ 0 | Hectares. |
| `createdAt` / `updatedAt` | `DateTime` | | |

**The area invariant** (FR-013, FR-014, FR-016):

```
arableArea + vegetationArea  <=  totalArea
```

Three things about it that are easy to get wrong, and each is a requirement of its own:

1. **`<=`, not `<`.** A farm that is entirely arable plus vegetation is valid; the rule forbids
   *exceeding* the total (FR-013, US2 §3).
2. **Evaluated on the post-change record.** `PATCH { totalArea: 80 }` against a stored 100/60/30
   must be refused, because the resulting row is 80/60/30. Validating only the submitted field
   accepts it (FR-014, [R-009](./research.md#r-009)). This is why the rule lives in the service, not
   the DTO — a DTO cannot see the stored row.
3. **Computed in `Decimal`, per field.** `1000 + 500.11` in JavaScript is `1500.1100000000001`, which
   wrongly rejects a valid farm on a 1500.11 ha property. Each field is converted to `Prisma.Decimal`
   individually at the DTO boundary and added in decimal space; `new Decimal(a + b)` would inherit
   the drift and defeat the whole exercise ([R-001](./research.md#r-001)).

Precision `12,2` allows up to 9,999,999,999.99 ha — comfortably beyond the largest Brazilian
landholding, with two decimals as the spec's Assumptions state.

**Other validation**:

- `totalArea` must be > 0; a farm with no area is not a farm (FR-015).
- `arableArea` and `vegetationArea` must be ≥ 0; both zero is valid unused land (FR-015).
- All three must have at most 2 decimal places, rejected at the DTO before conversion.
- Any remaining area (`total − arable − vegetation`) is unclassified land, not a tracked field.

**Relationships**: belongs to one `Producer`; has many `Harvest`, `onDelete: Cascade`.

---

## `Harvest`

Spec entity: **Harvest**. A season recorded against exactly one property.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (uuid) | PK | |
| `propertyId` | `String` | FK → `Property.id`, **cascade**, indexed | FR-023. |
| `year` | `Int` | 1900 ≤ year ≤ currentYear + 1 | FR-022. |
| `createdAt` / `updatedAt` | `DateTime` | | |

**Bounds are computed at request time, not held as a constant.** A hardcoded upper bound becomes
wrong on 1 January and stays wrong until someone notices.

**Deliberately *not* unique on `(propertyId, year)`.** The spec never forbids two 2021 harvests on
one property — a second planting in the same year is real in Brazilian agriculture (safra and
safrinha). Adding the constraint would be inventing a rule; if one is wanted later it is a migration,
whereas removing a wrongly-added one after data exists is not.

**Harvest is per-property, not a shared season.** Ten properties with a 2021 harvest produce ten
rows. This follows the spec's entity description literally and is recorded in its Assumptions.

**Relationships**: belongs to one `Property`; has many `Crop`, `onDelete: Cascade`.

---

## `Crop`

Spec entity: **Crop**. One planted crop in one harvest, and therefore one property-and-season.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (uuid) | PK | |
| `harvestId` | `String` | FK → `Harvest.id`, **cascade** | FR-023. |
| `name` | `String` | required, max 120 | As the caller typed it — capitalisation preserved for display (FR-024). |
| `nameNormalized` | `String` | part of composite unique | Trimmed, inner whitespace collapsed, lowercased, diacritics stripped. |
| `createdAt` / `updatedAt` | `DateTime` | | |

**Composite UNIQUE on `(harvestId, nameNormalized)`** — this *is* FR-025. A check-then-insert would
race; the constraint cannot. `P2002` maps to 409 ([R-010](./research.md#r-010)).

The consequence, accepted in the spec: "Soja", "soja" and "SOJA" collide as intended, while "Soja"
and "Soya" are two crops. Free-text naming buys convenience now and costs reconciliation later.

**Relationships**: belongs to one `Harvest`.

---

## Cascade behaviour (FR-030 – FR-034)

Every relation declares `onDelete: Cascade` at the database level, so deleting a producer removes its
properties, their harvests and those harvests' crops in **one statement inside one transaction**.
Atomicity (FR-032) is a property of the database, not of application code that could be interrupted
half-way ([R-004](./research.md#r-004)).

FR-034 requires reporting what was removed, and a cascade cannot tell us — Postgres reports only rows
deleted from the target table. So the delete is:

```
BEGIN
  count properties  where producerId = :id
  count harvests    where property.producerId = :id
  count crops       where harvest.property.producerId = :id
  DELETE producer   where id = :id          -- cascade removes the rest
COMMIT
-> { producer: 1, properties: n, harvests: m, crops: k }
```

Counting inside the same transaction is what makes the reported numbers true rather than
approximately true.

---

## Prisma schema sketch

Indicative; the authoritative version lands in `backend/prisma/schema.prisma`.

```prisma
enum DocumentType {
  CPF
  CNPJ
}

model Producer {
  id           String       @id @default(uuid())
  document     String       @unique
  documentType DocumentType
  name         String       @db.VarChar(200)
  nameSearch   String       @map("name_search")
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")
  properties   Property[]

  @@index([nameSearch])
  @@map("producers")
}

model Property {
  id             String   @id @default(uuid())
  producerId     String   @map("producer_id")
  producer       Producer @relation(fields: [producerId], references: [id], onDelete: Cascade)
  farmName       String   @map("farm_name") @db.VarChar(200)
  city           String   @db.VarChar(120)
  state          String   @db.VarChar(2)
  totalArea      Decimal  @map("total_area")      @db.Decimal(12, 2)
  arableArea     Decimal  @map("arable_area")     @db.Decimal(12, 2)
  vegetationArea Decimal  @map("vegetation_area") @db.Decimal(12, 2)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  harvests       Harvest[]

  @@index([producerId])
  @@map("properties")
}

model Harvest {
  id         String   @id @default(uuid())
  propertyId String   @map("property_id")
  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  year       Int
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  crops      Crop[]

  @@index([propertyId])
  @@map("harvests")
}

model Crop {
  id             String   @id @default(uuid())
  harvestId      String   @map("harvest_id")
  harvest        Harvest  @relation(fields: [harvestId], references: [id], onDelete: Cascade)
  name           String   @db.VarChar(120)
  nameNormalized String   @map("name_normalized") @db.VarChar(120)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([harvestId, nameNormalized])
  @@map("crops")
}
```

---

## Requirement coverage

| Requirement | Where it is satisfied |
|-------------|----------------------|
| FR-002 (shared, no roles) | No ownership column exists — deliberately |
| FR-005 / FR-006 (document validity) | `DocumentValidator`, DTO constraint |
| FR-007 (normalisation) | `document` stored digits-only |
| FR-008 (one producer per document) | `Producer.document` UNIQUE; `P2002` → 409 |
| FR-009 (name trimmed) | DTO transform |
| FR-013 / FR-014 (area rule, create and update) | `area.rule.ts`, invoked from the service on the post-change record |
| FR-015 (area bounds) | DTO validators |
| FR-016 (exact comparison) | `Decimal(12,2)`, per-field conversion |
| FR-017 (state) | `@IsIn` over the 27 UFs |
| FR-018 / FR-023 (no orphans on create) | FK constraints; missing parent → 404 on the path |
| FR-022 (harvest year) | Validator computing bounds at request time |
| FR-024 / FR-025 (crop naming, duplicates) | `name` + `nameNormalized`, composite UNIQUE |
| FR-026 (paged list with total) | `$transaction([findMany, count])` |
| FR-027 (accent-insensitive search) | `nameSearch` column, indexed |
| FR-028 (nested retrieval) | Nested `include` on `GET /producers/:id` |
| FR-030 – FR-033 (cascade, atomic, no orphans) | `onDelete: Cascade` + one transaction |
| FR-034 (report what was removed) | Counts taken inside the delete transaction |
| FR-038 (documents not logged) | Redact list + log by `producerId` |
