# Quickstart & Validation Guide: Rural Producer Registry

**Feature**: `002-rural-producer-crud` | **Date**: 2026-09-10 | **Plan**: [plan.md](./plan.md)

How to run the feature and prove it works. Scenario numbers map to the acceptance scenarios in
[spec.md](./spec.md); requirement ids map to its functional requirements.

> Validation guide, not an implementation guide. Implementation steps come from `/speckit-tasks`.

---

## Prerequisites

- Docker and Docker Compose
- The stack from feature `001-user-auth` — this feature adds tables to the same database and reuses
  its authentication

## Setup

```bash
cp backend/.env.example backend/.env   # set JWT_SECRET if not already done
docker compose up -d
docker compose exec api npx prisma migrate deploy
```

**Every request below needs a token.** There are no public routes in this feature:

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"operador@agrohub.com.br","password":"SenhaSegura1"}'

TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operador@agrohub.com.br","password":"SenhaSegura1"}' | jq -r .accessToken)

AUTH="Authorization: Bearer $TOKEN"
JSON="Content-Type: application/json"
```

---

## Automated validation

```bash
# Business rules in isolation — no database, instant.
docker compose exec api npm run test:unit

# Endpoints, against the disposable Postgres (see R-008 for why this feature differs from 001).
docker compose -f docker-compose.test.yml up -d
docker compose exec api npm run test:integration
docker compose exec api npm run test:persistence

# Log-leak gate and contract drift.
docker compose exec api npm run test:security
```

---

## Manual validation

### 1. Everything is protected — FR-001

```bash
curl -s -o /dev/null -w 'no token: %{http_code}\n' http://localhost:3000/api/producers
```

**Expect** `401`. No route in this feature carries `@Public()`, so protection comes from the global
guard built in feature 001 — no new authentication code exists to get wrong.

### 2. Register a producer — US1 §1 (FR-003, FR-004)

```bash
PRODUCER=$(curl -s -X POST http://localhost:3000/api/producers -H "$AUTH" -H "$JSON" \
  -d '{"document":"529.982.247-25","name":"José Antônio de Almeida"}')
echo "$PRODUCER" | jq
PID=$(echo "$PRODUCER" | jq -r .id)
```

**Expect** `201`, `documentType: "CPF"`, and `document` stored as `52998224725` — digits only
(FR-007).

### 3. Punctuation does not create a second producer — US1 §2 (FR-007, FR-008)

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/producers \
  -H "$AUTH" -H "$JSON" -d '{"document":"52998224725","name":"Outro Nome"}'
```

**Expect** `409`. Same person, written differently.

### 4. Invalid documents are rejected — US1 §3 (FR-005, FR-006)

```bash
for doc in "111.111.111-11" "000.000.000-00" "123.456.789-00" "529.982.247-24" "1234567890" "11.222.333/0001-82"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/producers \
    -H "$AUTH" -H "$JSON" -d "{\"document\":\"$doc\",\"name\":\"Teste\"}")
  echo "  $doc -> $code"
done
```

