# Data Model: Dashboard Summary

**Feature**: `003-dashboard-api` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

**This feature stores nothing.** No table, no column, no migration — the first in this project to
ship none. What follows is the *read model*: the shape returned to the caller, and the exact rule
that derives every number in it from what `002-rural-producer-crud` already records.

---

## Sources

Everything is derived from three existing tables. Nothing is written to any of them.

| Table | Columns read | Feeds |
|-------|--------------|-------|
| `properties` | `state`, `total_area`, `arable_area`, `vegetation_area` | farm count, hectare total, state breakdown, land-use breakdown |
| `crops` | `name`, `name_normalized` | crop breakdown |
| `harvests` | — | nothing directly; it is the link that decides *which* crops exist |
| `producers` | — | nothing. Producers are not counted (spec Assumptions) |

`producers` appears only to record that it is deliberately unused: a producer with no property
contributes to no figure, which is what US1 §3 asserts.

---

## Read model

```
DashboardSummary
├── totals
│   ├── farms       : integer
│   └── hectares    : string   "1725.47"
├── byState         : Breakdown  (unit: hectares)
├── byCrop          : Breakdown  (unit: count)
└── byLandUse       : Breakdown  (unit: hectares)

Breakdown
├── unit            : "hectares" | "count"
└── categories      : Category[]

Category
├── key             : string    stable machine identifier
├── label           : string    human-readable
└── value           : string | integer   (string when unit is hectares)
```

