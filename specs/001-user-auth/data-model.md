# Data Model: User Authentication

**Feature**: `001-user-auth` | **Date**: 2026-09-09 | **Plan**: [plan.md](./plan.md)

Three tables. Traceability to spec entities and requirements is given per table.

---

## `User`

Spec entity: **User Account**. The account that can sign in.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (uuid) | PK, default `uuid()` | Surrogate key. The email is *not* the key — a future "change email" feature would otherwise cascade through every foreign key. |
| `email` | `String` | **UNIQUE**, indexed | Stored already normalised: `trim().toLowerCase()` (FR-004). The unique constraint is what actually delivers FR-002 under concurrency. |
| `passwordHash` | `String` | required | bcrypt output, cost 12. Never selected into any response DTO. |
| `createdAt` | `DateTime` | default `now()` | |
| `updatedAt` | `DateTime` | `@updatedAt` | |

**Validation rules** (enforced in the DTO, before the repository is reached — FR-012):

- `email` — non-empty, `@IsEmail()` string-form check only. No MX lookup, no verification mail
  (FR-003). Normalised by a `@Transform` on the DTO so the service and repository only ever see the
  canonical form.
- `password` — minimum 8 characters; **maximum 72 bytes** measured with `Buffer.byteLength`, not
  `.length` (FR-005 + bcrypt truncation, [R-001](./research.md#r-001)); at least one letter and one
  digit. Never persisted — only its hash is.
- Unrecognised fields are rejected outright by `forbidNonWhitelisted` (FR-006), so a payload
  carrying `role` or `isAdmin` fails rather than being quietly dropped.

**Relationships**: none in this feature. `LoginAttempt` deliberately does *not* carry a foreign key
to `User` — see below.

**State transitions**: none. There is no verification state, no enabled/disabled flag, no role —
spec Q2 confirmed accounts are usable the moment they exist. Adding any of those later is a schema
migration plus a guard change, and FR-006 is what stops a client setting them in the meantime.

**Response projection**: every endpoint returning a user returns `{ id, email, createdAt }`. The
mapping is explicit rather than "the entity minus some fields", so a future column is invisible to
the API until someone deliberately exposes it — an omission fails closed (FR-007).

---

## `LoginAttempt`

Spec entity: **Login Attempt Counter** (per-identifier half). One row per *failed* login.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (uuid) | PK | |
| `emailKey` | `String` | indexed with `attemptedAt` | The normalised email that was attempted. |
| `attemptedAt` | `DateTime` | default `now()` | Timestamp the rolling window counts against. |

**Index**: composite on `(emailKey, attemptedAt)` — the only query is "how many rows for this key
since T", and it runs on the hot path of every login.

**Why individual rows rather than a counter column**: FR-020 says a *rolling* 15-minute window. A
single `failedCount` + `windowStartedAt` implements a *fixed* window, which lets an attacker fire 5
attempts at the end of one window and 5 more at the start of the next — 10 within seconds, exactly
the behaviour FR-020 exists to stop. Counting timestamped rows makes the window genuinely rolling
([R-006](./research.md#r-006)).

**Why no foreign key to `User`**: failed logins are recorded for emails that *do not exist* — that
is most of what a credential-stuffing attack looks like. A foreign key would make those rows
unstorable and blind the limiter to the attack it most needs to see. It would also turn the table
into an account-existence oracle for anyone with database read access.

**Lifecycle**:

- *Written* on every failed login attempt, whether or not the email matches an account.
- *Deleted* for that `emailKey` on a successful login (FR-022).
- *Pruned* by a scheduled cleanup deleting rows older than the window. Without pruning this is the
  fastest-growing table in the system and an unauthenticated party controls its growth rate — it is
  a denial-of-service surface, not merely untidiness.

**Privacy note**: the table holds attempted email addresses, including ones typed by mistake. It
carries no passwords, is covered by FR-025's prohibition on logging credential material, and the
pruning window doubles as its retention limit.

---

## `ThrottleRecord`

Spec entity: **Login Attempt Counter** (per-origin half). Backing store for
`@nestjs/throttler` ([R-005](./research.md#r-005)).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `key` | `String` | PK | Throttler-generated: origin + route. |
| `hits` | `Int` | default `0` | Requests counted in the current window. |
| `expiresAt` | `DateTime` | indexed | When the window closes. |

**Lifecycle**: upserted per request to a throttled route (`hits + 1`, `expiresAt` set on first hit
of a window); rows past `expiresAt` are treated as absent on read and removed by the same cleanup
job as `LoginAttempt`.

**Why a table and not Redis**: FR-024 requires counters shared across instances, which rules out
in-memory storage; Redis would be new infrastructure and therefore a Principle VII stack change
requiring a constitution amendment first. At FR-021's ceiling of 20 requests/min/origin an indexed
upsert is nowhere near a bottleneck. The whole table exists behind `@nestjs/throttler`'s
`ThrottlerStorage` interface, so switching to Redis later replaces one class and nothing else.

---

## Prisma schema sketch

Indicative — the authoritative version lands in `backend/prisma/schema.prisma`.

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}

model LoginAttempt {
  id          String   @id @default(uuid())
  emailKey    String
  attemptedAt DateTime @default(now())

  @@index([emailKey, attemptedAt])
  @@map("login_attempts")
}

model ThrottleRecord {
  key       String   @id
  hits      Int      @default(0)
  expiresAt DateTime

  @@index([expiresAt])
  @@map("throttle_records")
}
```

---

## Requirement coverage

| Requirement | Where it is satisfied |
|-------------|----------------------|
| FR-002 (one account per address, under concurrency) | `User.email` UNIQUE; Prisma `P2002` → `409` |
| FR-003 (string-form email check only) | `@IsEmail()` on the DTO; no outbound call anywhere |
| FR-004 (normalisation) | `@Transform` on the DTO; only the canonical form is stored |
| FR-005 (password policy) | DTO validators, max measured in **bytes** |
| FR-006 (no privileged fields) | `whitelist` + `forbidNonWhitelisted` |
| FR-007 / FR-019 (never expose password material) | Explicit response projection, `passwordHash` never mapped |
| FR-015 (irreversible storage) | `passwordHash` only; no plaintext column exists to misuse |
| FR-020 (5 failures / rolling 15 min) | `LoginAttempt` row count over `(emailKey, attemptedAt)` |
| FR-021 (20 req/min per origin) | `ThrottleRecord` via `ThrottlerStorage` |
| FR-022 (reset on success) | Delete `LoginAttempt` rows for the `emailKey` |
| FR-024 (shared across instances) | Both counters live in Postgres, not process memory |
