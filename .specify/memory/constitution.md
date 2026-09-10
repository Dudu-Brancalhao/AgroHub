<!--
Sync Impact Report (1.2.0)
- Version change: 1.1.0 → 1.2.0
- Bump rationale: MINOR — Principle VII's mandated frontend stack gains one entry
  (Material Icons). No principle is removed or redefined.
- Modified principles:
  - VII. Mandated Technology Stack — `@mui/icons-material` added to the frontend stack.
- Amendment rationale: requested directly by the product owner for feature 005-web-frontend,
  replacing the hand-written inline SVG icon set. Material Icons is a maintained, consistent,
  widely recognised set; hand-drawn glyphs drift in weight and optical size as they accumulate.
- Cost recorded, because it is not free: `@mui/icons-material` requires `@mui/material`, which
  brings `@emotion/react` and `@emotion/styled`. The application therefore carries a second
  CSS-in-JS runtime alongside the mandated styled-components, for roughly +40 kB gzipped. Emotion
  is present ONLY as a transitive dependency of the icon set — application styling remains
  styled-components, and authoring a component with Emotion would be a further deviation
  requiring its own amendment.
- Migration path: `src/icons/index.tsx` re-exports Material Icons behind the same role-named
  components the codebase already imported (`ProducersIcon`, `TrashIcon`, …), so no call site
  changed. Icons are imported one deep path at a time rather than from the package barrel, to
  keep ~2000 modules out of the bundle.
- Templates requiring review: none.
- Deferred TODOs: none

Sync Impact Report (1.1.0)
- Version change: 1.0.0 → 1.1.0
- Bump rationale: MINOR — Principle VII's mandated frontend stack is materially expanded by
  one entry (client-side routing). No principle is removed or redefined, so this is not MAJOR;
  it changes obligations, so it is not PATCH.
- Modified principles:
  - VII. Mandated Technology Stack — `react-router-dom` added to the frontend stack.
- Amendment rationale: feature 005-web-frontend requires per-destination addresses that are
  bookmarkable and reloadable, Back/Forward navigation, a sign-in redirect that returns the
  visitor to the destination originally requested, search state carried in the address, and a
  nested layout route so navigation replaces only the main area while the shell stays mounted
  (spec.md FR-005, FR-006, FR-010, FR-024). Hand-rolling this is roughly 200 lines of routing
  infrastructure carrying no business rule, which Principle IV would then oblige us to test —
  a larger KISS and YAGNI violation than the dependency. Full analysis:
  specs/005-web-frontend/research.md (R-001) and specs/005-web-frontend/plan.md
  (Complexity Tracking).
- Migration path: none required. No existing code is rendered non-compliant — the backend is
  untouched and no frontend existed before this amendment. Icon, charting, decimal-arithmetic
  and document-validation libraries were each considered for the same feature and deliberately
  hand-written instead, so this amendment adds exactly one dependency rather than five.
- Templates requiring review: none — no template asserts the stack contents.
- Deferred TODOs: none

Sync Impact Report (1.0.0)
- Version change: none (template placeholders) → 1.0.0
- Bump rationale: initial ratification; all placeholder tokens replaced with concrete,
  project-specific governance for AgroHub.
- Modified principles:
  - [PRINCIPLE_1_NAME] → I. Code Quality (SOLID, KISS, Clean Code)
  - [PRINCIPLE_2_NAME] → II. Layered Architecture
  - [PRINCIPLE_3_NAME] → III. Explicit API Contracts
  - [PRINCIPLE_4_NAME] → IV. Test Coverage (NON-NEGOTIABLE)
  - [PRINCIPLE_5_NAME] → V. Security by Default
  - (added) VI. Observability
  - (added) VII. Mandated Technology Stack
  - (added) VIII. Language Policy
- Added sections:
  - Additional Constraints (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])
- Removed sections: none
- Templates requiring review: .specify/templates/plan-template.md,
  .specify/templates/spec-template.md, .specify/templates/tasks-template.md,
  .specify/templates/checklist-template.md — these read the constitution at runtime and
  were not modified by this command.
- Deferred TODOs: none
-->

# AgroHub Constitution

## Core Principles

### I. Code Quality (SOLID, KISS, Clean Code)

All production code MUST follow SOLID, KISS, and Clean Code practices. Every function, class,
and module MUST have a single, clearly stated responsibility; a unit that requires "and" to
describe what it does MUST be split. Names MUST reveal intent without needing a comment to
explain them. Dead code, commented-out code, and speculative abstractions (YAGNI violations)
MUST NOT be merged.

Rationale: single-responsibility units are the precondition for the testability, layering,
and review speed the rest of this constitution depends on.

### II. Layered Architecture

Every feature MUST be split into explicit layers: controller (HTTP entry) → service (business
rule) → repository/ORM (persistence). Controllers MUST only parse, validate, delegate, and map
responses. Business rules MUST NOT live in controllers or in data-access code. Repositories
MUST be the only place Prisma is called; services MUST NOT import the Prisma client directly.
Dependencies point inward only — a repository MUST NOT depend on a service, and a service MUST
NOT depend on a controller.

Rationale: a single direction of dependency keeps business rules unit-testable without HTTP or
a database, and keeps persistence swappable.

### III. Explicit API Contracts

Every public endpoint MUST be documented in OpenAPI (Swagger) and typed with DTOs validated at
runtime (class-validator plus a global ValidationPipe with whitelisting enabled). Request and
response shapes MUST be declared as DTO classes — untyped payloads MUST NOT cross a controller
boundary. The project README MUST let a newcomer understand what the system does, how to run
it, and how to call it, without reading source code.

