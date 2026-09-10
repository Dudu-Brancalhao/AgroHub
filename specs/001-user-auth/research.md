# Phase 0 Research: User Authentication

**Feature**: `001-user-auth` | **Date**: 2026-09-09 | **Plan**: [plan.md](./plan.md)

Decisions taken before design, with the alternatives that were rejected. Three of these
(R-002, R-005, R-009) materially affect scope or collide with a constitutional rule and are
called out again in the plan.

---

## R-001: Password hashing algorithm and cost factor

**Decision**: `bcrypt` (native binding, not `bcryptjs`), cost factor **12**, read from
`BCRYPT_COST` so it can be lowered in test runs.

**Rationale**: Constitution Principle V names bcrypt explicitly, so the algorithm is not open for
debate. Cost 12 is comfortably above the OWASP floor of 10 and lands around 200–300 ms per hash on
current server hardware. The native binding is roughly an order of magnitude faster than the pure-JS
`bcryptjs` and releases the event loop while hashing, which `bcryptjs` does not — that difference is
the whole basis of R-002 below.

Tests set `BCRYPT_COST=4`. A cost-12 hash in every fixture would add minutes to the suite for no
extra coverage; the algorithm under test is the same either way.

**Alternatives considered**:

- *argon2id* — the stronger modern choice and what a greenfield project would normally pick, but
  Principle V mandates bcrypt. Changing it requires a constitution amendment, which is not worth
  opening for this feature.
- *`bcryptjs`* — pure JS, no build toolchain in the Docker image. Rejected: it runs on the main
  thread and would block the event loop for the entire hash, turning R-002's throughput problem
  into an availability problem.

**Consequence for FR-005**: bcrypt silently truncates input at **72 bytes**. A password policy that
allows more than that would let two different passwords authenticate the same account, so the
maximum length in FR-005 is fixed at 72 *bytes* — validated with `Buffer.byteLength`, not
`.length`, since a password of accented or emoji characters reaches 72 bytes well before 72
characters.

---

## R-002: Meeting SC-007 (200 concurrent logins, 95% under one second) — **cannot be met as written**

**Decision**: Keep cost factor 12 and **flag SC-007 as not achievable on a single small instance**.
Set `UV_THREADPOOL_SIZE` explicitly to the container's CPU count, and re-measure SC-007 against a
realistic load profile before treating it as a release gate.

**Rationale**: This is arithmetic, not opinion. Native bcrypt runs on the libuv thread pool, which
defaults to **4 threads** regardless of core count. At cost 12 (~250 ms per hash):

```
200 concurrent logins x 250 ms / 4 threads = ~12.5 seconds for the last response
```

The p95 lands near 12 seconds, not the 1 second SC-007 asks for. Raising the pool to 8 threads on a
4-core box halves it to ~6 s; the pool cannot outrun the cores. Dropping to cost 10 (~65 ms) with 8
threads gives ~1.6 s — still short, and it buys the shortfall with weaker hashes.

The honest reading is that **SC-007 and FR-020/FR-021 describe incompatible situations**. Two
hundred *concurrent* logins from distinct origins is precisely the traffic the rate limiter exists
to refuse; a rate-limited rejection costs one indexed query and returns in milliseconds. The
expensive path — 200 simultaneous *legitimate, correct-password* logins — is not a realistic
steady state for this product at launch, and if it becomes one, the fix is horizontal scaling
(FR-024 already requires shared counters, so scaling out is supported by design).

**Recommendation**: keep cost 12, and restate SC-007 as a measured target on a defined instance size
and a mixed load profile rather than a fixed 200-concurrent figure. Left in the spec unchanged for
now — this is a plan-level risk to raise, not a spec edit to make unilaterally.

**Alternatives considered**:

- *Cost factor 10* — closes maybe half the gap, still misses, and permanently weakens every stored
  hash to buy a benchmark number. Rejected.
- *Offload hashing to a worker pool* — real complexity (a second process model, backpressure,
  failure handling) for a load level the product has not yet seen. Rejected under Principle I
  (YAGNI) and the plan's own "complexity must be justified" gate.

