# Tasks: User Authentication (Registration & Login)

**Input**: Design documents from `/specs/001-user-auth/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md)

**Tests**: **Included and mandatory.** The template treats test tasks as optional; Constitution
Principle IV does not — "Every business rule MUST have a unit test. Every endpoint MUST have an
integration test" is marked NON-NEGOTIABLE. Test tasks are therefore first-class here, and per
[R-009](./research.md#r-009) they run in two tiers: `test/integration/` boots the real `AppModule`
with `PrismaService` faked, `test/persistence/` hits a disposable Postgres for the handful of
guarantees that *are* the database.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1–US4)
- Exact file paths are given in every task

## Path Conventions

Monorepo per [plan.md](./plan.md#project-structure). Backend lives in `backend/`; a `frontend/`
sibling arrives in a later feature. All paths below are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, tooling, and containers. The repo is currently empty apart from
`.specify/` and `.claude/`, so this phase creates everything.

- [X] T001 Create the directory skeleton from plan.md at `backend/src/{config,common,prisma,users,auth,throttling,health}` and `backend/test/{unit,integration,persistence}`
- [X] T002 Initialize the NestJS 11 project in `backend/package.json` (Node 22 LTS, TypeScript 5.x) and install `@nestjs/{common,core,config,swagger,jwt,passport,throttler,schedule}`, `passport`, `passport-local`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`, `nestjs-pino`, `pino`, `pino-http`, `prisma`, `@prisma/client`, plus dev deps `jest`, `ts-jest`, `supertest`, `@types/*`
- [X] T003 [P] Configure ESLint and Prettier in `backend/.eslintrc.cjs` and `backend/.prettierrc`, with a rule forbidding `any` in DTO and controller files (Constitution III)
- [X] T004 [P] Enable `strict: true`, `strictNullChecks`, and `noImplicitAny` in `backend/tsconfig.json`
- [X] T005 [P] Configure three Jest projects in `backend/jest.config.ts` — `unit`, `integration`, `persistence` — and add `test:unit`, `test:integration`, `test:persistence`, `test:all`, `lint`, `typecheck` scripts to `backend/package.json`
- [X] T006 [P] Write a multi-stage `backend/Dockerfile`; the build stage MUST include `python3`/`make`/`g++` so the native `bcrypt` binding compiles, and the runtime stage MUST set `UV_THREADPOOL_SIZE` to the container CPU count ([R-002](./research.md#r-002))
- [X] T007 [P] Write `docker-compose.yml` at the repo root with an `api` service and a `postgres:16` service, a named volume, and a healthcheck gating `api` on `postgres`
- [X] T008 [P] Write `backend/.env.example` listing every key from [quickstart.md](./quickstart.md#setup) — `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_COST`, `THROTTLE_TTL`, `THROTTLE_LIMIT`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MINUTES` — with placeholders only, never a real or usable secret

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure plus the protection mechanism every later route inherits.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Why the global guard lives here and not in US3**: Principle V requires protection *by default*.
If the `APP_GUARD` were introduced in US3, then US1 and US2 would ship with every route open, and
turning the guard on later would break both stories unless they already carried `@Public()`. Building
it in the foundation makes "protected unless explicitly opened" true from the first increment
([R-007](./research.md#r-007)). US3 then *proves and consumes* the mechanism rather than introducing it.

### Configuration

- [X] T009 [P] Create the typed config factory in `backend/src/config/configuration.ts` exposing `database`, `jwt`, `bcrypt`, `throttle`, and `loginAttempt` sections — **`JWT_SECRET` MUST have no default, no `??` fallback, and no placeholder value** ([R-004](./research.md#r-004))
- [X] T010 Implement fail-fast boot validation in `backend/src/config/env.validation.ts` and wire it via `ConfigModule.forRoot({ validate, isGlobal: true })` in `backend/src/app.module.ts`; `JWT_SECRET` is required with a minimum length of 32 characters, `BCRYPT_COST` is an int 4–15, `LOGIN_MAX_ATTEMPTS` and `LOGIN_WINDOW_MINUTES` are positive ints
- [X] T011 [P] Unit-test boot validation in `backend/test/unit/config/env.validation.spec.ts` — the app MUST refuse to start when `JWT_SECRET` is absent, empty, or shorter than 32 chars (quickstart step 18)

### Persistence

- [X] T012 Define `User`, `LoginAttempt`, and `ThrottleRecord` in `backend/prisma/schema.prisma` exactly as specified in [data-model.md](./data-model.md) — `User.email` **UNIQUE**, `LoginAttempt` composite index on `(emailKey, attemptedAt)`, `ThrottleRecord.key` as PK with an index on `expiresAt`, `@@map` to `users` / `login_attempts` / `throttle_records`, and **no foreign key from `LoginAttempt` to `User`** (failures must be recordable for emails that do not exist)
- [X] T013 Generate and commit the initial migration into `backend/prisma/migrations/`
- [X] T014 Implement `PrismaService` and a global `PrismaModule` in `backend/src/prisma/`, with `onModuleInit` connect and `enableShutdownHooks`

### Observability & error handling

- [X] T015 [P] Configure `nestjs-pino` in `backend/src/app.module.ts` with a `redact` list covering `req.headers.authorization`, `password`, `passwordHash`, and `accessToken` — the mechanical backstop to FR-025 ([R-010](./research.md#r-010))
- [X] T016 [P] Define `ErrorResponseDto` and `FieldErrorDto` in `backend/src/common/dto/error-response.dto.ts` matching the `ErrorResponse` schema in [contracts/openapi.yaml](./contracts/openapi.yaml) — fields `statusCode`, `error`, `message`, `details?`, `path`, `timestamp`, `requestId`
- [X] T017 Implement `AllExceptionsFilter` in `backend/src/common/filters/all-exceptions.filter.ts`; it MUST log the full cause and stack at `error` level while returning only the envelope, MUST attach a `requestId` correlating the two, and MUST NEVER place a stack trace, driver error, or credential value in the response body (FR-025)
- [X] T018 Unit-test the filter in `backend/test/unit/common/all-exceptions.filter.spec.ts` — an unexpected `Error` yields a 500 envelope with no stack in the body, and its message is not echoed to the caller
- [X] T019 Register the global `ValidationPipe` in `backend/src/main.ts` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, and a custom `exceptionFactory` that aggregates **all** field errors into one `details` array (FR-013), with messages in pt-BR (Constitution VIII)
- [X] T020 Bootstrap Swagger at `/api/docs` with the global prefix `/api` and a `bearerAuth` security scheme in `backend/src/main.ts`

### Protection mechanism

- [X] T021 [P] Create the `@Public()` decorator and `IS_PUBLIC_KEY` constant in `backend/src/common/decorators/public.decorator.ts`
- [X] T022 Implement `TokenService` in `backend/src/auth/token.service.ts` (sign and verify) and configure `JwtModule.registerAsync` — algorithm pinned to **HS256 on both sign and verify**, `expiresIn` set once in module config so no call site can mint a longer-lived token, payload `{ sub, email, jti }` ([R-004](./research.md#r-004))
- [X] T023 Implement `JwtStrategy` in `backend/src/auth/strategies/jwt.strategy.ts` with `algorithms: ['HS256']`, `ignoreExpiration: false`, and `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()` — omitting `algorithms` is what permits algorithm-confusion forgery
- [X] T024 Implement `JwtAuthGuard` in `backend/src/auth/guards/jwt-auth.guard.ts`, reading `IS_PUBLIC_KEY` through `Reflector.getAllAndOverride(handler, class)` so a controller can be opened wholesale while a handler stays protected
- [X] T025 Register `JwtAuthGuard` as an `APP_GUARD` provider in `backend/src/app.module.ts`
- [X] T026 [P] Add a `@Public()` health endpoint at `GET /health` in `backend/src/health/health.controller.ts`
- [X] T027 Integration-test the default in `backend/test/integration/guard-default.e2e-spec.ts` — `GET /health` returns 200 without a token, and a scratch controller route carrying **no** decorator returns 401

**Checkpoint**: App boots, refuses to start without a secret, logs structurally, returns one error
shape, and denies every route that has not explicitly opted out.

---

## Phase 3: User Story 1 - Register a New Account (Priority: P1) 🎯 MVP

**Goal**: An unauthenticated visitor creates an account with an email and password, usable
immediately.

**Independent Test**: `POST /auth/register` with valid values returns 201; repeating it returns 409.
Nothing from US2–US4 need exist.

### Tests for User Story 1

> Write these first and confirm they fail before implementing.

- [X] T028 [P] [US1] Integration tests for `POST /auth/register` in `backend/test/integration/auth-register.e2e-spec.ts` covering spec US1 §1–§6: 201 with `{id, email, createdAt}` and **no password field**; 409 on duplicate; 409 for `"  PRODUTOR@AgroHub.com.BR  "` against an existing `produtor@agrohub.com.br`; 400 listing **both** email and password errors at once; 400 naming `role` and `isAdmin` as forbidden; 201 for a well-formed address whose domain does not exist
- [X] T029 [P] [US1] Unit tests for `PasswordService.hash` in `backend/test/unit/auth/password.service.spec.ts` — output is a bcrypt hash, differs across two calls on the same input (per-hash salt), and honours `BCRYPT_COST`
- [X] T030 [P] [US1] Unit tests for `RegisterDto` in `backend/test/unit/auth/register.dto.spec.ts` — rejects passwords under 8 characters, rejects those over **72 bytes measured with `Buffer.byteLength`** (include an accented-character case that is under 72 *characters* but over 72 *bytes*), rejects a password with no digit and one with no letter, rejects malformed emails, and confirms the transform lowercases and trims
- [X] T031 [US1] Persistence test in `backend/test/persistence/register-concurrency.spec.ts` — fire N simultaneous registrations of the same address against real Postgres and assert exactly one row and N−1 conflicts (FR-002; this is the unique constraint itself, so it cannot be verified with a faked repository)

### Implementation for User Story 1

- [X] T032 [P] [US1] Define the `User` entity and an **explicit** response projection in `backend/src/users/entities/user.entity.ts` mapping only `{ id, email, createdAt }` — never a spread of the record, so a column added later stays invisible until deliberately exposed (FR-007)
- [X] T033 [P] [US1] Implement `RegisterDto` in `backend/src/auth/dto/register.dto.ts` — `@IsEmail()` (string form only, no MX or deliverability check per FR-003), `@MaxLength(254)` on email, `@Transform` applying `trim().toLowerCase()`, password `@MinLength(8)` plus a custom byte-length validator capping at **72 bytes**, and a `@Matches` requiring at least one letter and one digit; `@ApiProperty` descriptions in pt-BR
- [X] T034 [P] [US1] Implement `PasswordService.hash` in `backend/src/auth/password.service.ts` using `bcrypt` with the cost from config
- [X] T035 [P] [US1] Implement `UsersRepository` in `backend/src/users/users.repository.ts` with `create` and `findByEmail` — **the only place Prisma is touched for users** (Constitution II); no service may import `PrismaClient` directly
- [X] T036 [US1] Implement `AuthService.register` in `backend/src/auth/auth.service.ts` — hash, persist, and translate Prisma `P2002` into a 409; the duplicate check is the database constraint, not a pre-flight `findByEmail`, which would be a check-then-insert race (depends on T033, T034, T035)
- [X] T037 [US1] Add `POST /auth/register` to `backend/src/auth/auth.controller.ts` marked `@Public()`, returning 201, with `@ApiOperation`/`@ApiResponse` matching [contracts/openapi.yaml](./contracts/openapi.yaml) — summaries and descriptions in pt-BR
- [X] T038 [US1] Emit a structured registration log from `AuthService.register` in `backend/src/auth/auth.service.ts` carrying outcome, `userId`, and timestamp — message text in **English**, never the email's password (FR-026, Constitution VIII)

**Checkpoint**: Registration works end to end and is demonstrable on its own. This is the MVP.

---

## Phase 4: User Story 2 - Log In with Existing Credentials (Priority: P2)

**Goal**: A registered holder exchanges email and password for a signed, expiring token.

**Independent Test**: Seed one account, log in correctly to receive a token, then log in wrongly and
receive an indistinguishable rejection.

### Tests for User Story 2

- [X] T039 [P] [US2] Integration tests for `POST /auth/login` in `backend/test/integration/auth-login.e2e-spec.ts` covering spec US2 §1–§4 — 200 with `accessToken`, `tokenType: "Bearer"`, `expiresIn`, and `user`; 401 on wrong password; 401 on unknown email with a **byte-identical** body to the wrong-password case; 400 when the password field is absent
- [X] T040 [P] [US2] Unit test timing parity in `backend/test/unit/auth/timing-parity.spec.ts` — assert `PasswordService.compare` is invoked even when `UsersRepository.findByEmail` returns `null`. Without this, an unknown email returns in ~2 ms and a wrong password in ~250 ms, making login an account-existence oracle that defeats FR-009 ([R-003](./research.md#r-003))
- [X] T041 [P] [US2] Unit tests for `TokenService` in `backend/test/unit/auth/token.service.spec.ts` — a signed token verifies; a tampered payload is rejected; an expired token is rejected; **a token re-signed with a different algorithm is rejected** (algorithm-confusion guard)
- [X] T042 [P] [US2] Unit tests for `LoginDto` in `backend/test/unit/auth/login.dto.spec.ts` — missing, empty, and malformed fields are rejected before any lookup (FR-012, FR-014)

### Implementation for User Story 2

- [X] T043 [P] [US2] Implement `LoginDto` and `AuthResponseDto` in `backend/src/auth/dto/` matching the `LoginRequest` and `LoginResponse` schemas in the contract, with pt-BR `@ApiProperty` text
- [X] T044 [US2] Extend `backend/src/auth/password.service.ts` with `compare`, plus a **dummy hash computed once at module init from a random throwaway value** and a `compareWithDummy` used on the account-miss path so both branches cost the same ([R-003](./research.md#r-003))
- [X] T045 [P] [US2] Implement `LocalStrategy` in `backend/src/auth/strategies/local.strategy.ts` with `usernameField: 'email'`
- [X] T046 [US2] Implement `AuthService.validateCredentials` and `AuthService.login` in `backend/src/auth/auth.service.ts` — on a miss, still run `compareWithDummy` and then throw the **same** `UnauthorizedException` with the same pt-BR message used for a wrong password (depends on T044)
- [X] T047 [US2] Add `POST /auth/login` to `backend/src/auth/auth.controller.ts` marked `@Public()`, returning 200 and documenting 400, 401, and 429 per the contract
- [X] T048 [US2] Emit structured logs for login success and login failure in `backend/src/auth/auth.service.ts` — the failure log may record the attempted email and the reason in English, and MUST NOT record the submitted password or the issued token (FR-025, FR-026)

**Checkpoint**: Registration and login both work independently.

---

## Phase 5: User Story 3 - Use the Issued Credential to Reach Protected Operations (Priority: P3)

**Goal**: A valid token identifies the caller on protected routes; absent, expired, or tampered
tokens are refused.

**Independent Test**: Call `GET /auth/me` with a valid token, with none, and with a tampered one —
200 / 401 / 401.

### Tests for User Story 3

- [X] T049 [P] [US3] Integration tests for `GET /auth/me` in `backend/test/integration/auth-me.e2e-spec.ts` covering spec US3 §1–§4 — 200 returning this account's `{id, email, createdAt}` and no password material; 401 with no header; 401 with a tampered token; 401 with an expired token (sign one with a negative `expiresIn`)
- [X] T050 [P] [US3] Integration test in `backend/test/integration/protected-by-default.e2e-spec.ts` — a scratch route with **no** decorator returns 401, proving protection comes from the global default rather than a per-route decorator someone remembered (quickstart step 11)
- [X] T051 [P] [US3] Unit test `@CurrentUser` in `backend/test/unit/common/current-user.decorator.spec.ts` — extracts the user the strategy attached, and does not fabricate one when absent

### Implementation for User Story 3

- [X] T052 [P] [US3] Implement the `@CurrentUser()` param decorator in `backend/src/common/decorators/current-user.decorator.ts`
- [X] T053 [US3] Add `GET /auth/me` to `backend/src/auth/auth.controller.ts` using `@CurrentUser()`, documented with `@ApiBearerAuth()` and a pt-BR summary
- [X] T054 [US3] Confirm `/auth/me` in `backend/src/auth/auth.controller.ts` returns the T032 projection and never the raw record, asserting on the exact key set in `backend/test/integration/auth-me.e2e-spec.ts` so an added column fails the test rather than leaking silently

**Checkpoint**: The credential is genuinely honoured and the default-deny posture is proven.

---

## Phase 6: User Story 4 - Resist Brute-Force Attacks on Login (Priority: P4)

**Goal**: Repeated failures against one identifier, and floods from one origin, are refused without
revealing whether any credential was correct.

**Independent Test**: Loop failed logins and watch responses switch to 429 with `Retry-After` at the
threshold, then succeed again after the window.

### Tests for User Story 4

- [X] T055 [P] [US4] Integration test the per-identifier limit in `backend/test/integration/rate-limit-identifier.e2e-spec.ts` (spec US4 §1) — attempts 1–5 return 401, attempt 6 returns 429 with `Retry-After`, and **submitting the correct password while limited still returns 429**; a 200 there would confirm to an attacker that the password was right (FR-023)
- [X] T056 [P] [US4] Integration test reset-on-success in `backend/test/integration/rate-limit-reset.e2e-spec.ts` (spec US4 §4) — two failures, then a success, then a further failure returns 401 rather than an immediate 429 (FR-022)
- [X] T057 [P] [US4] Integration test the per-origin limit in `backend/test/integration/rate-limit-origin.e2e-spec.ts` (spec US4 §3) — 25 attempts across 25 **distinct** emails still gets throttled, so rotating the identifier does not bypass the limit
- [X] T058 [P] [US4] Unit tests for `LoginAttemptService` in `backend/test/unit/auth/login-attempt.service.spec.ts` — the window is **rolling**: 5 failures at T−14min plus 1 at T−0 is over the limit, while 5 at T−16min plus 1 at T−0 is not
- [X] T059 [US4] Persistence test in `backend/test/persistence/rolling-window.spec.ts` — the `(emailKey, attemptedAt)` query returns correct counts across the window boundary against real Postgres, and counters written by one connection are visible to another (FR-024)

### Implementation for User Story 4

- [X] T060 [P] [US4] Implement `LoginAttemptRepository` in `backend/src/auth/login-attempt.repository.ts` with `record`, `countSince`, and `deleteForEmail` — the sole Prisma caller for `LoginAttempt`
- [X] T061 [US4] Implement `LoginAttemptService` in `backend/src/auth/login-attempt.service.ts` counting rows where `attemptedAt > now() - LOGIN_WINDOW_MINUTES`; a `failedCount` column would implement a *fixed* window, letting an attacker fire 5 at the end of one window and 5 at the start of the next ([R-006](./research.md#r-006))
- [X] T062 [US4] Wire the check into `AuthService.login` in `backend/src/auth/auth.service.ts` **before any password comparison**, and clear the counter on success — checking first is what makes FR-023 hold, because a limited request never learns whether the password matched (depends on T061)
- [X] T063 [P] [US4] Implement `PrismaThrottlerStorage` in `backend/src/throttling/prisma-throttler.storage.ts` against `@nestjs/throttler`'s `ThrottlerStorage` interface, upserting `ThrottleRecord` and treating rows past `expiresAt` as absent — the interface boundary is what makes a later Redis swap a one-class change ([R-005](./research.md#r-005))
- [X] T064 [US4] Register `ThrottlerModule` with `THROTTLE_TTL`/`THROTTLE_LIMIT` and add `ThrottlerGuard` as an `APP_GUARD` in `backend/src/app.module.ts` **before** `JwtAuthGuard`, so floods are refused before any token work happens
- [X] T065 [US4] Map 429 in `backend/src/common/filters/all-exceptions.filter.ts` to the contract's envelope with a `Retry-After` header and the pt-BR message `"Muitas tentativas. Tente novamente em alguns minutos."` — identical for both limits, so the two are indistinguishable to a caller
- [X] T066 [US4] Add a scheduled cleanup in `backend/src/throttling/cleanup.service.ts` (via `@nestjs/schedule`) pruning `LoginAttempt` and `ThrottleRecord` rows past their windows; unpruned, `LoginAttempt` is the fastest-growing table in the system and its growth rate is controlled by unauthenticated callers — a denial-of-service surface, not untidiness
- [X] T067 [US4] Emit a structured log for every rate-limit refusal from `backend/src/throttling/prisma-throttler.storage.ts` and `backend/src/auth/login-attempt.service.ts`, recording which limit fired, the key, and the retry time (FR-026)

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T068 [P] Write `backend/README.md` in **pt-BR** covering what the system does, how to run it, and how to call it — a newcomer must reach a successful login without reading source (Constitution III, SC-008)
- [X] T069 [P] Diff the live Swagger output at `/api/docs-json` against [contracts/openapi.yaml](./contracts/openapi.yaml) and reconcile any drift (FR-027)
- [X] T070 Add `backend/test/security/log-leak.spec.ts` running the full suite's captured log output through the quickstart step 16 patterns — plaintext passwords, the `$2[aby]$` bcrypt prefix, and the `eyJhbGciOi` JWT prefix — and failing on any hit; this converts a manual grep into a permanent gate (FR-025)
- [X] T071 [P] Verify `UV_THREADPOOL_SIZE` reaches the running container and document in `backend/README.md` that login throughput is bounded by bcrypt on that pool ([R-002](./research.md#r-002))
- [X] T072 Execute all 19 manual steps in [quickstart.md](./quickstart.md), including the step 8 **timing** comparison, which is the check most likely to be skipped and the one that catches a silent FR-010 regression
- [X] T073 Run the full gate from `backend/package.json` — `lint`, `typecheck`, `test:unit`, `test:integration`, `test:persistence` — and confirm every endpoint has an integration test and every business rule a unit test (Constitution IV)
- [X] T074 Measure actual login throughput of the container from `docker-compose.yml` against a defined instance size and record the result in `backend/README.md`, reporting the result versus SC-007; per [R-002](./research.md#r-002) the criterion as written (200 concurrent, 95% under 1 s) is **not** expected to pass, and the outcome feeds the user's decision on restating it

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup — **blocks every user story**
- **US1 (Phase 3)**: needs Foundational
- **US2 (Phase 4)**: needs Foundational; consumes `UsersRepository` (T035) and `PasswordService`
  (T034) from US1. Testable alone by seeding an account, but in practice US1 comes first
- **US3 (Phase 5)**: needs Foundational; consumes the token issued by US2 (T046)
- **US4 (Phase 6)**: needs Foundational; wraps the login path from US2 (T046)
- **Polish (Phase 7)**: needs the stories you intend to ship

### Honest note on story independence

The template's ideal is four fully independent stories. Authentication does not decompose that way:
US2 needs an account to authenticate, US3 needs a token to present, US4 needs a login path to
throttle. Each story is independently **testable** — seed a user, mint a token, drive the loop — but
the delivery order is genuinely P1 → P2 → P3 → P4. Parallelism lives *within* phases, not across
them, and the parallel examples below reflect that rather than pretending otherwise.

### Within Each User Story

- Tests are written first and confirmed failing
- DTOs and entities → services → controller wiring → logging
- Two tasks touching the same file are never both `[P]`: `auth.controller.ts` (T037, T047, T053),
  `auth.service.ts` (T036, T046, T062), `app.module.ts` (T010, T015, T025, T064), and
  `password.service.ts` (T034, T044) are each strictly sequential

### Parallel Opportunities

- Setup: T003–T008 all in parallel after T002
- Foundational: T009+T011, T015+T016, T021+T026 in parallel
- Every story's test tasks are parallel with each other
- US1: T032, T033, T034, T035 in parallel; T036 joins them

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests together (they must fail first):
Task: "Integration tests for POST /auth/register in backend/test/integration/auth-register.e2e-spec.ts"
Task: "Unit tests for PasswordService.hash in backend/test/unit/auth/password.service.spec.ts"
Task: "Unit tests for RegisterDto in backend/test/unit/auth/register.dto.spec.ts"

# Then build the independent pieces together:
Task: "User entity + response projection in backend/src/users/entities/user.entity.ts"
Task: "RegisterDto in backend/src/auth/dto/register.dto.ts"
Task: "PasswordService.hash in backend/src/auth/password.service.ts"
Task: "UsersRepository in backend/src/users/users.repository.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1
4. **Stop and validate**: quickstart steps 1–6 pass
5. Demo: accounts can be created, and every route that is not `@Public()` already refuses callers

MVP is T001–T038 (38 tasks). Note it is deliberately front-loaded: the foundation carries the
config guard, error envelope, logging, and default-deny posture that all three later stories inherit,
so Phases 4–6 are comparatively thin.

### Incremental Delivery

| Increment | Tasks | Delivers |
|-----------|-------|----------|
| Setup + Foundational | T001–T027 | Boots, fails fast without a secret, default-deny |
| + US1 | T028–T038 | **MVP** — accounts exist |
| + US2 | T039–T048 | Login issues tokens |
| + US3 | T049–T054 | Tokens actually grant access |
| + US4 | T055–T067 | Brute-force resistance — **required before public exposure** |
| + Polish | T068–T074 | pt-BR README, contract diff, log-leak gate, SC-007 measurement |

**Do not expose the service publicly before US4.** Without it, login is an unthrottled password
oracle; the spec files it as P4 only because it cannot be built before the login path exists.

### Parallel Team Strategy

Two developers after Foundational: one takes US1 → US2 (the credential path, one continuous thread
through `auth.service.ts`), the other takes T063–T066 (throttler storage and cleanup, all separate
files) and the Phase 7 tooling, converging on T062's wiring once US2 lands.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task
- Every task names its file path; task IDs run T001–T074 with no gaps
- Verify tests fail before implementing
- Commit per task or logical group, messages in English (Constitution VIII)
- Three tasks carry security weight out of proportion to their size — **T040** (timing parity),
  **T062** (limit checked before password comparison), and **T070** (log-leak gate). Each is a few
  lines, and each silently undoes a requirement if skipped