**Expect** `400` for every one. `111.111.111-11` is the one that matters: it **passes** the
check-digit arithmetic and is rejected only by the explicit repeated-digit rule
([R-002](./research.md#r-002)). A `201` here means that rule is missing.

### 5. A valid CNPJ is accepted — US1 §4

```bash
curl -s -X POST http://localhost:3000/api/producers -H "$AUTH" -H "$JSON" \
  -d '{"document":"11.222.333/0001-81","name":"Agropecuária Boa Vista Ltda"}' | jq '{documentType, document}'
```

**Expect** `201` with `documentType: "CNPJ"`.

> **Before launch**: confirm whether Brazil's **alphanumeric CNPJ** is in force. If it is, a newly
> issued CNPJ containing letters will be rejected here and will look like a typing error to the
> user. See [R-003](./research.md#r-003) and plan Risk 2.

### 6. Add a property — US2 §1 (FR-010, FR-012)

```bash
PROP=$(curl -s -X POST http://localhost:3000/api/producers/$PID/properties -H "$AUTH" -H "$JSON" \
  -d '{"farmName":"Fazenda Santa Helena","city":"Uberaba","state":"MG",
       "totalArea":1500.11,"arableArea":1000,"vegetationArea":500.11}')
echo "$PROP" | jq
PROPID=$(echo "$PROP" | jq -r .id)
```

**Expect** `201`. **These numbers are the point.** In JavaScript, `1000 + 500.11` is
`1500.1100000000001`, so a naive implementation rejects this perfectly ordinary farm. A `400` here
means areas are being added as numbers somewhere instead of per-field decimals
([R-001](./research.md#r-001)).

### 7. The area rule — US2 §2, §3 (FR-013)

```bash
# exceeds -> must be refused
curl -s -o /dev/null -w 'exceeds:  %{http_code}\n' -X POST http://localhost:3000/api/producers/$PID/properties \
  -H "$AUTH" -H "$JSON" -d '{"farmName":"F2","city":"Uberaba","state":"MG","totalArea":100,"arableArea":70,"vegetationArea":40}'

# exactly equal -> must be accepted
curl -s -o /dev/null -w 'exact:    %{http_code}\n' -X POST http://localhost:3000/api/producers/$PID/properties \
  -H "$AUTH" -H "$JSON" -d '{"farmName":"F3","city":"Uberaba","state":"MG","totalArea":100,"arableArea":60,"vegetationArea":40}'

# zero arable and vegetation -> valid unused land
curl -s -o /dev/null -w 'zeros:    %{http_code}\n' -X POST http://localhost:3000/api/producers/$PID/properties \
  -H "$AUTH" -H "$JSON" -d '{"farmName":"F4","city":"Uberaba","state":"MG","totalArea":100,"arableArea":0,"vegetationArea":0}'
```

**Expect** `400`, `201`, `201`. The rule forbids *exceeding*, not *reaching*.

### 8. Invalid state and negative areas — US2 §4, §7 (FR-015, FR-017)

```bash
curl -s -X POST http://localhost:3000/api/producers/$PID/properties -H "$AUTH" -H "$JSON" \
  -d '{"farmName":"F5","city":"X","state":"XX","totalArea":100,"arableArea":-5,"vegetationArea":0}' | jq '.details'
```

**Expect** `400` naming **both** `state` and `arableArea` in one response (FR-035).

### 9. Partial update is validated on the result — US5 §3 (FR-014) ⚠️

```bash
curl -s -X PATCH http://localhost:3000/api/properties/$PROPID -H "$AUTH" -H "$JSON" \
  -d '{"totalArea":100}' | jq '{statusCode, details}'
```

**Expect** `400`. The stored property is 1500.11 / 1000 / 500.11; lowering the total to 100 leaves
the stored parts exceeding it. **This is the check most likely to be missing**: `{"totalArea":100}`
is a perfectly valid number in isolation, and validating only the submitted field accepts it and
corrupts the row ([R-009](./research.md#r-009)).

### 10. Harvests and multiple crops per season — US3 §1, §2 (FR-019, FR-021)

```bash
HID=$(curl -s -X POST http://localhost:3000/api/properties/$PROPID/harvests -H "$AUTH" -H "$JSON" \
  -d '{"year":2021}' | jq -r .id)

curl -s -o /dev/null -w 'soja:  %{http_code}\n'  -X POST http://localhost:3000/api/harvests/$HID/crops -H "$AUTH" -H "$JSON" -d '{"name":"Soja"}'
curl -s -o /dev/null -w 'milho: %{http_code}\n'  -X POST http://localhost:3000/api/harvests/$HID/crops -H "$AUTH" -H "$JSON" -d '{"name":"Milho"}'
curl -s http://localhost:3000/api/harvests/$HID/crops -H "$AUTH" | jq -r '.[].name'
```

**Expect** both `201`, and both crops listed. Soybeans **and** corn in 2021 — the second must not
replace the first.

### 11. The same crop twice is refused, case-insensitively — FR-025 (FR-024)

```bash
curl -s -o /dev/null -w 'Soja again: %{http_code}\n' -X POST http://localhost:3000/api/harvests/$HID/crops -H "$AUTH" -H "$JSON" -d '{"name":"Soja"}'
curl -s -o /dev/null -w 'soja lower: %{http_code}\n' -X POST http://localhost:3000/api/harvests/$HID/crops -H "$AUTH" -H "$JSON" -d '{"name":"  soja  "}'
curl -s -o /dev/null -w 'Soya:       %{http_code}\n' -X POST http://localhost:3000/api/harvests/$HID/crops -H "$AUTH" -H "$JSON" -d '{"name":"Soya"}'
```

**Expect** `409`, `409`, `201`. The last one is the accepted cost of free-text crop names: "Soya" is
a different string, so it is a different crop.

### 12. Harvest year bounds — US3 §5 (FR-022)

```bash
NEXT=$(( $(date +%Y) + 1 )); FAR=$(( $(date +%Y) + 2 ))
for y in 1899 1900 $NEXT $FAR; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/properties/$PROPID/harvests -H "$AUTH" -H "$JSON" -d "{\"year\":$y}")
  echo "  $y -> $code"
done
```

**Expect** `400`, `201`, `201`, `400`. Note the bounds move with the calendar — a hardcoded upper
limit is wrong from 1 January.

### 13. Empty children are valid states — US2 §5, US3 §4 (FR-011, FR-020)

```bash
EMPTY=$(curl -s -X POST http://localhost:3000/api/producers -H "$AUTH" -H "$JSON" \
  -d '{"document":"390.533.447-05","name":"Produtor Sem Fazenda"}' | jq -r .id)
curl -s http://localhost:3000/api/producers/$EMPTY -H "$AUTH" | jq '{name, properties}'
```

**Expect** `200` with `properties: []`. Having none is valid, not an error.

### 14. Accent-insensitive search — US4 §3 (FR-027)

```bash
curl -s "http://localhost:3000/api/producers?search=jose" -H "$AUTH" | jq '.data[].name'
curl -s "http://localhost:3000/api/producers?search=JOSÉ" -H "$AUTH" | jq '.data[].name'
```

**Expect** both to find "José Antônio de Almeida". If only the accented query matches, the
`nameSearch` column is not being maintained ([R-005](./research.md#r-005)).

### 15. Paging reports the total — US4 §1, §2 (FR-026)

```bash
curl -s "http://localhost:3000/api/producers?page=1&pageSize=2" -H "$AUTH" | jq '{total, page, pageSize, returned: (.data|length)}'
curl -s "http://localhost:3000/api/producers?page=2&pageSize=2" -H "$AUTH" | jq '.data[].name'
```

**Expect** a `total` larger than the page size, and page 2 returning different records — no
duplicates, none skipped.

### 16. Nested retrieval — US4 §4 (FR-028)

```bash
curl -s http://localhost:3000/api/producers/$PID -H "$AUTH" | jq '{name, properties: [.properties[] | {farmName, harvests: [.harvests[] | {year, crops: [.crops[].name]}]}]}'
```

**Expect** producer → properties → harvests → crops in one response.

### 17. Not found is distinct from empty — US4 §5 (FR-029)

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/producers/00000000-0000-0000-0000-000000000000 -H "$AUTH"
```

**Expect** `404`, not `200` with a null body.

### 18. Cascade delete reports what it removed — US5 §5 (FR-030 – FR-034) ⚠️

```bash
curl -s http://localhost:3000/api/producers/$PID -H "$AUTH" | jq '[.properties[].harvests[].crops[]] | length'
curl -s -X DELETE http://localhost:3000/api/producers/$PID -H "$AUTH" | jq
curl -s -o /dev/null -w 'producer after delete: %{http_code}\n' http://localhost:3000/api/producers/$PID -H "$AUTH"
curl -s -o /dev/null -w 'property after delete: %{http_code}\n' http://localhost:3000/api/properties/$PROPID -H "$AUTH"
```

**Expect** a `deleted` object with non-zero counts for properties, harvests and crops, then `404`
for both. **This is destructive and permanent** — there is no undo, by decision (spec Assumptions).

### 19. No orphans anywhere — FR-033, SC-005

```bash
docker compose exec -T postgres psql -U agrohub -d agrohub -c "
  SELECT 'orphan properties' AS check, count(*) FROM properties p LEFT JOIN producers pr ON pr.id = p.producer_id WHERE pr.id IS NULL
  UNION ALL SELECT 'orphan harvests', count(*) FROM harvests h LEFT JOIN properties p ON p.id = h.property_id WHERE p.id IS NULL
  UNION ALL SELECT 'orphan crops',    count(*) FROM crops c LEFT JOIN harvests h ON h.id = c.harvest_id WHERE h.id IS NULL;"
```

**Expect** zero on all three rows.

### 20. Documents never reach the logs — FR-038, SC-009

```bash
docker compose logs api | grep -icE '52998224725|529\.982\.247|11222333000181|11\.222\.333'
```

**Expect** `0`. Logs reference producers by `producerId` only ([R-012](./research.md#r-012)).

### 21. Documentation is complete — FR-039, Constitution III

Open `http://localhost:3000/api/docs`. All producer, property, harvest and crop operations present,
each showing `400`, `401`, `404` and — where applicable — `409`. Descriptions in pt-BR, and every
operation marked as requiring a bearer token.

---

## Definition of done

- [ ] Steps 1–21 behave as described
- [ ] All four suites pass
- [ ] Step 19 returns zero orphans and step 20 produces no output
- [ ] Swagger matches [contracts/openapi.yaml](./contracts/openapi.yaml)
- [ ] `backend/README.md` (pt-BR) covers the registry well enough to reach step 10 without reading
      source (Principle III)

## Known limitations

Accepted decisions, recorded so a validator does not file them as bugs:

- **Any authenticated user can edit or delete anything.** The registry is shared with no roles
  (FR-002) and self-registration is open, so anyone who registers can erase any producer's history.
  Decided in the spec; see plan Risk 1.
- **Deletion is permanent and cascading.** No soft delete, no undo, no audit history.
- **"Soja" and "Soya" are two crops.** Free-text naming (FR-024) means variants of the same crop
  will need reconciling before any report counts hectares by crop.
- **Alphanumeric CNPJ may already be in force** and is not yet supported — see step 5 and Risk 2.