Rationale: the contract is the product surface; if it is only discoverable by reading code, it
is not a contract.

### IV. Test Coverage (NON-NEGOTIABLE)

Every business rule MUST have a unit test. Every endpoint MUST have an integration test
covering success, validation failure, and authorization failure. Tests MUST use mock or fixture
data and MUST NOT depend on external real state (live third-party APIs, shared databases,
production data, wall-clock ordering). Tests MUST be deterministic and independently runnable in
any order. A change to a business rule without a corresponding test change MUST NOT be merged.

Rationale: tests bound to real external state fail for reasons unrelated to the change under
review, and quickly stop being trusted.

### V. Security by Default

Every endpoint that mutates data MUST require authentication. Authentication MUST be implemented
with Passport (LocalStrategy for credential login, JwtStrategy for subsequent requests).
Passwords MUST be stored hashed with bcrypt and MUST NEVER be stored, logged, or returned in
plain text. Sensitive data — passwords, tokens, secrets, personal documents — MUST NEVER appear
in logs, error messages, or API responses. Secrets MUST come from environment configuration and
MUST NEVER be committed to the repository. Endpoints are protected by default; any public
mutating endpoint MUST be justified in review.

Rationale: security applied per-endpoint by memory fails silently; making protection the default
makes each exception visible.

### VI. Observability

Every significant business operation MUST emit a structured log carrying at minimum level,
context, and timestamp, and MUST exclude sensitive data. Errors MUST be logged with enough
context — operation, identifiers, and cause — to diagnose the failure without reproducing it.
Logs MUST be machine-parseable rather than free-form prose strings.

Rationale: production incidents are diagnosed from what was already recorded; context absent at
write time cannot be recovered later.

### VII. Mandated Technology Stack

The backend MUST use TypeScript, NestJS, Prisma ORM, PostgreSQL, Docker, and Swagger. The
frontend MUST use ReactJS, Redux, Vite, Styled Components, Jest, React Testing Library,
react-router-dom for client-side routing, and Material Icons (`@mui/icons-material`) for
iconography. Introducing a technology outside this stack, or replacing one within it, MUST be
justified in writing and MUST be recorded as a constitution amendment before implementation
begins.

Emotion enters the dependency tree as a transitive requirement of Material Icons. It is NOT an
approved styling library: application styling MUST remain Styled Components, and authoring a
component with Emotion requires its own amendment.

Redux Toolkit (`@reduxjs/toolkit`) satisfies the "Redux" entry: it is the Redux team's official
and recommended way to write Redux, and depends on `redux` itself. It is not a substitution and
needs no amendment.

Rationale: a fixed stack keeps onboarding, tooling, and review conventions uniform across the
codebase.

### VIII. Language Policy

Source code, variable/function/class names, code comments, commit messages, and technical logs
MUST be written in English. Documentation aimed at end users or business stakeholders — READMEs,
OpenAPI summaries and descriptions, and all frontend user-facing content — MUST be written in
Brazilian Portuguese (pt-BR). Mixed-language identifiers (Portuguese names inside English code)
MUST NOT be merged.

Rationale: English keeps the code accessible to the wider toolchain and ecosystem, while pt-BR
keeps the product legible to the people who actually use it.

## Additional Constraints

- The application MUST run via Docker, and `docker compose up` MUST bring up the API and a
  PostgreSQL instance for local development.
- All configuration MUST be read from environment variables; `.env` files MUST NOT be committed,
  and a `.env.example` listing every required key MUST be kept current.
- All schema changes MUST go through Prisma migrations checked into the repository. Manual SQL
  applied directly to a database MUST NOT be used as a substitute.
- Swagger MUST be served by the running API so the live contract is inspectable.
- Backend and frontend MUST each be independently buildable and testable.

## Development Workflow & Quality Gates

- Every change MUST pass, before merge: lint, type check, unit tests, and integration tests.
- Every change MUST be reviewed against this constitution. A reviewer MUST reject changes that
  place business rules in controllers or repositories, ship an undocumented or unvalidated
  endpoint, leave a mutating endpoint unauthenticated, or add a business rule without a test.
- New endpoints MUST land together with their DTOs, Swagger annotations, and integration tests
  in the same change — never as follow-up work.
- Complexity MUST be justified: when a simpler design was rejected, the reason MUST be stated in
  the pull request description.
- Commits MUST be written in English and describe intent, not mechanics.

## Governance

This constitution supersedes all other development practices in AgroHub. Where a style guide, a
tutorial, or an existing file in the repository conflicts with it, this document wins and the
conflicting artifact MUST be corrected.

Amendments MUST be proposed as a documented change to this file, MUST state the rationale, and
MUST describe the migration path for any code the amendment renders non-compliant. An amendment
takes effect only once merged.

Versioning follows semantic versioning:

- MAJOR — a principle is removed or redefined in a backward-incompatible way.
- MINOR — a principle or section is added, or existing guidance is materially expanded.
- PATCH — clarifications, wording, and typo fixes that do not change obligations.

Compliance is reviewed on every pull request. Any deviation MUST be documented in the pull
request with an explicit justification and either an expiry or a tracked remediation task;
undocumented deviations MUST be rejected. Runtime development guidance for agents and
contributors lives in the repository `CLAUDE.md`, which MUST NOT contradict this constitution.

**Version**: 1.2.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-10
