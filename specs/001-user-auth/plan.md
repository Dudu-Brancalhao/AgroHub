# Implementation Plan: User Authentication (Registration & Login)

**Branch**: `001-user-auth` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-user-auth/spec.md`

## Summary

Deliver the backend of AgroHub's authentication: register an account with an email and password,
log in to receive a signed token, and reach protected routes with it — three endpoints, plus the
protection mechanism every later feature inherits.

Technically: NestJS with Passport (`LocalStrategy` for the credential check, `JwtStrategy` for
subsequent requests), bcrypt-hashed passwords, an HS256 token whose secret and `expiresIn` come from
the environment and never from code, and a global `JwtAuthGuard` that protects every route unless it
carries `@Public()`. Rate limiting runs on two tracks — a per-origin request guard and a
per-identifier failure counter — both backed by Postgres so the counts hold across instances. All
failures pass through one exception filter that returns a fixed envelope to the caller while the
diagnostic detail goes to the log.

Frontend is out of scope, as stated.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS

**Primary Dependencies**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/config`,
`@nestjs/swagger`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/throttler`), `passport`,
`passport-local`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`, `nestjs-pino`,
Prisma 6

**Storage**: PostgreSQL 16 via Prisma ORM — three tables: `User`, `LoginAttempt`, `ThrottleRecord`