**Why `unit` is in the payload** (FR-021): a bare `300` beside `"MG"` could be 300 farms or 300
hectares, and a consumer that guesses wrong builds a chart with a wrong axis label. Declaring it
makes the mistake impossible rather than merely unlikely ([R-005](./research.md#r-005)).

**Why hectares are strings**: `1725.47` parsed as a JSON number is not exactly 1725.47, and any
client-side arithmetic reintroduces the drift the server just avoided. Same decision, same reason,
as the property areas in feature 002.

**Why `key` and `label` are separate**: for states they are identical (`"MG"` / `"MG"`), but for
crops they genuinely differ — the key is the normalised form `"soja"`, the label the spelling people
actually use, `"Soja"`. Keeping both means a consumer can group reliably on the key while displaying
the label, and lets the label change later (to full state names, say) without breaking anyone.

---

## Derivation rules

### `totals.farms` (FR-005)

Count of rows in `properties`. Zero on an empty registry.

### `totals.hectares` (FR-006)

`SUM(total_area)` across every property, as `Decimal`, serialised to two decimal places.

**`_sum` returns `null`, not `0`, on an empty table** — measured. It must be coalesced to
`Decimal(0)` before anything touches it, or the first request against a fresh database throws
([R-002](./research.md#r-002)).

### `byState` (FR-008 – FR-011)

`GROUP BY state`, value = `SUM(total_area)` per group.

- One category per federative unit that has at least one property. `GROUP BY` cannot produce an
  empty group, so the 24 units with no properties are absent without any filtering.
- `key` = `label` = the two-letter UF code.
- **Reconciles exactly with `totals.hectares`** — FR-011, and the property that makes the two halves
  of the dashboard trustworthy. Guaranteed by the shared snapshot (R-001), not by luck.
- The registry validates `state` against the 27 UFs and stores it uppercased, so duplicate
  categories cannot arise from data entered through the system. FR-010 still requires normalising on
  read so the breakdown stays correct if data ever arrives another way.

### `byCrop` (FR-012 – FR-017)

`GROUP BY (name_normalized, name)`, counting rows, then reduced per normalised key.

- **Value is a count of crop records**, not hectares. A crop carries no area, and a harvest holding
  soybeans and corn gives no way to split the property's hectares between them — so an
  area-weighted crop chart is not computable from what exists.
- Every crop record counts, **including the same crop in two harvests of one property**. The chart
  describes *plantings*.
- Properties with no harvest, and harvests with no crop, contribute nothing here while still
  counting in full towards `totals` (FR-013). This falls out of reading the `crops` table: a
  property with no crops simply has no rows in it.
- `key` = the normalised name (`"soja"`), which is the same key the registry already uses to stop
  duplicates inside a harvest — so `"Soja"`, `"soja"` and `"SOJA"` collapse into one category while
  `"Soja"` and `"Soya"` stay two.
- `label` = **the most-used spelling**, ties broken alphabetically. Not `MIN(name)`, which returns
  `"SOJA"` over `"Soja"` because uppercase sorts first, surfacing the least-used spelling
  ([R-003](./research.md#r-003)).
- **Does not reconcile with `totals.farms`** and is not meant to (FR-023). Three farms where one
  recorded four crops gives crop categories totalling four.

### `byLandUse` (FR-018 – FR-020)

Three categories, all in hectares, from one aggregate over `properties`:

| key | label (pt-BR) | value |
|-----|---------------|-------|
| `arable` | `Área agricultável` | `SUM(arable_area)` |
| `vegetation` | `Vegetação` | `SUM(vegetation_area)` |
| `unclassified` | `Área não classificada` | `SUM(total_area) − SUM(arable_area) − SUM(vegetation_area)` |

- The three sum exactly to `totals.hectares`, so this chart reconciles with the headline figure.
- **`unclassified` is omitted when it is exactly zero** (FR-022, the shared no-zero rule) — a registry where every property
  fully classifies its land yields a clean two-slice chart rather than an empty third slice.
- The subtraction happens in `Decimal`, never in JavaScript numbers.
- `unclassified` **can never be negative**, because feature 002 guarantees
  `arable + vegetation <= total` for every property. The implementation asserts this rather than
  trusting it: a negative value would mean the registry had been corrupted outside the API, and a
  negative pie slice renders as nonsense ([R-011](./research.md#r-011)).

---

## Rules that apply to every breakdown

- **No zero-valued category, ever** (FR-022). Computed, then filtered, uniformly across all three.
  For state and crop this is automatic; land use is the case that needs it explicitly.
- **Deterministic order**: value descending, then key ascending. `GROUP BY` guarantees no ordering,
  and an unordered result would reshuffle the chart legend between identical requests
  ([R-008](./research.md#r-008), SC-007).
- **One snapshot**: every figure is read inside a single transaction at Repeatable Read, so a write
  landing mid-request cannot make the totals disagree with the breakdowns
  ([R-001](./research.md#r-001), FR-024).
- **Empty registry**: `totals` are `0` and `"0.00"`; every `categories` array is empty; the request
  succeeds (FR-007, FR-020, SC-004).

---

## Worked example

Four properties, one producer, some crops:

| Property | State | Total | Arable | Vegetation |
|----------|-------|-------|--------|------------|
| A | MG | 1000.11 | 600.00 | 300.00 |
| B | MG | 200.00 | 100.00 | 50.00 |
| C | SP | 500.36 | 500.36 | 0.00 |
| D | BA | 25.00 | 0.00 | 0.00 |

Crops recorded: `Soja` in two harvests of A, `SOJA` in a third; `Milho` in two harvests of A.

```json
{
  "totals": { "farms": 4, "hectares": "1725.47" },
  "byState": { "unit": "hectares", "categories": [
    { "key": "MG", "label": "MG", "value": "1200.11" },
    { "key": "SP", "label": "SP", "value": "500.36" },
    { "key": "BA", "label": "BA", "value": "25.00" }
  ]},
  "byCrop": { "unit": "count", "categories": [
    { "key": "soja",  "label": "Soja",  "value": 3 },
    { "key": "milho", "label": "Milho", "value": 2 }
  ]},
  "byLandUse": { "unit": "hectares", "categories": [
    { "key": "arable",       "label": "Área agricultável",     "value": "1200.36" },
    { "key": "vegetation",   "label": "Vegetação",             "value": "350.00" },
    { "key": "unclassified", "label": "Área não classificada", "value": "175.11" }
  ]}
}
```

Every figure above was produced by running these exact rows through the real database during
planning. Three things to notice:

- `byState` sums to `1725.47` — the hectare total exactly.
- `byLandUse` also sums to `1725.47`, because `unclassified` closes the gap left by properties C
  and D.
- `byCrop` totals **5**, which matches neither the farm count (4) nor anything else. That is
  correct: it counts plantings, and `"SOJA"` folded into `"soja"` while the label kept the
  spelling used twice.

---

## Requirement coverage

| Requirement | Where it is satisfied |
|-------------|----------------------|
| FR-005 / FR-006 (totals) | `COUNT` and `SUM(total_area)`, coalesced |
| FR-007 / FR-020 (empty registry) | `null` coalesced to `Decimal(0)`; empty category arrays |
| FR-008 – FR-010 (state breakdown) | `GROUP BY state`; UF code as key and label |
| FR-011 (reconciles) | Shared snapshot + `SUM` over the same rows |
| FR-012 – FR-015 (crop breakdown) | `GROUP BY (name_normalized, name)`; count of records |
| FR-016 (label rule) | Most-used spelling, tie alphabetical |
| FR-017 (plantings) | Every crop row counts, repeats included |
| FR-018 / FR-019 (land use) | Three sums; remainder as `unclassified` |
| FR-021 (units declared) | `unit` field on every breakdown |
| FR-022 (no zero categories) | One shared filter after computation |
| FR-023 (crop chart not comparable) | Stated in the OpenAPI description |
| FR-024 (one snapshot) | Single Repeatable Read transaction |
| FR-025 (documented in API docs) | [contracts/openapi.yaml](./contracts/openapi.yaml) |
| FR-027 (no personal data) | No producer field is read or returned |
