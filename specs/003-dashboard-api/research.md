# Phase 0 Research: Dashboard Summary

**Feature**: `003-dashboard-api` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

Decisions taken before design, with the alternatives rejected. This feature stores nothing and
changes nothing — it is entirely a question of *how the numbers are computed*, so most decisions
below were settled by measuring against a real database rather than by argument. Three (R-001,
R-003, R-004) are carried into the plan.

---

## R-001: One endpoint, one transaction, at Repeatable Read

**Decision**: A single `GET /dashboard` computing every figure inside one
`prisma.$transaction(fn, { isolationLevel: RepeatableRead })`.

**Rationale**: FR-024 requires every figure in a response to come from one consistent view, and
FR-011 requires the state breakdown to sum exactly to the hectare total. The obvious
implementation — fire the queries with `Promise.all` — breaks both, subtly and rarely.

PostgreSQL defaults to **Read Committed**, where *each statement* takes a fresh snapshot. Four
independent queries therefore see four different points in time. A property inserted between the
`count` and the `groupBy` produces a response whose slices do not add up to its own total, and
nothing in the code looks wrong. The failure is invisible in testing and only appears under
concurrent writes.

Repeatable Read pins one snapshot for the whole transaction, so the arithmetic is guaranteed rather
than usually true. Verified working against the real database, and the cost is nil for read-only
work — no locks are taken, and the measured time is unchanged.

**Alternatives considered**:

- *`Promise.all` of independent queries* — faster to write, marginally faster to run, and wrong in
  exactly the way that is hardest to reproduce. Rejected.
- *One hand-written SQL statement producing everything* — genuinely consistent, but a single query
  with several unrelated aggregates and lateral joins is far harder to read and to test than four
  named ones, and gives up Prisma's typing (Principle III). Rejected.
- *Separate endpoints per chart* — cannot satisfy FR-024 at all: four HTTP calls are four
  snapshots. Also contradicts SC-001, which asks for the whole picture in one request.

---

## R-002: Empty aggregates return `null`, and must be coalesced

**Decision**: Every `_sum` is read through a helper that turns `null` into `Decimal(0)`.

**Rationale**: Measured, not assumed. On an empty table Prisma returns:

```
_count       -> 0            (fine)
_sum.totalArea -> null       (NOT 0)
groupBy      -> []           (fine)
```

FR-007 and FR-020 require an empty registry to report zeroes and succeed. Reading `_sum.totalArea`
directly on an empty registry yields `null`, and `null.toFixed(2)` throws — so the naive
implementation does not return a wrong number, it returns a **500 on a brand-new installation**.
That is the very first thing anyone will see after deploying, which is why SC-004 makes it a
release criterion.

The count and the groupBy behave sensibly, which is exactly what makes this easy to miss: three of
the four aggregate shapes are safe.

---

## R-003: The crop label is the most-used spelling, not the alphabetically first

**Decision**: Group crops by `(nameNormalized, name)` in one query, then reduce in the service:
sum the counts per normalised key, and pick as the label the spelling with the highest count,
breaking ties alphabetically.

**Rationale**: FR-016 demands a *deterministic, stated* rule, and FR-015 requires spelling variants
to collapse into one category. The tempting one-liner is Prisma's `_min: { name: true }` — group by
the normalised key and take the smallest name. Measured against real rows:

| Records | `_min(name)` | Most-used |
|---------|--------------|-----------|
| "Soja" x2, "SOJA" x1 | **"SOJA"** | **"Soja"** |

`_min` picks `"SOJA"` because uppercase sorts before lowercase in ASCII — so the label shown to
users is the *least* representative spelling, one record out of three. It satisfies "deterministic"
and fails "sensible".

The two-column groupBy costs one query of the same size and lets the service pick the spelling
people actually use. The intermediate result is bounded by the number of distinct
*(crop, spelling)* pairs, which is tiny — 10 rows in the 180,000-crop benchmark.