**Testing**: Jest + Supertest. Two tiers per [R-009](./research.md#r-009): a default suite with
`PrismaService` overridden by an in-memory fake, and a small persistence suite against a disposable
Postgres from `docker compose`

**Target Platform**: Linux container (Docker), served behind a reverse proxy

**Project Type**: Web service (backend of a monorepo whose frontend arrives in a later feature)

**Performance Goals**: p95 under 1 s for login at realistic concurrency. **SC-007 as literally
written — 200 concurrent logins, 95% under 1 s — is not achievable on a single small instance**;
see [R-002](./research.md#r-002) and Risk 1 below

**Constraints**: bcrypt cost 12 (~250 ms/hash, bounded by the libuv thread pool); password capped at
72 **bytes** by bcrypt truncation; rate-limit counters must be shared across instances (FR-024); no
outbound mail dependency of any kind (FR-003)

**Scale/Scope**: 3 endpoints, 3 tables, 1 module. Single-digit thousands of accounts expected in the
first year; auth traffic capped by FR-021 at 20 req/min per origin

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Principle | Status | How this design satisfies it |
|---|-----------|--------|------------------------------|
| I | Code Quality (SOLID, KISS, Clean Code) | ✅ PASS | One responsibility per class: `AuthService` (credential flow), `PasswordService` (hash/compare), `TokenService` (sign/verify), `LoginAttemptService` (failure counting), `UsersRepository` (persistence). No class does two of these. |
| II | Layered Architecture | ✅ PASS | `AuthController` parses/delegates/maps only. `AuthService` holds every rule. `UsersRepository` is the sole caller of Prisma — services never import `PrismaClient`. Rate-limit *policy* sits in a service, not a guard ([R-006](./research.md#r-006)), precisely to honour this. |
| III | Explicit API Contracts | ✅ PASS | All 3 endpoints in [contracts/openapi.yaml](./contracts/openapi.yaml), typed DTOs validated by a global `ValidationPipe`, Swagger served by the running API. README (pt-BR) is a task. |
| IV | Test Coverage (NON-NEGOTIABLE) | ⚠️ PASS w/ recorded interpretation | Every rule gets a unit test; all 3 endpoints get integration tests. "No external real state" is read as *state the test does not own* — a container the test creates and destroys qualifies as owned. Reasoning in [R-009](./research.md#r-009). |
| V | Security by Default | ✅ PASS | Global `APP_GUARD` protects everything; only 3 routes opt out via `@Public()`. bcrypt cost 12. `JWT_SECRET` from env, validated at boot, **no fallback default anywhere** — a fallback is a hardcoded secret by another name. Pino `redact` backstops FR-025. |
| VI | Observability | ✅ PASS | `nestjs-pino` emits JSON with level, context, timestamp. Registration, login success, login failure, and rate-limit refusal each log a structured event; the exception filter logs full cause and stack while the caller receives only the envelope. |
| VII | Mandated Technology Stack | ⚠️ PASS w/ recorded interpretation | Everything above is the mandated stack. Two boundary calls need review — see below. |
| VIII | Language Policy | ✅ PASS | Code, comments, commits, logs in English. API messages, OpenAPI summaries/descriptions, README in pt-BR. Note the split runs *through* error handling: the caller sees `"E-mail ou senha inválidos."`, the log records `"login failed: credential mismatch"`. |

### Two interpretations requiring reviewer sign-off

Both concern Principle VII, and both are stated here rather than buried in implementation.

**1. Where the "stack" boundary falls.** Principle VII, read literally, makes every `npm install` a
constitution amendment. The working boundary applied throughout this plan: Principle VII governs
**platform and infrastructure** — the framework, ORM, database, container runtime — while ordinary
libraries *inside* that platform are not stack changes. Under this reading `nestjs-pino` and
`@nestjs/throttler` are ordinary libraries and need no amendment ([R-010](./research.md#r-010)).

**2. Redis is on the far side of that boundary, so it is excluded.** FR-024 requires rate-limit
counters shared across instances, and Redis is the reflexive answer. It is also a new running
service, a new Compose service, and new operational surface — infrastructure, not a library. This
plan therefore backs the counters with **Postgres via Prisma** ([R-005](./research.md#r-005)), which
is easily fast enough at FR-021's capped volume and keeps the feature deployable with the services
the project already declares. The storage sits behind `@nestjs/throttler`'s `ThrottlerStorage`
interface, so if the user does want Redis, the correct sequence is `/speckit-constitution` to amend
Principle VII first — after which the swap is one class.

### Post-Phase-1 re-check

Re-evaluated against the completed design ([data-model.md](./data-model.md),
[contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)): **no new
violations**. The two interpretations above are unchanged, and the Complexity Tracking table below
remains empty — nothing in the design needed a justified exception.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

The repository is currently empty apart from `.specify/` and `.claude/`, so this feature also lays
down the backend skeleton. A `frontend/` sibling arrives with its own feature; the split exists from
day one so the two stay independently buildable (Constitution, Additional Constraints).

```text
docker-compose.yml                 # api + postgres
backend/
├── Dockerfile
├── .env.example                   # every key, no real secrets
├── prisma/
│   ├── schema.prisma              # User, LoginAttempt, ThrottleRecord
│   └── migrations/
├── src/
│   ├── main.ts                    # ValidationPipe, filter, Swagger, pino
│   ├── app.module.ts              # APP_GUARD order: Throttler then Jwt
│   ├── config/
│   │   ├── env.validation.ts      # fail-fast boot validation
│   │   └── configuration.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts        # @Public()
│   │   │   └── current-user.decorator.ts  # @CurrentUser()
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   └── dto/
│   │       └── error-response.dto.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.repository.ts    # ONLY place Prisma is touched for users
│   │   └── entities/user.entity.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts     # register, login, me
│   │   ├── auth.service.ts        # the business rules
│   │   ├── password.service.ts    # bcrypt hash/compare + dummy-hash parity
│   │   ├── token.service.ts       # sign/verify
│   │   ├── login-attempt.service.ts
│   │   ├── login-attempt.repository.ts
│   │   ├── dto/
│   │   │   ├── register.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   └── auth-response.dto.ts
│   │   ├── strategies/
│   │   │   ├── local.strategy.ts
│   │   │   └── jwt.strategy.ts
│   │   └── guards/
│   │       └── jwt-auth.guard.ts  # reads IS_PUBLIC_KEY
│   ├── throttling/
│   │   └── prisma-throttler.storage.ts    # ThrottlerStorage over Postgres
│   └── health/
│       └── health.controller.ts   # @Public()
└── test/
    ├── unit/                      # services in isolation
    ├── integration/               # tier 1: AppModule, Prisma faked
    └── persistence/               # tier 2: disposable Postgres only
```

**Structure Decision**: Monorepo with a `backend/` root for this feature. Inside it, NestJS feature
modules (`auth/`, `users/`) rather than technical layers (`controllers/`, `services/`), so a feature
lives in one directory and Principle II's controller → service → repository chain is visible within
it. `common/` holds only what is genuinely cross-cutting — the decorator, the filter, the error DTO
— all of which later features will reuse.

## Risks

**Risk 1 — SC-007 is unachievable as written.** Not a design flaw; arithmetic. bcrypt at cost 12
runs ~250 ms on a 4-thread libuv pool, so 200 concurrent logins finish in ~12 s, not 1 s. Lowering
the cost weakens every stored hash and still misses the target. Full working in
[R-002](./research.md#r-002). The mitigating fact is that 200 concurrent logins from distinct
origins is the exact traffic FR-021 refuses, and a refusal costs one indexed query. **Recommendation**:
restate SC-007 as a measured target against a defined instance size and mixed load. Flagged, not
silently changed — amending a success criterion is the user's call.

**Risk 2 — no revocation path.** Per spec Q3 there is no refresh token and no server-side logout, so
an issued token stays valid until it expires. `JWT_EXPIRES_IN` is therefore the only lever bounding a
leak, which is why 1 h is proposed rather than a longer, more convenient value
([R-012](./research.md#r-012)). The `jti` claim is included now so a future revocation feature has
something to key on without reissuing every token.

**Risk 3 — bcrypt's 72-byte truncation.** If FR-005's maximum length were set above 72 bytes, two
distinct passwords would authenticate the same account. Validation therefore checks
`Buffer.byteLength`, not `.length` — a password of accented characters hits 72 bytes well before 72
characters ([R-001](./research.md#r-001)).

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

No entries. The Constitution Check records two *interpretations* (the stack boundary, and what
"external real state" means for tests), not violations — each is resolved in a way that stays inside
the constitution rather than asking for an exception. Nothing in this design needs a justified
deviation.
