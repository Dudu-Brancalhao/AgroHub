# AgroHub

[![CI](https://github.com/Dudu-Brancalhao/AgroHub/actions/workflows/ci.yml/badge.svg)](https://github.com/Dudu-Brancalhao/AgroHub/actions/workflows/ci.yml)

🇧🇷 [Leia em português](README.pt-BR.md)

A registry of rural producers: who produces, on which farms, and what was planted in each harvest.
A NestJS API, a React interface, and a dashboard that summarizes the whole registry: total farms and
hectares, broken down by state, by crop and by land use.

Built as a take-home project, spec-driven: every feature started as a written specification before
it became code.

---

## Highlights

- **Layered NestJS API** (Controller → Service → Repository → Prisma → PostgreSQL), with every
  route documented in **OpenAPI** and a test that checks the API against that contract.
- **Container-first:** multi-stage Docker image, `docker compose up` brings up API + database, and
  migrations run on container boot.
- **Secure by default:** every route requires a JWT unless explicitly marked public; rate limiting
  persisted in the database; login attempt limits; no default secrets anywhere.
- **45 test files in five Jest projects:** unit, integration, integration against a real
  PostgreSQL, persistence (including uniqueness under concurrent requests) and security (log leaks,
  OpenAPI conformance).
- **CI on every push:** lint, typecheck, all test suites against a real Postgres, frontend build
  and Docker image build.

---

## Quick access

| | Address |
|---|---|
| **Web app** | https://agrohub-three.vercel.app/ |
| **API** | https://agrohub-production.up.railway.app |
| **Swagger** | https://agrohub-production.up.railway.app/api/docs |

Swagger is the fastest way to explore the API: it lists every route, accepts the token through the
**Authorize** button, and lets you fire each call straight from the browser.

---

## Main features

**Dashboard**: total farms and hectares registered, with three pie-chart breakdowns: by state, by
crop and by land use (arable, vegetation, and whatever remains unclassified).

**Producers**: paginated list with search by name or document, plus create, edit and delete.
Each producer holds their farms, and each farm holds what was planted in each harvest.

**Harvests**: harvests are shared across the whole registry: there is one "2021", not one per
farm. You can create, edit, delete and see everything planted in each one.

---

## Architecture

```mermaid
flowchart LR
    B["Browser"] --> V["Vite :5173 (dev)<br/>Vercel (prod)<br/>proxy /api"]
    V --> A["NestJS API<br/>prefix /api"]
    A --> D[("PostgreSQL 16")]
    A -.-> S["Swagger<br/>/api/docs"]
```

```
AgroHub/
├── backend/                      NestJS API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma         tables, indexes and foreign keys
│   │   ├── migrations/           versioned history, applied on container boot
│   │   └── seed.ts               sample data
│   ├── src/
│   │   ├── producers/            one complete domain, all three layers side by side
│   │   │   ├── *.controller.ts   receives, validates via DTO, delegates
│   │   │   ├── *.service.ts      the business rules
│   │   │   ├── *.repository.ts   the only one that talks to Prisma
│   │   │   ├── *.module.ts       wires the three together
│   │   │   ├── dto/              what comes IN, validated on the request
│   │   │   └── entities/         what goes OUT, shaped for the response
│   │   ├── properties/           farms and crops, same structure
│   │   ├── harvests/             harvests, same structure
│   │   ├── dashboard/            the consolidated numbers, same structure
│   │   ├── auth/                 login, registration, guards and strategies
│   │   ├── users/                module, repository and entity only; auth exposes it
│   │   ├── common/               filters, decorators, validation and Swagger setup
│   │   ├── config/               environment variables validated at boot
│   │   ├── throttling/           attempt limits, persisted in the database
│   │   └── health/               the only public route besides login and registration
│   └── test/                     five Jest projects, from unit to security
├── frontend/                     React + Redux interface
│   └── src/
│       ├── features/             one folder per domain (auth, dashboard, producers…)
│       ├── components/           shared, domain-free components
│       ├── lib/                  pure rules (areas, CPF/CNPJ, formatting, httpClient)
│       ├── app/                  store, typed hooks and the route table
│       ├── layout/               header, side menu and page transition
│       ├── icons/                Material Icons re-exported by role
│       ├── styles/               theme, global style and animations
│       └── config/               environment variable reading
├── specs/                        Specification for each delivery
├── .specify/                     project constitution and templates
├── .github/workflows/ci.yml      CI pipeline
├── docker-compose.yml            API + PostgreSQL
└── docker-compose.test.yml       disposable PostgreSQL for tests
```

The rules below are not aspirations: they are written in
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) and every pull request is
reviewed against them.

### Backend: layers

Every feature goes through three layers, and dependencies always point inward:

```
Request  →  Controller  →  Service  →  Repository  →  Prisma  →  PostgreSQL
             (HTTP)       (rules)     (persistence)
```

| Layer | Does | Does not |
|---|---|---|
| **Controller** | Receives, validates via DTO, delegates, maps the response | Any business rule |
| **Service** | The business rules, testable without HTTP and without a database | Know about `Request`/`Response` |
| **Repository** | The only place that talks to Prisma | Know about business rules |

**SOLID.** Each class has one declared responsibility; a unit that needs an "and" to be described
gets split. Services receive their repositories through injection, so swapping persistence does
not touch the rules.

**KISS.** No abstraction goes in before its second use. There is no generic repository, no
configurable mapping layer, no factory for a single case.

**Clean Code.** Names reveal intent without needing a comment to translate them. Where there is a
comment, it explains **why**: the decimal math of areas, the asymmetry of the foreign keys, the
reason login does not detail fields. Dead or commented-out code does not pass review.

**Explicit contracts.** Every route is documented in OpenAPI and typed by a DTO, validated at
runtime by `class-validator` with a global `ValidationPipe` and *whitelist* on (**14 DTOs**
today). No untyped payload crosses a controller. The live contract is at
[`/api/docs`](https://agrohub-production.up.railway.app/api/docs).

**Tests.** **45 test files**, split into five Jest projects with distinct purposes:

| Project | Covers |
|---|---|
| `unit` | Isolated business rules |
| `integration` | Endpoints, with the database replaced in memory |
| `integration-db` | Endpoints against a real, disposable PostgreSQL |
| `persistence` | Only what **is** the database: uniqueness under concurrency, sliding window |
| `security` | Log leaks and conformance with the OpenAPI contract |

No test depends on real external state, and all of them run in any order.

### Frontend: organized by feature

The frontend is not split by file type (`components/`, `hooks/`, `services/`) but **by domain**.
Each folder in `features/` carries everything that domain needs. There are six: `auth`,
`dashboard`, `producers`, `properties`, `harvests` and `ui`. The blast radius of a change is one
folder, and a file and its test live together.

The dependency direction is the same as in the backend, with other names:

```
Component  →  hook  →  thunk / slice  →  API module  →  httpClient  →  network
 (draws only)         (state)           (contract)     (transport)
```

Two rules hold this together:

- **`lib/httpClient.ts` is the only file that calls `fetch`**, and not by convention: ESLint
  rejects any other file that tries, with a message pointing to the principle.
- **Pure rules live in `lib/`**, outside any component: area arithmetic, CPF and CNPJ check
  digits, pt-BR formatting, Brazilian states. They are functions without React, tested on their
  own.

What is genuinely shared and domain-free (button, field, modal, skeleton, chart) lives in
`components/`. **272 tests** cover every screen in its four states: loading, with data, empty and
error.

---

## Stack

| Backend | | Frontend | |
|---|---|---|---|
| NestJS | 11 | React | 18 |
| Prisma ORM | 6 | Redux Toolkit | 2 |
| PostgreSQL | 16 | Vite | 5 |
| Passport + JWT | — | styled-components | 6 |
| bcrypt | 5 | react-router-dom | 6 |
| Pino (logs) | 9 | Material Icons | 9 |
| Swagger | 11 | Jest + Testing Library | 29 / 16 |
| TypeScript | 5.7 | TypeScript | 5.6 |

**Node.js 20 or later** to run locally. The API image uses Node 22.

---

## Running locally

### Prerequisites

Docker, Docker Compose and Node.js 20+.

### 1. Start the API and the database

```bash
cp backend/.env.example backend/.env

# Generate a real JWT_SECRET and paste it into .env:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

docker compose up -d
```

That's it. **Migrations apply themselves**, inside the container, on startup: the `Dockerfile`
`CMD` runs `prisma migrate deploy` before starting the API. If a migration fails, the container
stops instead of serving against a schema that doesn't match.

> [!IMPORTANT]
> **`JWT_SECRET` has no default value.** The application refuses to start without it, and the
> minimum is 32 characters. That's on purpose: a default secret in production is a public secret.

Check that it's up:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

### 2. Load sample data (optional)

```bash
cd backend
npm install
npm run db:seed
```

Creates 5 producers (3 CPF, 2 CNPJ), 5 farms in different states, the 2021 and 2022 harvests and
6 crops. It is **idempotent**: running it again duplicates nothing. At the end it prints the
totals that `GET /api/dashboard` should return, so you can check.

To also create a login user, set these first:

```bash
SEED_USER_EMAIL=demo@agrohub.com.br SEED_USER_PASSWORD=SenhaSegura1 npm run db:seed
```

Without those two variables no user is created. There is no default credential anywhere.

> [!TIP]
> **The seed runs on your machine, not inside the container**, so it uses the `DATABASE_URL`
> from `backend/.env`, which must point to an address reachable from outside Docker
> (`localhost:5432`). The same goes for `prisma migrate` outside the container and for the tests.
>
> If your `.env` points to a remote database, pass the local URL for that command only instead of
> editing the file:
>
> ```bash
> DATABASE_URL="postgresql://agrohub:agrohub@localhost:5432/agrohub" npx prisma db seed
> ```
>
> Inside the container none of this applies: `docker-compose.yml` sets `DATABASE_URL` in
> `environment:`, pointing to `postgres:5432`.

### 3. Start the interface

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The interface runs at **http://localhost:5173**. Create an account on the screen itself or log in
with the seed user.

### Why two ports

The API takes port 3000, so the dev server uses 5173 and forwards `/api` to it. That way the
browser sees a single origin, which is what makes CORS unnecessary.

---

## Ports

| Service | Port | Notes |
|---|---|---|
| API | `3000` | Global prefix `/api` |
| Swagger | `3000` | `/api/docs` |
| PostgreSQL | `5432` | Adjustable with `POSTGRES_PORT` |
| Test PostgreSQL | `5433` | Only with `docker-compose.test.yml`, data in memory |
| Interface (dev) | `5173` | Forwards `/api` to 3000 |

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `postgresql://agrohub:agrohub@localhost:5432/agrohub` | Used by everything that runs **outside** the container: migrations, seed, tests. |
| `JWT_SECRET` | — | **Required, no default, minimum 32 characters.** |
| `JWT_EXPIRES_IN` | `12h` | Token lifetime. There is no refresh or revocation, so this is what limits the damage of a leaked token. |
| `BCRYPT_COST` | `12` | Hash cost (4–15). |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `20` | General limit per origin: 20 requests per minute. |
| `REGISTER_THROTTLE_TTL` / `REGISTER_THROTTLE_LIMIT` | `60` / `5` | Registration limit, stricter on purpose. |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MINUTES` | `5` / `15` | Login attempts per identifier. |
| `LOG_LEVEL` | `info` | Pino log level. |
| `PORT` | `3000` | API port. |

Seed only, and with no default: `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` and `SEED_RESET=true`
(clears crops, harvests and producers before seeding; never touches users).

> The container **does not read** `DATABASE_URL` from `.env`: `docker-compose.yml` sets the value
> in `environment:`, which takes precedence over `env_file:`, pointing to `postgres:5432`. Both
> contexts coexist without having to swap one for the other.

### Frontend (`frontend/.env`)

| Variable | Default | What it does |
|---|---|---|
| `VITE_API_BASE_PATH` | `/api` | **Keep it relative.** An absolute URL brings back the CORS problem the API does not configure. |

---

## API

Global prefix **`/api`**.

| | Base |
|---|---|
| Deployed | `https://agrohub-production.up.railway.app/api` |
| Local | `http://localhost:3000/api` |

Live documentation at **`/api/docs`**: [deployed](https://agrohub-production.up.railway.app/api/docs)
or at `http://localhost:3000/api/docs`. Swagger keeps the token across reloads: log in once
through the **Authorize** button and every following call is already authenticated.

**Everything requires authentication by default.** Two global guards protect the application,
first the rate limit guard, then the JWT guard. A route is only public if it is explicitly marked.

### Authentication

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/auth/register` | **Public** |
| `POST` | `/api/auth/login` | **Public** |
| `GET` | `/api/auth/me` | Bearer |

### Infrastructure

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/health` | **Public** |

### Producers

| Method | Route | What it does |
|---|---|---|
| `POST` | `/api/producers` | Creates a producer |
| `GET` | `/api/producers` | List with pagination and search |
| `GET` | `/api/producers/:id` | Producer with farms and crops grouped by harvest |
| `PATCH` | `/api/producers/:id` | Updates name and/or document |
| `DELETE` | `/api/producers/:id` | Deletes in cascade |

Pagination: `?page=1&pageSize=20` (maximum 100). Search: `?search=jose`, which matches the name
(ignoring case and accents) or the document.

### Farms

| Method | Route | What it does |
|---|---|---|
| `POST` | `/api/producers/:producerId/properties` | Creates a farm |
| `GET` | `/api/producers/:producerId/properties` | Lists the producer's farms |
| `GET` | `/api/properties/:id` | One farm with its crops by harvest |
| `PATCH` | `/api/properties/:id` | Updates the farm |
| `DELETE` | `/api/properties/:id` | Deletes the farm and its crops |

### Crops

| Method | Route | What it does |
|---|---|---|
| `POST` | `/api/properties/:propertyId/crops` | Registers a crop (the harvest goes in the body, as `harvestId`) |
| `GET` | `/api/properties/:propertyId/crops` | What the farm planted |
| `GET` | `/api/harvests/:harvestId/crops` | What was planted in the harvest, across all farms |
| `DELETE` | `/api/crops/:id` | Removes the crop |

### Harvests

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/harvests` | Lists the harvests |
| `POST` | `/api/harvests` | Creates a harvest (unique year) |
| `GET` | `/api/harvests/:id` | One harvest |
| `PATCH` | `/api/harvests/:id` | Updates the year |
| `DELETE` | `/api/harvests/:id` | **Refused with `409` while any crop is registered in it** |

### Dashboard

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/dashboard` | Totals and the three breakdowns |

With the database populated by the seed, the response is exactly this:

```json
{
  "totals": { "farms": 5, "hectares": "5411.00" },
  "byState": {
    "unit": "hectares",
    "categories": [
      { "key": "BA", "label": "BA", "value": "2300.00" },
      { "key": "MG", "label": "MG", "value": "1500.11" },
      { "key": "SP", "label": "SP", "value": "850.50" },
      { "key": "GO", "label": "GO", "value": "640.36" },
      { "key": "MT", "label": "MT", "value": "120.03" }
    ]
  },
  "byCrop": {
    "unit": "count",
    "categories": [
      { "key": "soja", "label": "Soja", "value": 3 },
      { "key": "algodao", "label": "Algodão", "value": 1 },
      { "key": "cafe", "label": "Café", "value": 1 },
      { "key": "milho", "label": "Milho", "value": 1 }
    ]
  },
  "byLandUse": {
    "unit": "hectares",
    "categories": [
      { "key": "arable", "label": "Área agricultável", "value": "4120.61" },
      { "key": "vegetation", "label": "Vegetação", "value": "1140.39" },
      { "key": "unclassified", "label": "Área não classificada", "value": "150.00" }
    ]
  }
}
```

Each breakdown declares its own `unit`. Always read by it, never by the breakdown's name: today
`byState` comes in hectares and `byCrop` as a count, and assuming otherwise makes the label
contradict the number. The `byLandUse` categories add up **exactly** to `totals.hectares`.

The user-facing labels and messages are in Portuguese on purpose: the product is for Brazilian
users.

### Full example

```bash
# Local:
BASE=http://localhost:3000/api
# Deployed:
# BASE=https://agrohub-production.up.railway.app/api

JSON="Content-Type: application/json"

# 1. account and token
curl -X POST $BASE/auth/register -H "$JSON" \
  -d '{"email":"demo@agrohub.com.br","password":"SenhaSegura1"}'

TOKEN=$(curl -s -X POST $BASE/auth/login -H "$JSON" \
  -d '{"email":"demo@agrohub.com.br","password":"SenhaSegura1"}' | jq -r .accessToken)
AUTH="Authorization: Bearer $TOKEN"

# 2. producer
curl -X POST $BASE/producers -H "$AUTH" -H "$JSON" \
  -d '{"name":"José Antônio de Almeida","document":"529.982.247-25"}'

# 3. farm (1000 + 500.11 = 1500.11, the sum closes exactly)
curl -X POST $BASE/producers/<producerId>/properties -H "$AUTH" -H "$JSON" \
  -d '{"farmName":"Fazenda Santa Helena","city":"Uberaba","state":"MG","totalArea":1500.11,"arableArea":1000,"vegetationArea":500.11}'

# 4. harvest (shared across the whole registry)
curl -X POST $BASE/harvests -H "$AUTH" -H "$JSON" -d '{"year":2021}'

# 5. crop (the farm owns it; the harvest is a reference)
curl -X POST $BASE/properties/<propertyId>/crops -H "$AUTH" -H "$JSON" \
  -d '{"harvestId":"<harvestId>","name":"Soja"}'

# 6. dashboard
curl $BASE/dashboard -H "$AUTH"
```

---

## Error format

Every failure uses the same envelope:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Os dados enviados são inválidos.",
  "path": "/api/producers",
  "timestamp": "2026-09-10T15:56:25.052Z",
  "requestId": "2d1dc9c2-996f-46b4-8cae-0f9b8cc7ae8d",
  "details": [
    { "field": "document", "message": "Informe um CPF ou CNPJ válido." },
    { "field": "name", "message": "O nome é obrigatório." }
  ]
}
```

| Code | When it happens |
|---|---|
| `400` | Invalid data. `details` lists **all** fields with errors at once. |
| `401` | Invalid credentials, malformed login body, or missing/expired/tampered token. |
| `404` | Record not found. |
| `409` | Conflict: document or email already registered, same crop repeated on the same farm and harvest, or harvest in use. |
| `429` | Too many attempts. The `Retry-After` header says how many seconds to wait. |

The `requestId` also goes to the server log, and that's how you find the full error.

### Where `details` does not appear

**On login.** A malformed body gets the same generic `401` as a wrong credential:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "E-mail ou senha inválidos.",
  "path": "/api/auth/login",
  "timestamp": "2026-09-10T15:56:25.117Z",
  "requestId": "8646af57-463f-4201-a925-583d8cc128de"
}
```

That's on purpose, and it applies to login only. Whoever sent the request already knows what they
sent, so the detail helps no legitimate user, but it would let an attacker tell "the JSON was
wrong" from "the credentials were wrong". The real reason stays in the log, under the same
`requestId`.

For the same reason, an unknown email and a wrong password return identical responses, and once
the attempt limit is reached even the correct password gets `429`: answering `200` would confirm
to the attacker that the password was right.

---

## Delete responses

Every delete reports **how many records of each type** were removed, so whoever ran it knows the
real reach of what they did. The operation is atomic: either everything is removed, or nothing is.
There is no undo.

Each route returns its own count; there is no single format:

```jsonc
DELETE /api/producers/:id   → { "deleted": { "producers": 1, "properties": 2, "crops": 2 } }
DELETE /api/properties/:id  → { "deleted": { "properties": 1, "crops": 0 } }
DELETE /api/crops/:id       → { "deleted": { "crops": 1 } }
DELETE /api/harvests/:id    → { "deleted": { "harvests": 1 } }
```

The cascade is **`Producer → Farm → Crop`, and it stops there.**

**A harvest never appears in that count.** A harvest belongs to no one: there is one "2021"
shared across the whole registry, and farm and harvest only relate through the crops that link
them. Deleting a producer touches no harvest, and that is not a code convention, it's the
database: the foreign key from crop to harvest is `Restrict`, which makes the cascade structurally
impossible.

The other side of the same rule: deleting a harvest is **refused** while any farm has a crop
registered in it, because a cascade there would wipe the plantings of the whole registry at once.

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Não é possível excluir esta safra: existem 6 culturas registradas nela."
}
```

---

## Rules worth knowing

**CPF and CNPJ are validated by check digit**, not by format. Punctuation is optional and
normalized. Repeated-digit documents (`111.111.111-11`) are refused: they pass a naive modulus
check.

**The sum of the areas cannot exceed the total**: `arable + vegetation ≤ total`. The comparison is
done in **integer hundredths of a hectare**, never in floating point. In JavaScript
`1000 + 500.11` gives `1500.1100000000001`, and a naive implementation would refuse a perfectly
normal 1,500.11 ha farm.

**Areas are returned as strings** (`"1500.11"`) for the same reason: so the client does not bring
the error back when reading the JSON.

**Search ignores case and accents**: searching for `jose` finds `José Antônio`.

**The same crop cannot be registered twice** for the same farm in the same harvest. Two farms in
the same harvest, or one farm in two harvests, are normal.

---

## Tests and quality

### Backend

```bash
cd backend
npm run test:unit
npm run test:integration     # in-memory Prisma, no Docker
npm run test:security
npm run test:all
```

The suites that need a real PostgreSQL:

```bash
docker compose -f docker-compose.test.yml up -d
PERSISTENCE_DATABASE_URL=postgresql://agrohub:agrohub@localhost:5433/agrohub_test npm run test:db:migrate
npm run test:integration-db
npm run test:persistence
docker compose -f docker-compose.test.yml down -v
```

### Frontend

```bash
cd frontend
npm test
```

Runs in jsdom, with no network and no server. Each feature's API module is the only mock point, so
every screen is exercised in its four states: loading, with data, empty and error.

### Before any merge

```bash
cd backend  && npm run lint && npm run typecheck && npm run test:all
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

GitHub Actions runs these same steps on every push and pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)), with a real PostgreSQL for the database
suites, and also checks that the Docker image builds.

---

## How this project was built

Every delivery started as a specification before it became code. The [`specs/`](specs/) folder
keeps, for each one, what was asked (`spec.md`), how it would be done (`plan.md`), the task list
(`tasks.md`) and the technical decisions with the discarded alternatives (`research.md`):

| | Delivery |
|---|---|
| [`001-user-auth`](specs/001-user-auth/) | Authentication, JWT and attempt limits |
| [`002-rural-producer-crud`](specs/002-rural-producer-crud/) | Producers, farms and crops |
| [`003-dashboard-api`](specs/003-dashboard-api/) | The dashboard |
| [`004-harvest-remodel`](specs/004-harvest-remodel/) | Harvests as a shared entity |
| [`005-web-frontend`](specs/005-web-frontend/) | The web interface |

The rules that apply to the whole repository (layered architecture, test coverage, secure by
default, fixed stack and language policy) are in
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).

The specs were written spec-first with [spec-kit](https://github.com/github/spec-kit) and
implemented with Claude Code as the main engineering environment.

Detailed documentation for each side: [`backend/README.md`](backend/README.md) and
[`frontend/README.md`](frontend/README.md) (in Portuguese).