---

## R-003: Timing parity between "unknown email" and "wrong password" (FR-010)

**Decision**: When no account matches the submitted email, still run a bcrypt comparison against a
**dummy hash computed once at module startup**, then return the same generic failure.

**Rationale**: The natural implementation returns early when the lookup misses, so a wrong password
costs a ~250 ms hash and an unknown email costs ~2 ms. That gap is trivially measurable over a few
requests and turns the login endpoint into an account-existence oracle, defeating FR-009's
identical message entirely. Comparing against a fixed dummy hash of the same cost makes both paths
cost the same.

The dummy hash is generated at startup from a random throwaway value, never from a real password,
and is held in memory only.

**Alternatives considered**:

- *Fixed artificial delay (e.g. `sleep(250ms)`)* — the delay is added to the real path too, or it
  isn't, and either way the variance still leaks. Also slows every legitimate login. Rejected.
- *Ignoring the requirement* — FR-010 is explicit and the mitigation is about five lines.

---

## R-004: Login credential issuance

**Decision**: `@nestjs/jwt` with `@nestjs/passport`. `JwtModule.registerAsync` pulling `JWT_SECRET`
and `JWT_EXPIRES_IN` from `ConfigService`. Algorithm pinned to **HS256** on both signing and
verification. Payload carries `sub` (user id), `email`, `iat`, `exp`, `jti`.

**Rationale**: Matches the user's stated approach and Principle VII. Pinning the algorithm on the
*verify* side matters: leaving it open is what allows an `alg: none` or algorithm-confusion forgery,
and `passport-jwt` will accept whatever the token claims unless `algorithms: ['HS256']` is set
explicitly. `jti` costs nothing now and is what a future revocation feature would key on.

`JWT_SECRET` is validated at boot (R-006) and has **no default value anywhere in the codebase** —
not in a config factory, not as a `??` fallback, not in `.env.example` beyond a placeholder. A
fallback secret is functionally a hardcoded secret, since it is what runs whenever the real one
fails to load.

---

## R-005: Rate-limit counter storage — **collides with Principle VII**

**Decision**: Store counters in **PostgreSQL via Prisma**. Do **not** introduce Redis.

**Rationale**: FR-024 requires counters shared across instances, which rules out the default
in-memory storage of `@nestjs/throttler`. The reflexive answer is Redis, and for a high-traffic
counter it would be the right one. But Redis is not on the Principle VII stack list, and it is not
a library — it is a new running service, a new Docker Compose service, new operational surface, and
a new failure mode. That is a stack change requiring a constitution amendment *before*
implementation begins.

It is also unnecessary at this volume. These counters are written only on authentication attempts,
which FR-021 caps at 20 per minute per origin. An indexed upsert against Postgres at that rate is
nowhere near a bottleneck, and it keeps the whole feature deployable with the services the project
already declares.

**If the user prefers Redis**, that is a legitimate choice — but the correct order is
`/speckit-constitution` to amend Principle VII first, then revisit this decision. It should not be
smuggled in as an implementation detail.

**Alternatives considered**:

- *`@nestjs/throttler` default in-memory storage* — violates FR-024 outright. Each instance keeps
  its own count, so an attacker gets N × the allowance simply by being load-balanced. Rejected.
- *Redis via `nestjs-throttler-storage-redis`* — the scalable answer, blocked on an amendment as
  above. Recorded as the migration path once auth traffic justifies it; the storage interface below
  is designed so the swap touches one class.

**Design note**: the Postgres backing is placed behind `@nestjs/throttler`'s `ThrottlerStorage`
interface, so moving to Redis later means providing a different implementation of one interface and
changing nothing else.

---

## R-006: Two rate limits, two mechanisms

**Decision**: Implement the per-origin limit (FR-021) as a **guard** via `@nestjs/throttler` with
the custom Postgres storage from R-005. Implement the per-identifier failed-attempt limit (FR-020,
FR-022) as a **service**, `LoginAttemptService`, called from `AuthService.login`.

