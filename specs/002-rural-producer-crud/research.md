# Phase 0 Research: Rural Producer Registry

**Feature**: `002-rural-producer-crud` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

Decisions taken before design, with the alternatives rejected. Unlike feature `001-user-auth`, this
one lands on an **existing codebase**, so several decisions are about what to reuse rather than what
to build. Three (R-001, R-003, R-008) are called out again in the plan.

---

## R-001: Area arithmetic must never touch a JavaScript number

**Decision**: Store areas as `Decimal(12,2)` in Postgres and `Prisma.Decimal` in code. Convert
**each field separately** to `Decimal` at the DTO boundary, then do all comparison in Decimal space.
Never add two areas as JS numbers, not even once.

**Rationale**: FR-016 says a comparison must never pass or fail because of binary floating-point
drift. This is not theoretical — I measured it at realistic farm sizes:

```
arable = 1000 ha,  vegetation = 500.11 ha,  total = 1500.11 ha
    JS:  1000 + 500.11        = 1500.1100000000001   ->  > total  ->  REJECTED
Decimal:  D(1000).plus(D(500.11)) = 1500.11          ->  = total  ->  ACCEPTED
```

A farm of 1000 ha arable and 500.11 ha vegetation on a 1500.11 ha property is perfectly ordinary and
the naive implementation refuses to record it, with an error message that makes no sense to the
person typing it. The failures cluster on values ending in `.11`, `.36`, `.61`, `.86` — common
enough that this would be reported as a bug within days of launch.

**The subtlety that makes this a design rule rather than a library choice**: `Decimal` only helps if
the number never gets added first. `new Decimal(a + b)` inherits the drift, because the addition
already happened in double precision. `new Decimal(a).plus(new Decimal(b))` does not, because
`Decimal`'s constructor goes through the number's shortest round-trip string — `1000.11` in, not
`1000.1100000000001`. So the rule is *per-field conversion at the boundary*, enforced by the DTO
carrying `Prisma.Decimal`, never `number`, past validation.

**Alternatives considered**:

- *Store areas as integers in ares (1/100 ha)* — exact, and avoids decimals entirely. Rejected: it
  pushes a unit conversion into every read and write, and the first place someone forgets it is a
  silent 100× error in a land-area figure.
- *Accept areas as strings in the API* — sidesteps JSON's double parsing entirely. Rejected as
  needless friction for clients; per-field conversion already closes the hole, and
  `@IsNumber({ maxDecimalPlaces: 2 })` rejects anything a client could sneak through.
- *Compare with an epsilon tolerance* — rejected outright. It replaces one wrong answer with
  another: an epsilon large enough to absorb drift also accepts a farm that genuinely overflows by a
  sliver.

---

## R-002: CPF and CNPJ validation is written here, not installed

**Decision**: Implement check-digit validation in `src/common/validation/document.ts` as a pure
function plus a `class-validator` constraint. No third-party document library.

**Rationale**: The algorithm is about forty lines, is fixed by law, and never changes. Against that,
a dependency in this position is a poor trade: it sits on the path of every producer write, and it
is exactly the kind of small, single-purpose package that gets abandoned or hijacked. Writing it
also means the repeated-digit rule (FR-006) is visibly ours rather than something we hope the
library does.

Verified against the spec's own examples before committing to it:

| Document | Result |
|----------|--------|
| `529.982.247-25` / `52998224725` | valid — punctuation is irrelevant after normalisation |
| `529.982.247-24` (last digit changed) | invalid |
| `111.111.111-11`, `000.000.000-00` | invalid — caught by the repeated-digit guard |
| `123.456.789-00` | invalid |
| `11.222.333/0001-81` | valid |
| `11.222.333/0001-82` | invalid |

**The repeated-digit guard is load-bearing.** `111.111.111-11` *passes* the check-digit arithmetic —
every weighted sum works out — which is why so many naive implementations accept it. It is rejected
by an explicit rule, not by the checksum, and FR-006 exists because that rule is so easy to omit.

**Alternatives considered**:

