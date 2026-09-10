# Quickstart & Validation Guide: Dashboard Summary

**Feature**: `003-dashboard-api` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

How to run the feature and prove it works. Scenario numbers map to the acceptance scenarios in
[spec.md](./spec.md); requirement ids map to its functional requirements.

> Validation guide, not an implementation guide. Implementation steps come from `/speckit-tasks`.

---

## Prerequisites

- The stack from `001-user-auth` and `002-rural-producer-crud` — this feature adds no table and no
  migration, and reads what the registry already holds.

## Setup

```bash
docker compose up -d
docker compose exec api npx prisma migrate deploy   # nothing new to apply for this feature
```

Every request needs a token:

```bash
CRED='{"email":"operador@agrohub.com.br","password":"SenhaSegura1"}'
curl -s -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' -d "$CRED" >/dev/null
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d "$CRED" | jq -r .accessToken)
AUTH="Authorization: Bearer $TOKEN"
JSON="Content-Type: application/json"
```

---

## Automated validation

```bash
docker compose exec api npm run test:unit             # label rule, zero filter, sort
docker compose -f docker-compose.test.yml up -d
docker compose exec api npm run test:integration-db   # the aggregation itself, real Postgres
docker compose exec api npm run test:security         # contract drift, log-leak gate
```

---

## Manual validation

### 1. Protected, with no auth code of its own — FR-001

```bash
curl -s -o /dev/null -w 'no token: %{http_code}\n' http://localhost:3000/api/dashboard
```

**Expect** `401`. The dashboard carries no `@Public()`, so the global guard from feature 001 covers
it. Nothing about authentication was written for this feature.

### 2. Empty registry returns zeroes, not an error — US1 §2, FR-007, SC-004

Against a registry with no properties:

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq
```

**Expect** `200` with `farms: 0`, `hectares: "0.00"` and three empty `categories` arrays.

**A `500` here is the specific failure this check exists for.** Prisma's `_sum` returns `null` —
not `0` — on an empty table, so reading it directly and formatting it throws. That makes the very
first request against a fresh installation fail ([R-002](./research.md#r-002)).

### 3. Seed a known registry

```bash
PID=$(curl -s -X POST http://localhost:3000/api/producers -H "$AUTH" -H "$JSON" \
  -d '{"document":"529.982.247-25","name":"José Antônio"}' | jq -r .id)

mkprop () { curl -s -X POST http://localhost:3000/api/producers/$PID/properties -H "$AUTH" -H "$JSON" \
  -d "{\"farmName\":\"$1\",\"city\":\"Uberaba\",\"state\":\"$2\",\"totalArea\":$3,\"arableArea\":$4,\"vegetationArea\":$5}" | jq -r .id; }

A=$(mkprop A MG 1000.11 600 300)
B=$(mkprop B MG 200 100 50)
C=$(mkprop C SP 500.36 500.36 0)
D=$(mkprop D BA 25 0 0)
```

Totals to expect: **4 farms**, **1725.47 ha**, arable 1200.36, vegetation 350.00, unclassified
175.11.

### 4. Headline totals — US1 §1, FR-005, FR-006

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.totals'
```

**Expect** `{ "farms": 4, "hectares": "1725.47" }`. Note the areas include `1000.11` and `500.36` —
values chosen because they drift under naive floating-point addition. A total of
`1725.4700000000003` means the sum is being done in JavaScript numbers rather than decimals.

### 5. State breakdown is hectares, and reconciles — US2 §1, §5, FR-011

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.byState'
```

**Expect** `unit: "hectares"` and three categories: MG `1200.11`, SP `500.36`, BA `25.00`, in that
order (largest first).

Then check the reconciliation that makes the dashboard trustworthy:

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '
  (.byState.categories | map(.value | tonumber) | add) as $slices
  | { slices: $slices, total: (.totals.hectares | tonumber), match: ($slices == (.totals.hectares | tonumber)) }'
```