**Rationale**: They look similar and are not. The per-origin limit is a pure request-rate concern,
knowable from the request alone, and belongs in a guard — `@nestjs/throttler` also supplies the
`Retry-After` header FR-023 requires. The per-identifier limit counts *failures*, resets on success
(FR-022), and keys on a field inside the validated request body. That is a business rule, and
Principle II puts business rules in the service layer, not in a guard reaching into the request body
before validation has run.

Ordering inside `login`: check the identifier limit **before** any password comparison, so a
rate-limited caller gets a fast 429 and FR-023 holds — the response cannot reveal whether the
password was right, because it was never checked.

**Window semantics**: FR-020 says *rolling* 15 minutes, so failures are stored as individual
timestamped rows and counted with `attemptedAt > now() - 15 min`. A fixed-window counter would let
an attacker fire 5 attempts at the end of one window and 5 more at the start of the next — 10 in
seconds — which is the exact behaviour FR-020 exists to prevent.

---

## R-007: Global authentication guard with `@Public()` opt-out

**Decision**: Register `JwtAuthGuard` as an `APP_GUARD` so every route is protected by default.
Public routes opt out with a `@Public()` decorator setting `IS_PUBLIC_KEY` metadata, which the
guard reads through `Reflector.getAllAndOverride` across handler and class.

**Rationale**: Directly requested, and it is the correct default under Principle V — protection you
must remember to add is protection that will eventually be forgotten, whereas an accidentally
public route requires someone to type `@Public()` and survive review. `getAllAndOverride` (rather
than `get`) lets a controller be marked public wholesale while an individual handler stays
protected.

Guard registration order matters: `ThrottlerGuard` is registered **before** `JwtAuthGuard`, so
unauthenticated floods are refused before any token work happens.

Only three routes carry `@Public()` in this feature: `POST /auth/register`, `POST /auth/login`, and
`GET /health`.

---

## R-008: Consistent error handling that never leaks credential detail