- *`cpf-cnpj-validator` or similar* — fine packages, but see above. The [R-010 boundary from feature
  001](../001-user-auth/research.md#r-010) permits ordinary libraries; permitting is not requiring.
- *Regex-only length check* — what FR-005 explicitly forbids.

---

## R-003: Alphanumeric CNPJ — a live risk, not a design decision

**Decision**: Build the validator to the numeric 14-digit rule the spec states, but isolate it
behind one function so the rule can change in one place. **Flag for verification before launch.**

**Rationale**: Brazil has been moving to an **alphanumeric CNPJ** format, with the rollout scheduled
to begin during 2026. Under it, the first twelve characters may include letters while the two check
digits stay numeric, and the checksum is computed on each character's ASCII value minus 48 (so `0`–`9`
behave exactly as today, keeping every existing CNPJ valid).

I am flagging rather than implementing this: my information may be out of date, and the exact status
and start date need confirming against Receita Federal before anyone relies on it. What matters for
the plan is the consequence if it is live — **the system would reject newly issued, entirely valid
CNPJs**, and the failure would look like a data-entry error to the user rather than a defect.

**Action**: confirm the current status before this feature is exposed to real producers. The design
cost of being wrong is low — `isValidCnpj` is one function and one fixture set — but only if the
validation is not scattered across DTOs, which is why R-002 puts it in a single module.

---

## R-004: Cascade delete belongs to the database, the count does not

**Decision**: Declare `onDelete: Cascade` on the Prisma relations, so Postgres removes descendants.
Wrap the delete in `prisma.$transaction`, counting descendants *before* the delete inside the same
transaction, and return those counts (FR-034).

**Rationale**: FR-032 requires all-or-nothing. A database-level cascade is atomic by construction —
one statement, one transaction, no partial state possible. Deleting children in application code
means N statements and a real window in which a crash leaves the orphans FR-033 forbids.

The counts cannot come from the cascade itself: Postgres reports rows deleted from the target table
only. So the transaction is: count properties, harvests and crops for this producer → delete the
producer → return the counts. Reading and writing in one transaction is what makes the reported
numbers true rather than approximately true.

**Alternatives considered**:

- *Application-level recursive delete* — more code, weaker guarantee. Rejected.
- *`onDelete: Restrict` plus manual cascade* — combines the disadvantages of both.
- *Counting after deletion* — impossible; the rows are gone.

---

## R-005: Accent-insensitive search via a stored normalised column

**Decision**: Store `nameSearch` on `Producer` alongside `name` — lowercased and stripped of
diacritics — maintained by the repository on create and update. Search with a plain `contains` on
that column, indexed.

**Rationale**: FR-027 requires searching "josé" by typing "jose". Postgres can do this with the
`unaccent` extension, but `unaccent()` is not `IMMUTABLE`, so it cannot back a functional index
without a wrapper, and Prisma's type-safe query API cannot express it at all — every search becomes a
raw query, losing the typing the constitution's Principle III leans on.

A stored normalised column keeps the query inside Prisma, indexes cleanly, and costs one `String`
column. Its weakness is honest and worth stating: it is denormalised, so it is wrong the moment
someone updates `name` without updating `nameSearch`. That is why normalisation lives in
`ProducersRepository` — the single place that writes the row — rather than in a service that a future
caller could bypass.

`String.prototype.normalize('NFD')` with a combining-marks strip handles Portuguese diacritics
without a dependency.

**Alternatives considered**:

- *`unaccent` extension + raw SQL* — correct, but raw queries on the main list endpoint, and an
  extension to install in every environment. Rejected for this volume.
- *`pg_trgm` fuzzy search* — solves a problem nobody asked for (FR-027 wants substring, not
  similarity) at the cost of an extension and a much larger index.
- *Filtering in application code* — cannot page correctly, and loads the table. Rejected.

---

## R-006: Offset pagination, with the total

**Decision**: `?page` and `?pageSize` (default 20, max 100), returning `{ data, total, page,
pageSize }` from a `$transaction([findMany, count])`.

