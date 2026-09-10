# Quickstart & Validation Guide: User Authentication

**Feature**: `001-user-auth` | **Date**: 2026-09-09 | **Plan**: [plan.md](./plan.md)

How to run the feature and prove it works. Scenario numbers map to the acceptance scenarios in
[spec.md](./spec.md); requirement ids map to its functional requirements.

> This is a validation guide, not an implementation guide. Implementation steps come from
> `/speckit-tasks`.

---

## Prerequisites

- Docker and Docker Compose
- Node.js 22 LTS (only for running the suites outside a container)

## Setup

```bash
cp backend/.env.example backend/.env
```

Then set a real `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Required keys:

| Key | Example | Notes |
|-----|---------|-------|
| `DATABASE_URL` | `postgresql://agrohub:agrohub@postgres:5432/agrohub` | |
| `JWT_SECRET` | *(generated above)* | **No default exists in code.** The app refuses to boot without it — see the boot-guard check below. |
| `JWT_EXPIRES_IN` | `1h` | |
| `BCRYPT_COST` | `12` | Test runs use `4`. |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `20` | FR-021 |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MINUTES` | `5` / `15` | FR-020 |

```bash
docker compose up -d
docker compose exec api npx prisma migrate deploy
```

API on `http://localhost:3000/api`, Swagger on `http://localhost:3000/api/docs`.

---

## Automated validation

```bash
# Tier 1 — every endpoint, real HTTP stack, Prisma faked. No database needed.
docker compose exec api npm run test:integration

# Tier 2 — only the guarantees that ARE the database (FR-002 concurrency, FR-020 window).
docker compose exec api npm run test:persistence

# Business rules in isolation.
docker compose exec api npm run test:unit
```

The two tiers and why they are split: [R-009](./research.md#r-009).

---

## Manual validation

Each block states what it proves. `jq` optional.

### 1. Register — spec US1 §1 (FR-001)

```bash
curl -si -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"produtor@agrohub.com.br","password":"SenhaSegura1"}'
```

**Expect** `201` with `{id, email, createdAt}`. **No `password` or `passwordHash` field anywhere in
the response** (FR-007).

### 2. Duplicate email — US1 §2 (FR-002)

Run the same command again. **Expect** `409`, message in pt-BR, and still exactly one account.

### 3. Email normalisation — edge case (FR-004)

```bash
curl -si -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"  PRODUTOR@AgroHub.com.BR  ","password":"OutraSenha9"}'
```

**Expect** `409`, not a second account — casing and padding must collapse to the same key.

### 4. Validation reports every field at once — US1 §3, §5 (FR-005, FR-013)

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"nao-e-email","password":"curta"}' | jq
```

**Expect** `400` with `details` containing **both** the email and the password error — not the first
one only.

### 5. Privileged fields cannot be injected — US1 §4 (FR-006)

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"novo@agrohub.com.br","password":"SenhaSegura1","role":"admin","isAdmin":true}' | jq
```

**Expect** `400` naming `role` and `isAdmin` as forbidden. A `201` here is a **security failure**,
even if the fields were ignored — silence today becomes a privilege-escalation path the moment a
`role` column exists.

### 6. Unreachable mailbox still registers — US1 §6 (FR-003)

```bash
curl -si -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"ninguem@dominio-que-nao-existe-12345.com.br","password":"SenhaSegura1"}'
```

**Expect** `201`. The format is valid, so it is accepted; nothing checks deliverability and nothing
is sent. Should this hang or fail on a network lookup, an outbound dependency has crept in —
FR-003 violated.

### 7. Login — US2 §1 (FR-008, FR-011)

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"produtor@agrohub.com.br","password":"SenhaSegura1"}' | jq -r .accessToken)
echo "$TOKEN"
```

**Expect** `200` with `accessToken`, `tokenType: "Bearer"`, `expiresIn: 3600`, and `user`.

### 8. Wrong password and unknown email are indistinguishable — US2 §2, §3 (FR-009, FR-010)

```bash
for body in \
  '{"email":"produtor@agrohub.com.br","password":"SenhaErrada1"}' \
  '{"email":"fantasma@agrohub.com.br","password":"SenhaErrada1"}'
do
  curl -s -o /tmp/body -w 'status=%{http_code} time=%{time_total}\n' \
    -X POST http://localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' -d "$body"
  cat /tmp/body; echo
done
```

**Expect** identical status and identical message. **Also compare the timings** — they should be
within the same order of magnitude. A fast unknown-email response and a slow wrong-password one
means the dummy-hash comparison ([R-003](./research.md#r-003)) is missing, and the endpoint has
become an account-existence oracle. This is the check most likely to be skipped and the one most
worth running.

### 9. Protected route with a valid token — US3 §1 (FR-017, FR-019)

```bash
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

**Expect** `200` with this account's `{id, email, createdAt}` and no password material.

### 10. Protected route without / with a tampered token — US3 §2, §3 (FR-016)

```bash
curl -s -o /dev/null -w 'no token: %{http_code}\n' http://localhost:3000/api/auth/me
curl -s -o /dev/null -w 'tampered: %{http_code}\n' http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer ${TOKEN}x"
```

**Expect** `401` for both.

### 11. Global guard is on by default — Constitution V, FR-016

