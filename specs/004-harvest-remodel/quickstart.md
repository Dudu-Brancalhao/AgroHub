# Quickstart & Validation Guide: Shared Harvests, Crop as Junction

**Feature**: `004-harvest-remodel` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

How to run the change and prove it works. Scenario numbers map to the acceptance scenarios in
[spec.md](./spec.md); requirement ids map to its functional requirements.

> Validation guide, not an implementation guide. Implementation steps come from `/speckit-tasks`.

---

## Prerequisites

- The stack from `001-user-auth`, `002-rural-producer-crud` and `003-dashboard-api`.

## Setup

**This migration destroys data.** It drops and recreates `crops` and `harvests`; producers,
properties and user accounts survive ([R-001](./research.md#r-001)). That is safe only because
nothing is in production — confirm that is still true before running it.

```bash
docker compose up -d
docker compose exec api npx prisma migrate deploy
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
docker compose exec api npm run test:unit
docker compose -f docker-compose.test.yml up -d
docker compose exec api npm run test:integration-db
docker compose exec api npm run test:persistence
docker compose exec api npm run test:security
```

The whole suite matters more than usual here: this feature changes shipped work, so **the tests that
must keep passing are as important as the ones that change** (SC-005).

---

## Manual validation

### 1. Everything is still protected — FR-027

```bash
curl -s -o /dev/null -w 'no token: %{http_code}\n' http://localhost:3000/api/harvests
```

**Expect** `401`. No route in this feature carries `@Public()`.

### 2. A harvest is recorded once, for everyone — US1 §1 (FR-001, FR-006)

```bash
H2021=$(curl -s -X POST http://localhost:3000/api/harvests -H "$AUTH" -H "$JSON" -d '{"year":2021}' | jq -r .id)
curl -s http://localhost:3000/api/harvests -H "$AUTH" | jq
```

**Expect** `201`, then a list with one entry. **The response carries no property field** — that
absence is the feature.

### 3. The same year cannot be recorded twice — US1 §2 (FR-008)

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/harvests -H "$AUTH" -H "$JSON" -d '{"year":2021}'
```

**Expect** `409`. A year identifies a harvest, so there can never be two indistinguishable "2021"s.

### 4. Year bounds still apply — US1 §5 (FR-007)

```bash
NEXT=$(( $(date +%Y) + 1 )); FAR=$(( $(date +%Y) + 2 ))
for y in 1899 1900 $NEXT $FAR; do
  curl -s -o /dev/null -w "  $y -> %{http_code}\n" -X POST http://localhost:3000/api/harvests -H "$AUTH" -H "$JSON" -d "{\"year\":$y}"
done
```

**Expect** `400`, `201`, `201`, `400`. Unchanged from before — worth checking precisely because it
was *not* meant to change.

### 5. A crop names both a farm and a harvest — US2 §1 (FR-002, FR-003)

```bash
PID=$(curl -s -X POST http://localhost:3000/api/producers -H "$AUTH" -H "$JSON" \
  -d '{"document":"529.982.247-25","name":"José Antônio"}' | jq -r .id)
A=$(curl -s -X POST http://localhost:3000/api/producers/$PID/properties -H "$AUTH" -H "$JSON" \
  -d '{"farmName":"Fazenda A","city":"Uberaba","state":"MG","totalArea":100,"arableArea":60,"vegetationArea":40}' | jq -r .id)

curl -s -X POST http://localhost:3000/api/properties/$A/crops -H "$AUTH" -H "$JSON" \
  -d "{\"harvestId\":\"$H2021\",\"name\":\"Soja\"}" | jq
```

**Expect** `201` with **both** `propertyId` and `harvestId` on the record. That is the junction:
"which farm planted this" is answerable from the crop alone.

### 6. The duplicate rule is per farm-and-harvest — US2 §2, §3, §4 (FR-013 – FR-016)

```bash
B=$(curl -s -X POST http://localhost:3000/api/producers/$PID/properties -H "$AUTH" -H "$JSON" \
  -d '{"farmName":"Fazenda B","city":"Uberaba","state":"SP","totalArea":50,"arableArea":25,"vegetationArea":25}' | jq -r .id)
H2022=$(curl -s -X POST http://localhost:3000/api/harvests -H "$AUTH" -H "$JSON" -d '{"year":2022}' | jq -r .id)

crop () { curl -s -o /dev/null -w "  $3 -> %{http_code}\n" -X POST http://localhost:3000/api/properties/$1/crops -H "$AUTH" -H "$JSON" -d "{\"harvestId\":\"$2\",\"name\":\"$4\"}"; }
crop $A $H2021 "same farm, same harvest, same crop " Soja
crop $A $H2021 "same farm, same harvest, SOJA     " SOJA
crop $B $H2021 "other farm, same harvest, same crop" Soja
crop $A $H2022 "same farm, other harvest, same crop" Soja
crop $A $H2021 "same farm, same harvest, other crop" Milho
```

**Expect** `409`, `409`, `201`, `201`, `201`. The first two are the duplicate rule; the third and
fourth are what the junction makes possible.

### 7. A missing parent is refused from either side — US2 §6 (FR-012)

```bash
GHOST=00000000-0000-0000-0000-000000000000
curl -s -o /dev/null -w '  bad property (path) -> %{http_code}\n' -X POST http://localhost:3000/api/properties/$GHOST/crops -H "$AUTH" -H "$JSON" -d "{\"harvestId\":\"$H2021\",\"name\":\"Soja\"}"
curl -s -o /dev/null -w '  bad harvest (body)  -> %{http_code}\n' -X POST http://localhost:3000/api/properties/$A/crops -H "$AUTH" -H "$JSON" -d "{\"harvestId\":\"$GHOST\",\"name\":\"Trigo\"}"
```

**Expect** `404` for both. The property is a 404 on the path as before; the harvest is a 404 raised
from the body, which is the one place this feature bends feature 002's convention
([R-003](./research.md#r-003)).

### 8. A harvest in use cannot be deleted — US1, FR-010 ⚠️

```bash
curl -s -X DELETE http://localhost:3000/api/harvests/$H2021 -H "$AUTH" | jq '{statusCode, message}'
```

**Expect** `409`, and a message naming **how many crops** are blocking it.

**This is the check that matters most in the feature.** A harvest is shared, so a cascade here would
erase a year across every farm in the registry from one call. A `200` means the relation is still
cascading and one careless request can destroy the whole season
([R-005](./research.md#r-005)).

### 9. A harvest with no crops can be deleted — FR-011

```bash
H1999=$(curl -s -X POST http://localhost:3000/api/harvests -H "$AUTH" -H "$JSON" -d '{"year":1999}' | jq -r .id)
curl -s -X DELETE http://localhost:3000/api/harvests/$H1999 -H "$AUTH" | jq '.deleted'
```

**Expect** `200` with `{ "harvests": 1 }`.

### 10. Deleting a property removes its crops, and no harvest — FR-017

```bash
curl -s -X DELETE http://localhost:3000/api/properties/$B -H "$AUTH" | jq '.deleted'
curl -s http://localhost:3000/api/harvests -H "$AUTH" | jq 'length'
```

**Expect** `{ "properties": 1, "crops": 1 }` — **note the absence of `harvests`**
([R-008](./research.md#r-008)) — and the harvest list unchanged. A farm dying must not take a shared
season with it.

### 11. Crops come back grouped by harvest — US2 §7 (FR-019)

```bash
curl -s http://localhost:3000/api/producers/$PID -H "$AUTH" | jq '.properties[] | {farmName, harvests: [.harvests[] | {year, crops: [.crops[].name]}]}'
```

**Expect** Fazenda A showing 2021 with Soja and Milho, and 2022 with Soja. The grouping is done for
you; a property with no crops shows an empty list.

### 12. The crop chart is unchanged — FR-021 – FR-026 ⚠️

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '.byCrop'
```

**Expect** `unit: "count"`, soja `2` (Fazenda A in 2021 and 2022), milho `1`.

**Soja counting 2 is the point.** The chart counts plantings, so one farm across two seasons
contributes twice. A value of `1` would mean somebody implemented the withdrawn
`COUNT(DISTINCT property_id)` correction ([R-007](./research.md#r-007)).

### 13. Every other dashboard figure is untouched — FR-030

```bash
curl -s http://localhost:3000/api/dashboard -H "$AUTH" | jq '{totals, byState: .byState.categories, byLandUse: .byLandUse.categories}'
```

**Expect** the farm count, hectare total, state breakdown and land-use breakdown exactly as they
behaved before this feature. None of them reads a harvest or a crop.

### 14. Nothing else regressed — FR-028, SC-005

```bash
curl -s -o /dev/null -w '  invalid CPF        -> %{http_code}\n' -X POST http://localhost:3000/api/producers -H "$AUTH" -H "$JSON" -d '{"document":"111.111.111-11","name":"X"}'
curl -s -o /dev/null -w '  duplicate document -> %{http_code}\n' -X POST http://localhost:3000/api/producers -H "$AUTH" -H "$JSON" -d '{"document":"529.982.247-25","name":"Y"}'
curl -s -o /dev/null -w '  area rule broken   -> %{http_code}\n' -X POST http://localhost:3000/api/producers/$PID/properties -H "$AUTH" -H "$JSON" -d '{"farmName":"C","city":"U","state":"MG","totalArea":100,"arableArea":70,"vegetationArea":40}'
```

**Expect** `400`, `409`, `400`. Document validation, uniqueness and the area rule are untouched by
this feature, and checking them is how you prove the blast radius stayed where it was intended.

### 15. Cascade deletion still leaves no orphans — FR-029, FR-031

```bash
curl -s -X DELETE http://localhost:3000/api/producers/$PID -H "$AUTH" | jq '.deleted'
docker compose exec -T postgres psql -U agrohub -d agrohub -t -c "
  SELECT 'orphan crops (no property): ' || count(*) FROM crops c LEFT JOIN properties p ON p.id = c.property_id WHERE p.id IS NULL
  UNION ALL SELECT 'orphan crops (no harvest): ' || count(*) FROM crops c LEFT JOIN harvests h ON h.id = c.harvest_id WHERE h.id IS NULL
  UNION ALL SELECT 'surviving harvests:        ' || count(*) FROM harvests;"
```

**Expect** zero orphans of either kind, and the harvests still standing — they belong to nobody, so
a producer's deletion must not reach them.

### 16. Safra and safrinha are no longer recordable — the accepted loss ⚠️

```bash
curl -s -o /dev/null -w '  second 2021 harvest -> %{http_code}\n' -X POST http://localhost:3000/api/harvests -H "$AUTH" -H "$JSON" -d '{"year":2021}'
```

**Expect** `409`. This is not a bug: a year identifies one harvest, so a farm can no longer record a
main planting and a second planting of the same crop in one calendar year
([R-011](./research.md#r-011)). It is the only irreversible part of this change — recorded here so a
validator does not file it.

### 17. Documentation — FR-032

Open `http://localhost:3000/api/docs`. `POST /harvests` takes no property; `POST /properties/{id}/crops`
takes a `harvestId`; the harvest delete documents its refusal; the deletion report no longer lists
`harvests` for producers or properties.

---

## Definition of done

- [ ] Steps 1–17 behave as described
- [ ] All suites pass, **including every test this feature did not intend to change**
- [ ] Step 8 returns `409` and step 12 shows soja `2`
- [ ] Swagger matches [contracts/openapi.yaml](./contracts/openapi.yaml)
- [ ] `backend/README.md` (pt-BR) describes the shared harvest and the new crop shape

## Known limitations

Accepted decisions, recorded so a validator does not report them as bugs:

- **Safra and safrinha cannot be recorded.** One year, one harvest — see step 16.
- **The migration destroys crops and harvests.** By decision; producers, properties and accounts
  survive.
- **A harvest cannot be deleted while in use**, by design. Remove its crops first.
- **The crop chart still counts plantings**, not farms. The `COUNT(DISTINCT property_id)` correction
  was considered and withdrawn.