**Rationale**: FR-026 requires the total count so the caller knows what lies beyond the page, which
rules out cursor pagination — cursors cannot cheaply produce a total. SC-007 asks for the first page
of 10,000 producers in under a second; an indexed `LIMIT/OFFSET` with a `COUNT(*)` over 10,000 rows
is nowhere near that limit.

Offset pagination degrades on deep pages (`OFFSET 100000` scans and discards). At the stated scale
this is irrelevant, and it is recorded here so that if the registry reaches millions the reason to
revisit is already written down.

---

## R-007: Almost all of the security requirement is already satisfied

**Decision**: Add **no** authentication code. FR-001 is met by the existing global `JwtAuthGuard`
from feature 001; new routes are protected because they simply do not carry `@Public()`.

**Rationale**: This is the payoff of [R-007 in feature 001](../001-user-auth/research.md#r-007). The
`APP_GUARD` denies by default, so every producer, property, harvest and crop route is protected the
moment it exists, without anyone remembering to protect it. The integration test that proves an
undecorated route returns 401 already exists and covers these routes by construction.

**FR-002 (shared registry, no roles) means there is no ownership column and no scoping filter.** That
is not an omission to fix later — it is what the spec chose, and adding a `createdBy` column "just in
case" would imply a scoping rule the system does not implement. What *is* worth carrying forward is
that `@CurrentUser()` already yields the acting user, so FR-037's audit logging has the actor without
any new plumbing.

---

## R-008: Integration tests for this feature run against a real database

**Decision**: Depart from feature 001's tier-1 pattern. The integration suite for **this** feature
boots the real `AppModule` against the disposable Postgres from `docker-compose.test.yml`. The
existing `FakePrismaService` stays, unchanged, serving feature 001's suites.

**Rationale**: [R-009 in feature 001](../001-user-auth/research.md#r-009) put integration tests
against an in-memory Prisma fake, and for three simple models with `findUnique`/`create`/`count` that
was cheap and fast. This feature is a different shape:

| What the tests must exercise | What a fake would have to reimplement |
|------------------------------|----------------------------------------|
| Cascade delete atomicity (FR-032) | Referential actions and transaction rollback |
| Unique document under concurrency (FR-008) | Constraint enforcement under parallel writes |
| Unique crop per harvest (FR-025) | Composite unique constraints |
| Paged list with total (FR-026) | `LIMIT`/`OFFSET` plus `COUNT` semantics |
| Nested retrieval (FR-028) | Multi-level joins |

Extending the fake to cover these means writing a small database — and the parts hardest to fake are
exactly the parts under test. A fake that got cascade rollback subtly wrong would report green while
production silently created orphans. That is worse than no test.

The constitutional footing is unchanged: Principle IV forbids depending on **external real state**,
read in feature 001 as *state the test does not own*. A Postgres container the test run creates and
destroys is owned, isolated and reproducible. This feature simply leans on that reading harder.

**Cost, stated plainly**: this suite needs a container running, so it is slower than feature 001's
and cannot run on a machine without Docker. Mitigated by keeping it one `docker compose` line, and by
the unit tier — where every business rule lives — staying pure and instant.

**Alternatives considered**:

- *Extend `FakePrismaService`* — the fake roughly triples in size and becomes the least trustworthy
  code in the repository. Rejected.
- *Test cascades only in the persistence tier, fake the rest* — splits one endpoint's behaviour
  across two tiers with different fidelity, so a reviewer cannot tell what a green suite proves.

---

## R-009: Partial updates validate the record as it will be, not the payload

**Decision**: Every update loads the stored record, applies the submitted fields to a copy, and
validates **that**. The area rule then runs against the post-change state.

**Rationale**: FR-014 and US5 §3. A property with total 100, arable 60, vegetation 30 is valid.
`PATCH { totalArea: 80 }` submits one field, which in isolation is a perfectly good number — but the
record it produces has 60 + 30 > 80. Validating only what was submitted accepts it and corrupts the
row. This is the single most likely way FR-013 gets bypassed after it is implemented.

It follows that the rule cannot live in the DTO: a DTO sees only the payload. It belongs in
`PropertiesService`, which can read the current row. `class-validator` handles field shapes; the
service handles the invariant.

---

## R-010: Crop duplicates are prevented by a constraint, not a lookup

**Decision**: Store `nameNormalized` on `Crop` (trimmed, inner whitespace collapsed, lowercased,
diacritics stripped) with a composite unique constraint on `(harvestId, nameNormalized)`. Map the
resulting `P2002` to a 409.

**Rationale**: Same reasoning as the producer document in feature 001 — a check-then-insert is a
race, and FR-025 is a uniqueness rule, so it belongs to the database. Normalising into a stored
column is what lets a *case- and accent-insensitive* rule be expressed as a plain unique index.

`name` keeps the caller's capitalisation for display (FR-024); `nameNormalized` exists only to be
compared. So "Soja" and "soja" collide as FR-025 requires, while "Soja" and "Soya" do not — the
accepted cost of free-text naming, recorded in the spec's Assumptions.

---

## R-011: State codes are a constant, not a database enum

**Decision**: A frozen 27-entry array of federative units in `src/common/constants/brazilian-states.ts`,
enforced with `@IsIn(...)`. The column is `VarChar(2)`.

**Rationale**: The list has not changed since 1988 and will not change without a constitutional
amendment, so it needs no table. A Prisma enum would work but makes every future change a migration
for no benefit, and enum values leak into the generated client in a way that complicates seeding
fixtures.

---

## R-012: The document must not reach the logs

**Decision**: Add `document`, `cpf`, `cnpj` and `nameSearch` to the existing pino `redact` list, and
log producers by `producerId` only.

**Rationale**: FR-038. CPF is personal data under the LGPD, and a log aggregator is precisely where
it should not accumulate. Feature 001 already established the pattern — never pass the value to a
logger, *and* redact as a mechanical backstop — and the existing `log-leak.spec.ts` gate extends to
cover document patterns with one added regex rather than a new mechanism.

---

## R-013: Flat writes, nested reads

**Decision**: Writes address one resource each — `POST /producers`, `POST /producers/:id/properties`,
`POST /properties/:id/harvests`, `POST /harvests/:id/crops`. Reads are nested:
`GET /producers/:id` returns the producer with its properties, harvests and crops.

**Rationale**: The hierarchy is strict (Producer → Property → Harvest → Crop), so a nested write path
makes the parent unambiguous and gives FR-018 and FR-023 a natural home — a missing parent is a 404
on the path, not a validation error about a field.

Reads go the other way because FR-028 asks for the whole picture in one response, and because the
alternative is four round trips to render one producer.

Accepting a fully nested *write* (a producer with properties and crops in one payload) was rejected:
nothing in the spec asks for it, partial-failure semantics get ugly, and it would make the
per-resource validation rules harder to test in isolation.

---

## Resolved unknowns summary

| Unknown | Resolution |
|---------|-----------|
| Area precision and comparison | Decimal(12,2), per-field conversion, never add as numbers (R-001) |
| Document validation | Own check-digit implementation + repeated-digit guard (R-002) |
| Alphanumeric CNPJ | **Verify before launch**; isolated behind one function (R-003) |
| Cascade delete and reporting | DB-level cascade, counts inside the transaction (R-004) |
| Accent-insensitive search | Stored `nameSearch` column, repository-maintained (R-005) |
| Pagination | Offset + total, default 20 / max 100 (R-006) |
| Authentication work required | None — inherited from feature 001 (R-007) |
| Integration test fidelity | Real Postgres for this feature; fake stays for 001 (R-008) |
| Partial update validation | Load, merge, validate post-change state in the service (R-009) |
| Duplicate crops | Composite unique on `(harvestId, nameNormalized)` (R-010) |
| State codes | Frozen constant + `@IsIn` (R-011) |
| Document in logs | Redact list + log by id (R-012) |
| API shape | Flat writes, nested reads (R-013) |