**Known quirk, accepted**: on an exact tie the alphabetical tie-break wins, so one "Café" and one
"Cafe" yields the unaccented `"Cafe"`. Deterministic and stable across requests, which is what
SC-007 requires; prettier rules (prefer accents, prefer most recent) are either non-deterministic
or arbitrary in their own way.

---

## R-004: No new indexes — measured, not assumed

**Decision**: Add no index. The dashboard runs against the schema exactly as feature 002 left it,
and this feature ships no migration at all.

**Rationale**: SC-002 asks for under two seconds at 10,000 properties, 50,000 harvests and 150,000
crops. Seeded exactly that (180,000 crops in the end) and measured the full transaction:

```
run 1:  39ms     run 2:  34ms     run 3:  32ms
```

Roughly **35 ms against a 2,000 ms budget** — about fifty times the headroom. Adding an index would
be optimising something already two orders of magnitude inside its target.

The deeper reason an index would not help anyway: these are **unfiltered** aggregates over whole
tables. `GROUP BY state` across every property and `GROUP BY name_normalized` across every crop
must visit every row regardless, so PostgreSQL sequentially scans and hash-aggregates. An index on
`crops.name_normalized` would accelerate a *filtered* lookup — which this feature never does — while
costing write time on every crop insert and disk on a 180,000-row table. It is a cost with no
matching benefit.

**Recorded trigger to revisit**: if a later feature adds filtering (by state, by producer, by
period), the access pattern changes completely and indexing should be reconsidered then, on that
feature's evidence rather than this one's.

---

## R-005: Every breakdown declares its own unit

**Decision**: Each breakdown carries an explicit `unit` field — `"hectares"` or `"count"` — beside
its categories. Hectares are serialised as **strings** (`"1725.47"`), counts as integers.

**Rationale**: FR-021. The state chart is measured in hectares and the crop chart in records, and
nothing about a bare number `300` says which it is. A consumer that guesses wrong builds a chart
labelled "300 farms in MG" when the truth is "300 hectares". Declaring the unit in the payload
makes that impossible rather than merely unlikely.

Hectares as strings follows feature 002's decision for the same reason: `1725.47` parsed as a JSON
number is not exactly 1725.47, and any client-side arithmetic reintroduces the drift the server
just avoided. Counts are integers because they genuinely are.

---

## R-006: No percentages in the payload

**Decision**: Return absolute values only. The frontend computes proportions.

**Rationale**: FR-008 and FR-012 ask for data renderable "without further calculation", which
tempts one to include a percentage per slice. Two reasons not to:

- Percentages rounded to two decimals **do not sum to 100**. Three equal slices give 33.33 x 3 =
  99.99, and the frontend must then decide where to put the missing hundredth — a decision the
  backend cannot make on its behalf.
- Every charting library computes slice angles from raw values. A percentage is redundant input
  that can *disagree* with the value beside it once rounding enters.

"Without further calculation" is satisfied: the values are final, aggregated and ready to plot. The
proportion is a rendering concern.

---

## R-007: Zero-valued categories are filtered out after computation

**Decision**: Compute each breakdown, then drop any category whose value is zero, uniformly across
all three. The unclassified land-use category is subject to the same filter as the other two.

**Rationale**: FR-022. This is the user's own refinement on the land-use chart generalised: an empty
slice conveys nothing and renders as a visual artefact or a stray legend entry.

For state and crop it happens naturally — `GROUP BY` cannot produce a group with no rows, so the 24
federative units with no properties are already absent. Land use is the case that needs the
explicit filter, because arable, vegetation and unclassified are *computed*, not grouped, and a
registry where every property fully classifies its land yields an unclassified value of exactly
zero. One shared filter keeps all three consistent and means the rule is implemented once.

---

## R-008: Deterministic ordering

**Decision**: Sort every breakdown by value descending, then by key ascending as a tie-break.