**Expect** `match: true`. A mismatch means the figures came from different snapshots
([R-001](./research.md#r-001)).

### 6. The 24 empty states are absent, not zero — US2 §2, FR-022

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.byState.categories | length'
```

**Expect** `3`, not `27`. An empty slice carries no information and renders as a stray legend entry.

### 7. Land use, including the remainder — US4 §3, FR-019

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.byLandUse'
```

**Expect** three categories — arable `1200.36`, vegetation `350.00`, unclassified `175.11` — which
sum exactly to `1725.47`, the hectare total.

### 8. The unclassified slice disappears when it is zero — US4 §2, FR-022, SC-011

Delete the properties that leave a remainder, keeping only one whose land is fully classified:

```bash
for p in $A $B $D; do curl -s -o /dev/null -X DELETE http://localhost:3000/api/properties/$p -H "$AUTH"; done
curl -s -X PATCH http://localhost:3000/api/properties/$C -H "$AUTH" -H "$JSON" \
  -d '{"totalArea":500.36,"arableArea":500.36,"vegetationArea":0}' >/dev/null
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.byLandUse.categories | map(.key)'
```

**Expect** `["arable"]` — vegetation is zero, unclassified is zero, and both are omitted. A result
containing `"unclassified"` with value `"0.00"` means the zero filter is missing.

### 9. Crops: each one counts, repeats included — US3 §1, §6, FR-014, FR-017

Re-seed a property, then record crops across two harvests:

```bash
P=$(mkprop E MG 100 60 40)
H1=$(curl -s -X POST http://localhost:3000/api/properties/$P/harvests -H "$AUTH" -H "$JSON" -d '{"year":2021}' | jq -r .id)
H2=$(curl -s -X POST http://localhost:3000/api/properties/$P/harvests -H "$AUTH" -H "$JSON" -d '{"year":2022}' | jq -r .id)

curl -s -o /dev/null -X POST http://localhost:3000/api/harvests/$H1/crops -H "$AUTH" -H "$JSON" -d '{"name":"Soja"}'
curl -s -o /dev/null -X POST http://localhost:3000/api/harvests/$H1/crops -H "$AUTH" -H "$JSON" -d '{"name":"Milho"}'
curl -s -o /dev/null -X POST http://localhost:3000/api/harvests/$H2/crops -H "$AUTH" -H "$JSON" -d '{"name":"Soja"}'
curl -s -o /dev/null -X POST http://localhost:3000/api/harvests/$H2/crops -H "$AUTH" -H "$JSON" -d '{"name":"SOJA"}' # 409, already in H2

curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.byCrop'
```

**Expect** `unit: "count"`, soja `2` (once per harvest) and milho `1`. Two crops in one harvest both
count; the same crop in two harvests counts twice.

### 10. Spelling variants collapse, and the label is the one people use — US3 §4, FR-015, FR-016

```bash
H3=$(curl -s -X POST http://localhost:3000/api/properties/$P/harvests -H "$AUTH" -H "$JSON" -d '{"year":2023}' | jq -r .id)
curl -s -o /dev/null -X POST http://localhost:3000/api/harvests/$H3/crops -H "$AUTH" -H "$JSON" -d '{"name":"SOJA"}'
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.byCrop.categories[] | select(.key=="soja")'
```

**Expect** one category, `key: "soja"`, `value: 3`, and **`label: "Soja"`** — the spelling used
twice, not `"SOJA"` used once.

**A label of `"SOJA"` means the implementation used `MIN(name)`**, which picks the alphabetically
first spelling and therefore surfaces the least-used one, because uppercase sorts before lowercase
([R-003](./research.md#r-003)).

### 11. "Soja" and "Soya" stay separate — US3 §5

```bash
curl -s -o /dev/null -X POST http://localhost:3000/api/harvests/$H3/crops -H "$AUTH" -H "$JSON" -d '{"name":"Soya"}'
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.byCrop.categories | map(.key)'
```

**Expect** both `"soja"` and `"soya"`. They are different words, and the registry has never claimed
to know they mean the same plant.

### 12. A property with no crops counts in the totals but not the crop chart — US3 §2, FR-013

```bash
Q=$(mkprop F SP 400 200 100)
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '{farms: .totals.farms, hectares: .totals.hectares, cropTotal: (.byCrop.categories | map(.value) | add)}'
```

**Expect** the farm count and hectares to include property F, while the crop totals are unchanged.
Both facts must hold in the same response.

### 13. The crop chart deliberately does not reconcile — US3 §7, FR-023

Compare the crop total with the farm count. **Expect them to differ**, and that is correct: one
counts plantings, the other counts farms. If a future change makes them equal, something has
started dropping crop records.

### 14. Two identical requests return identical results — SC-007

```bash
a=$(curl -s http://localhost:3000/api/dashboard -H "$AUTH"); b=$(curl -s http://localhost:3000/api/dashboard -H "$AUTH")
[ "$a" = "$b" ] && echo "identical" || { echo "DIFFERENT:"; diff <(echo "$a" | jq -S .) <(echo "$b" | jq -S .); }
```

**Expect** `identical`. `GROUP BY` guarantees no ordering, so without an explicit sort the legend
would reshuffle between identical requests ([R-008](./research.md#r-008)).

### 15. The dashboard tracks deletions immediately — US1 §5, FR-004

```bash
curl -s -X DELETE http://localhost:3000/api/producers/$PID -H "$AUTH" | jq '.deleted'
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.totals'
```

**Expect** the cascade report, then `farms: 0` and `hectares: "0.00"`. No cache, no snapshot, no
stale figure.

### 16. Performance at scale — SC-002

Seed 10,000 properties, 50,000 harvests and 150,000 crops, then:

```bash
for i in 1 2 3; do curl -s -o /dev/null -w "run $i: %{time_total}s\n" http://localhost:3000/api/dashboard -H "$AUTH"; done
```

**Expect** well under the 2-second budget. Measured at roughly **35 ms** during planning against
exactly that shape ([R-004](./research.md#r-004)) — if a run approaches a second, something has
changed structurally, not marginally.

### 17. No personal data in the response — FR-027, SC-009

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | grep -cE '[0-9]{11}|[0-9]{14}|document'
```

**Expect** `0`. The dashboard reports aggregates; no producer document is read or returned.

### 18. Documentation — FR-025, Constitution III

Open `http://localhost:3000/api/docs`. The dashboard operation is present, requires a bearer token,
and its description states in pt-BR what each figure means — including that the crop chart counts
plantings and does not reconcile with the farm count.

---

## Definition of done

- [ ] Steps 1–18 behave as described
- [ ] All suites pass
- [ ] Step 5 reports `match: true` and step 10 shows `label: "Soja"`
- [ ] Swagger matches [contracts/openapi.yaml](./contracts/openapi.yaml)
- [ ] `backend/README.md` (pt-BR) explains every figure well enough to reach step 4 without reading
      source (Principle III, SC-010)

## Known limitations

Accepted decisions, recorded so a validator does not file them as bugs:

- **The state and crop charts cannot be compared.** One is hectares, the other is a count of
  plantings. The payload declares each unit so the difference is visible rather than implied.
- **The crop chart is weighted by planting history.** A farm growing soybeans for ten years
  outweighs ten farms in their first year.
- **No hectares-by-crop chart exists**, and cannot without adding an area to each crop — a change to
  feature `002-rural-producer-crud`, deliberately out of scope.
- **No filters of any kind**, by decision. Every request covers the whole registry as it stands.