Add a temporary route with **no** decorator, call it without a token, expect `401`, then delete it.
This verifies the `APP_GUARD` default rather than a per-route decorator someone remembered to add.
A `200` means new routes ship unprotected unless the author thinks to protect them —
[R-007](./research.md#r-007) exists to prevent exactly that.

### 11b. Login errors are opaque; register errors are itemised — FR-013a

```bash
curl -s -X POST http://localhost:3000/api/auth/login   -H 'Content-Type: application/json' -d '{"email":"nao-e-email"}' | jq
```

**Expect** `401` with the generic `"E-mail ou senha inválidos."` and **no `details` field** —
byte-identical to a wrong-password response. Then confirm the reason reached the log instead:

```bash
docker compose logs api | grep -o '"validation":\[[^]]*\]' | tail -1
```

**Expect** something like `["email:isEmail","password:isNotEmpty"]` — field name plus rule
identifier, never the submitted value. Registration must still itemise (step 4); if it stopped,
users can no longer be told which password rule they missed.

### 12. Failed-attempt limit — US4 §1 (FR-020, FR-023)

```bash
for i in $(seq 1 7); do
  curl -s -o /dev/null -w "attempt $i: %{http_code}\n" \
    -X POST http://localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"produtor@agrohub.com.br","password":"SenhaErrada1"}'
done
```

**Expect** `401` for attempts 1–5, then `429` with a `Retry-After` header. Now send the **correct**
password while limited: it must still be `429` (FR-023) — a `200` would confirm to an attacker that
the password was right, which is the whole point of the requirement.

### 13. Reset on success — US4 §4 (FR-022)

Wait out the window (or use a shorter `LOGIN_WINDOW_MINUTES` in a scratch environment), fail twice,
then log in correctly. **Expect** `200`, and a further failed attempt should be `401` rather than an
immediate `429` — the counter cleared.

### 14. Per-origin limit — US4 §3 (FR-021)

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST http://localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"user$i@agrohub.com.br\",\"password\":\"SenhaSegura1\"}"
done; echo
```

Twenty-five *distinct* emails, so the per-email limit never triggers. **Expect** the tail to turn
`429` anyway — otherwise rotating the identifier bypasses rate limiting entirely.

### 14b. Register-specific limit — FR-021a

```bash
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "register $i: %{http_code}
"     -X POST http://localhost:3000/api/auth/register     -H 'Content-Type: application/json'     -d "{\"email\":\"novo$i@agrohub.com.br\",\"password\":\"SenhaSegura1\"}"
done
```

**Expect** `201` for the first 5, then `429`. This limit is stricter than the global 20/min
because the `409` on a duplicate address is an account-existence oracle costing one request per
address. Confirm the oracle stops answering while limited: re-send an address you know exists and
expect `429`, not `409`.

### 15. Counters survive a restart and are shared — FR-024

```bash
# trigger the limit as in step 12, then:
docker compose restart api
# repeat one attempt — must still be 429
```

**Expect** still `429`. A `401` means counters live in process memory, so a restart (or simply a
second instance) resets the limit and FR-024 is unmet.

### 16. Nothing sensitive reaches the logs — FR-025

```bash
docker compose logs api | grep -iE 'SenhaSegura1|SenhaErrada1|passwordHash|\$2[aby]\$|eyJhbGciOi'
```

**Expect no output.** Any hit is a Principle V violation and blocks release. The patterns cover
plaintext passwords, a bcrypt hash prefix, and a JWT header prefix.

### 17. Business events are logged, structurally — FR-026

```bash
docker compose logs api | tail -20
```

**Expect** one-line JSON per event carrying level, timestamp, and context, with entries for
registration, login success, login failure, and rate-limit refusal. Message text in **English**
(technical log), while the pt-BR text is what the API returned to the caller
([R-008](./research.md#r-008)).

### 18. Boot guard on the secret — Constitution V

```bash
docker compose exec -e JWT_SECRET= api node dist/main.js
```

**Expect** an immediate, explicit startup failure naming `JWT_SECRET`. If it boots, a default
secret exists somewhere in the code — which is a hardcoded secret, since it is what runs whenever
the real one fails to load ([R-004](./research.md#r-004)).

### 19. Documentation is complete — FR-027, Constitution III

Open `http://localhost:3000/api/docs`. All three endpoints present, request/response schemas shown,
and every failure case documented — `400`, `401`, `409`, `429`. Descriptions in pt-BR.

---

## Definition of done

- [ ] Steps 1–19 behave as described
- [ ] All three suites pass
- [ ] Step 16 produces no output
- [ ] Swagger matches [contracts/openapi.yaml](./contracts/openapi.yaml)
- [ ] `backend/README.md` (pt-BR) lets a newcomer reach step 7 without reading source (Principle III)

## Known limitations

Both are accepted decisions, not defects — recorded so a validator does not report them as bugs:

- **No logout, no revocation.** A token stays valid until it expires; there is no endpoint to
  invalidate one (spec Q3, plan Risk 2).
- **SC-007 is not met as written.** 200 concurrent logins take roughly 12 s, not 1 s, because
  bcrypt at cost 12 is CPU-bound on the libuv pool. Full arithmetic in
  [R-002](./research.md#r-002); pending the user's decision on restating the criterion.