**Decision**: A single `AllExceptionsFilter` registered globally, emitting one response envelope for
every failure. A global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`,
`transform: true`, and a custom `exceptionFactory` that aggregates *all* field errors into one
response.

**Rationale**: `whitelist` + `forbidNonWhitelisted` is what satisfies FR-006 — an unrecognised
`role` or `isAdmin` field in the registration payload is rejected outright rather than silently
carried into the service. The aggregating `exceptionFactory` satisfies FR-013; Nest's default
surfaces errors in a shape that is awkward to consume field-by-field.

The filter maps every internal failure to its envelope, and critically **logs the full error while
returning only the safe envelope** — the stack trace and the cause go to the log (FR-026), the
caller gets a message and a request id (FR-025). Invalid credentials always map to `401` with one
fixed message regardless of whether the email existed (FR-009).

**Language split** (Principle VIII, worth stating because it is easy to get backwards): the message
returned to the API caller is end-user-facing content and is written in **pt-BR**
(`"E-mail ou senha inválidos."`); the log line describing the same event is a technical log and is
written in **English** (`"login failed: credential mismatch"`). OpenAPI summaries and descriptions
are likewise pt-BR.

---

## R-009: How integration tests get a database without "external real state"

**Decision**: Two tiers.

1. **Default suite** — boots the real `AppModule` through `Test.createTestingModule` and overrides
   `PrismaService` with an in-memory fake. Exercises the genuine HTTP stack: routing, the global
   `ValidationPipe`, both guards, the exception filter, the controllers, and the services. No
   database, no containers, fully deterministic, runs in CI in seconds.
2. **Persistence suite** — a small number of tests run against a disposable Postgres started by
   `docker compose` and destroyed afterwards, covering only the guarantees that *are* the database:
   the unique-email constraint under concurrency (FR-002) and the rolling-window query (FR-020).

**Rationale**: Constitution Principle IV requires every endpoint to have an integration test and
forbids depending on external real state. Tier 1 satisfies the first without touching the second.
But FR-002's concurrency guarantee **is** the unique constraint — mocking the repository that
enforces it would produce a test that passes while the real behaviour is broken, which is worse
than no test. Tier 2 covers exactly that, and no more.

**Interpretation applied**: "external real state" means state the test does not own — a live
third-party API, a shared team database, production data. A Postgres container created and destroyed
by the test run is owned, isolated, and reproducible, so it does not fall foul of Principle IV.
This reading is recorded here so it is reviewable rather than assumed.

**Alternatives considered**:

- *SQLite for tests* — different engine, different constraint and concurrency semantics, so it
  cannot verify the one thing tier 2 exists to verify. Rejected.
- *Mocking everything* — leaves FR-002 untested at the only layer where it is real. Rejected.

---

## R-010: Structured logging without a stack amendment

**Decision**: Use `nestjs-pino` + `pino` for JSON-structured logs, with a redaction list covering
`password`, `passwordHash`, `authorization`, and `accessToken`.

**Rationale**: Principle VI requires structured logs carrying level, context, and timestamp; pino
emits exactly that and its `redact` option is a second, mechanical line of defence for FR-025 —
belt and braces alongside never passing those values to a logger in the first place.

**Interpretation applied** (same boundary as R-005, stated once and used consistently): Principle
VII governs **platform and infrastructure** choices — the framework, the ORM, the database, the
container runtime. Ordinary libraries *within* that platform are not stack changes, or every npm
install would require a constitution amendment. Redis is on the far side of that line because it is
a new running service; pino is not, because it is a library inside the existing Nest process. This
boundary is surfaced in the plan's Constitution Check for review.

---

## R-011: Email normalisation

**Decision**: `email.trim().toLowerCase()` before storing or comparing. Store only the normalised
form. Enforce uniqueness with a Prisma `@unique` on the column; on Prisma error `P2002`, return
`409`.

**Rationale**: Satisfies FR-004 and, with the unique constraint, FR-002 under concurrency — two
simultaneous registrations resolve to one insert and one `P2002`, which is a database guarantee
rather than a check-then-insert race in application code.

Lowercasing the local part is technically not RFC 5321 compliant (`Joao@x.com` and `joao@x.com` may
formally be different mailboxes). Every mainstream provider treats them as the same, and users
overwhelmingly expect that, so normalising is the right call — noted here because it is a
deliberate deviation from the letter of the standard.

**Validation**: `class-validator`'s `@IsEmail()` checks string form only, which is precisely and
only what FR-003 asks for. No MX lookup, no verification mail, no outbound dependency.

---

## R-012: Token validity period

**Decision**: `JWT_EXPIRES_IN=1h`, configurable, no default fallback in code.

**Rationale**: Confirms the spec's proposed default. The spec's Assumptions record why the number
matters more than usual here: with no refresh mechanism and no revocation (spec Q3), the expiry is
the *only* thing bounding the damage from a leaked token. One hour balances that against making
users re-enter their password all day.

`expiresIn` is set once in `JwtModule` configuration rather than per-signature, so no call site can
accidentally mint a longer-lived token.

---

## Resolved unknowns summary

| Unknown | Resolution |
|---------|-----------|
| Hash algorithm and cost | bcrypt, cost 12, max password 72 **bytes** (R-001) |
| SC-007 achievability | **Not met as written**; raised as a plan risk (R-002) |
| Timing-attack parity | Dummy-hash comparison on the miss path (R-003) |
| Token shape and algorithm | HS256 pinned both ways, `sub`/`email`/`jti` (R-004) |
| Shared rate-limit storage | Postgres via Prisma; Redis needs an amendment first (R-005) |
| Two limits, one mechanism? | Guard for per-origin, service for per-identifier (R-006) |
| Global guard opt-out | `APP_GUARD` + `@Public()` via `Reflector` (R-007) |
| Error envelope and leakage | Global filter; pt-BR to caller, English to log (R-008) |
| Integration tests vs. real DB | Two tiers; only DB-guarantees hit a container (R-009) |
| Structured logging | `nestjs-pino`; library ≠ stack change (R-010) |
| Email normalisation | trim + lowercase, unique constraint, `P2002` → 409 (R-011) |
| Token lifetime | 1h, configurable, no code fallback (R-012) |