**Rationale**: SC-007 requires two requests over unchanged data to return identical results.
`GROUP BY` gives no ordering guarantee — PostgreSQL may return hash-aggregate groups in any order,
and that order can change as the table grows or after a vacuum. Without an explicit sort the
dashboard would occasionally reshuffle its own legend for no reason, which reads as a bug.

Value-descending is also what a pie chart wants: the biggest slice first. The key tie-break makes
equal-valued categories stable rather than incidental.

---

## R-009: No authentication code, again

**Decision**: Write none. FR-001 is satisfied by the global `JwtAuthGuard`, because the dashboard
controller simply does not carry `@Public()`.

**Rationale**: Third feature running, same payoff from
[R-007 in feature 001](../001-user-auth/research.md#r-007). Worth restating only because "we wrote
no security code" should read as a design working, not as an omission — and because the contract
test added in feature 002 already asserts that no operation is public.

---

## R-010: Tests run against the real database

**Decision**: Integration tests live in the `integration-db` tier against the disposable Postgres.
Pure logic — the label reduction, the zero filter, the sort — is unit-tested with no database.

**Rationale**: The behaviour under test *is* the aggregation: `GROUP BY` semantics, `_sum`
returning null, decimal exactness, snapshot isolation. Every one of those is a property of
PostgreSQL, so an in-memory fake would be testing a reimplementation of the thing that could be
wrong. Same reasoning as [R-008 in feature 002](../002-rural-producer-crud/research.md#r-008),
which established the tier this feature reuses.

The split is worth keeping though: the crop-label rule and the zero filter are pure functions over
already-fetched rows, and testing those without a database keeps the interesting edge cases —
ties, accents, empty inputs — fast and exhaustive.

---

## R-011: The unclassified remainder can never be negative, and that is an inherited guarantee

**Decision**: Compute unclassified as `sum(total) - sum(arable) - sum(vegetation)` and **assert**
it is not negative, failing loudly rather than emitting a negative slice.

**Rationale**: Feature 002's FR-013 guarantees `arable + vegetation <= total` for every property,
so the sum of remainders is necessarily zero or positive. The dashboard depends on that invariant
holding, and a negative value here would mean the registry itself had been corrupted — by a direct
database write, a failed migration, or a regression in the area rule.

A negative pie slice is nonsense that a chart library will render as something arbitrary. Failing
with a logged error is the honest response: the dashboard is not the right place to paper over
broken data, and this is the only place that would notice.

---

## R-012: State categories stay as the two-letter code

**Decision**: `key` and `label` are both the UF code (`"MG"`). No lookup to full state names.

**Rationale**: The registry stores only the code, and a chart legend reading "MG / SP / BA" is
entirely idiomatic for a Brazilian audience. Adding a 27-entry code-to-name table would be inventing
presentation data in the backend for a frontend that has not been built yet, and the frontend can
map codes to names if it wants them. The `key`/`label` pair is kept in the payload anyway — for
crops the two genuinely differ — so nothing prevents the label becoming a full name later.

---

## Resolved unknowns summary

| Unknown | Resolution |
|---------|-----------|
| Read consistency across figures | One transaction at Repeatable Read (R-001) |
| Empty-registry behaviour | `_sum` returns **null**; coalesce to `Decimal(0)` (R-002) |
| Crop display label | Most-used spelling, tie alphabetical — **not** `_min` (R-003) |
| Performance / indexing | ~35 ms measured at full scale; **no index** (R-004) |
| Units in the payload | Declared per breakdown; hectares as strings (R-005) |
| Percentages | Not returned; frontend computes them (R-006) |
| Zero categories | Filtered uniformly after computation (R-007) |
| Ordering stability | Value desc, key asc (R-008) |
| Authentication work | None — inherited (R-009) |
| Test tier | `integration-db` plus pure unit tests (R-010) |
| Negative unclassified | Impossible by inherited invariant; assert anyway (R-011) |
| State labels | UF code (R-012) |
