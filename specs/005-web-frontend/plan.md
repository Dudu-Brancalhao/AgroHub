# Implementation Plan: Web Frontend

**Branch**: `005-web-frontend` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-web-frontend/spec.md`

## Summary

Build the AgroHub web interface: a persistent shell — top bar fixed to the viewport with the product
name on its left edge, and a side menu with three destinations (Dashboard, Produtores, Safras), each
with an icon — inside which every screen of the existing backend is reachable. The frontend is a new,
independently buildable React + TypeScript application under `frontend/`, consuming the API that
features 001–004 already published, over its existing HTTP contract, with no backend change.

The technical approach, resolved in [research.md](./research.md):

- **Redux Toolkit** slices with `createAsyncThunk` hold every piece of server data once, exposing
  `idle | pending | succeeded | failed` explicitly (FR-043, FR-044), with `requestId` matching to
  discard responses that arrive after the user navigated away (FR-046).
- **`react-router-dom` v6** gives real path URLs (`/dashboard`, `/produtores/:id`, `/safras/:id`) with
  the shell as a nested layout route, so only the `<Outlet />` swaps (FR-005, FR-006).
- **Areas are integers of centi-hectares** end to end, never fractional floats, so the client's
  `arable + vegetation ≤ total` check agrees with the server's decimal comparison (FR-033).
- **Vite's dev proxy** puts the client and API on one origin, so no CORS change is needed on the
  backend (R-006).
- **Icons, charts and CPF/CNPJ validation are hand-written**, adding no dependencies — leaving routing
  as the only stack addition this feature requires.

## Technical Context

**Language/Version**: TypeScript 5.x, targeting ES2022; React 18

**Primary Dependencies**: React, Redux Toolkit + react-redux, Vite, styled-components,
react-router-dom (*new — see Complexity Tracking*). Dev/test: Jest, ts-jest, jest-environment-jsdom,
@testing-library/react, @testing-library/jest-dom, @testing-library/user-event, ESLint, Prettier

**Storage**: None client-side beyond `localStorage`, holding only the session token (R-007). All
domain data lives in the backend's PostgreSQL and is fetched per request.

**Testing**: Jest + React Testing Library, jsdom environment. The API client module is the single mock
seam; no network, no test server, no shared state between tests (Principle IV).

**Target Platform**: Modern evergreen browsers (Chrome, Edge, Firefox, Safari — current and previous
major). Responsive from 360px to desktop.

**Project Type**: Web application — a second top-level workspace beside the existing `backend/`.

**Performance Goals**: Shell interactive under 2s on a typical broadband first visit; each destination
paints content or placeholders within 1s of selection (SC-004); all transitions ≤ 200ms so motion is
never felt as waiting (FR-052).

**Constraints**: No backend change. Same-origin in production (R-006). All user-facing text in pt-BR,
all code in English (Principle VIII). Exact 2-decimal area arithmetic (R-004). Full keyboard operation
and a visible focus ring throughout (FR-056). All motion suppressed under `prefers-reduced-motion`
(FR-054).

**Scale/Scope**: 6 user stories, 56 functional requirements. About 10 routed screens (sign-in, sign-up,
dashboard, producer list, producer detail, producer form, farm form, planting form, safra list, safra
detail, not-found), 4 store slices, 23 API operations consumed, ~12 hand-drawn icons.

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1 design. Result: **PASS with one required
amendment** (see Complexity Tracking).*

Principles I–VI are written in backend vocabulary. Their frontend reading is recorded here so the gate
is checkable rather than nominally waved through.

| Principle | Frontend reading | Status | How the design satisfies it |
|---|---|---|---|
| **I. Code Quality** (SOLID, KISS, Clean Code) | One responsibility per component, hook, slice and module; no dead or speculative code | ✅ PASS | Presentational components take props and render; data access lives in thunks; formatting and validation live in pure `lib/` modules. No abstraction is introduced before its second use — notably, no generic "resource slice" factory over four concrete slices. |
| **II. Layered Architecture** | component → hook/container → slice/thunk → API client. Dependencies point inward only. | ✅ PASS | `lib/httpClient.ts` is the **only** module that calls `fetch`; feature `api.ts` modules are the only callers of the http client; thunks are the only callers of `api.ts`; components read state through selectors and dispatch actions. A component never calls `fetch`, and a slice never imports a component. Mirrors controller → service → repository exactly. |
| **III. Explicit API Contracts** | Typed request/response models at every boundary, and a README a newcomer can start from | ✅ PASS | [contracts/api-client.md](./contracts/api-client.md) pins all 23 operations; [contracts/store.md](./contracts/store.md) pins the state shape; [contracts/routes.md](./contracts/routes.md) pins the URLs. Every DTO is mirrored as a TypeScript type, type-checked at test time by `ts-jest` (R-005). `frontend/README.md` ships with the feature. |
| **IV. Test Coverage** (NON-NEGOTIABLE) | Unit-test every rule; test every screen's success, empty, loading, error and unauthorized states; no external real state | ✅ PASS | Pure rules (area math, CPF/CNPJ, formatters, reducers, selectors) get unit tests. Every screen gets RTL tests over a mocked API client covering the four states SC-013 requires. No network, no timers left running, no order dependence. |
| **V. Security by Default** | No secrets in the bundle; token handled narrowly; nothing sensitive logged or rendered | ✅ PASS | The token is the only credential stored, never logged and never placed in a URL (R-007); passwords are never retained after submit; no `dangerouslySetInnerHTML` anywhere; a `401` clears the session everywhere including other tabs (FR-015). Only `VITE_`-prefixed, non-secret config reaches the bundle. |
| **VI. Observability** | Errors surfaced with enough context to diagnose, without leaking sensitive data | ✅ PASS | The http client attaches the API's `requestId` from the error envelope to every failure it reports, so a user-visible pt-BR message can be correlated to the backend log line — while the raw envelope, stack and technical `error` field never reach the screen (FR-050, SC-006). |
| **VII. Mandated Technology Stack** | React, Redux, Vite, styled-components, Jest, RTL — no additions without amendment | ⚠️ **ONE DEVIATION** | Everything mandated is used as mandated (Redux Toolkit *is* Redux — R-003). Icons, charts, decimal handling and document validation are hand-written specifically to avoid additions. **`react-router-dom` is an addition** and requires an amendment before implementation — see Complexity Tracking. |
| **VIII. Language Policy** | Code, names, comments in English; all user-facing text in pt-BR | ✅ PASS | Identifiers and comments in English (`ProducerList`, `fetchProducers`). Every rendered string, including validation and empty-state text, in pt-BR. Route paths use the pt-BR nouns the user asked for (`/produtores`, `/safras`) since they are user-facing surface. |

**Additional Constraints check**: the frontend is independently buildable and testable
(`npm run build`, `npm test` inside `frontend/`) ✅; all configuration comes from environment variables
with a committed `.env.example` and no committed `.env` ✅; no schema or migration concerns apply ✅.

**Post-Phase-1 re-evaluation**: the design artifacts introduced no new dependency, no new layer and no
new deviation. The gate result is unchanged — PASS, with the single `react-router-dom` amendment
outstanding.

## Project Structure

### Documentation (this feature)

```text
specs/005-web-frontend/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — 10 decisions
├── data-model.md        # Phase 1 output — client-side model and store shape
├── quickstart.md        # Phase 1 output — how to run and validate
├── contracts/           # Phase 1 output
│   ├── api-client.md    #   the 21 backend operations consumed
│   ├── routes.md        #   the URL contract
│   └── store.md         #   the Redux state shape and actions
├── checklists/
│   └── requirements.md  # Spec quality checklist (passing)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/                       # unchanged by this feature
frontend/
├── index.html
├── vite.config.ts             # dev proxy /api -> http://localhost:3000 (R-006)
├── jest.config.ts             # ts-jest + jsdom; maps config/env to its stub (R-005)
├── tsconfig.json
├── .env.example
├── README.md                  # pt-BR: what it is, how to run, how to test
└── src/
    ├── main.tsx               # mounts <App/> with store, theme and router providers
    ├── App.tsx                # route table
    ├── app/
    │   ├── store.ts           # configureStore; RootState / AppDispatch types
    │   ├── hooks.ts           # typed useAppDispatch / useAppSelector
    │   └── routes.tsx         # route definitions + RequireAuth guard
    ├── layout/
    │   ├── AppShell.tsx       # fixed header + sidebar + <Outlet/>  (FR-001..FR-007)
    │   ├── Header.tsx         # product name, user e-mail, sign out, mobile menu toggle
    │   ├── Sidebar.tsx        # the three destinations with icons and active marking
    │   └── PageTransition.tsx # route-change animation (FR-052)
    ├── features/
    │   ├── auth/              # slice, api, thunks, SignIn, SignUp, RequireAuth
    │   ├── dashboard/         # slice, api, Dashboard screen, Breakdown bars (R-008)
    │   ├── producers/         # slice, api, list, detail, form
    │   ├── properties/        # api, farm form and cards (state lives in producers detail — R-009)
    │   └── harvests/          # slice, api, safra list and detail
    ├── components/            # shared UI: Button, TextField, Select, Modal, ConfirmDialog,
    │                          # Skeleton, Toast, EmptyState, ErrorState, Pagination, Bar
    ├── icons/                 # ~12 hand-written inline SVG components (R-002)
    ├── lib/
    │   ├── httpClient.ts      # the only fetch caller; auth header; error envelope mapping
    │   ├── area.ts            # integer centi-hectare parse / compare / sum / format (R-004)
    │   ├── documents.ts       # CPF and CNPJ check digits (R-010)
    │   ├── format.ts          # pt-BR number, date and document masks
    │   └── states.ts          # the 27 Brazilian UF codes (FR-034)
    ├── styles/
    │   ├── theme.ts           # colours, spacing, radii, typography, durations
    │   ├── GlobalStyle.ts     # reset, focus-visible ring, base type
    │   └── motion.ts          # keyframes + reduced-motion mixin (FR-054)
    └── config/
        └── env.ts             # the ONLY module reading import.meta.env (R-005)
```

Tests are co-located as `*.test.ts(x)` beside the unit under test, which is the React convention and
keeps a component and its test moving together. Jest collects `src/**/*.test.ts?(x)`.

**Structure Decision**: a **feature-sliced** layout (`features/<domain>/` each owning its slice, its
API module and its screens) rather than the template's type-sliced `components/ pages/ services/`.
Chosen because Principle II demands a visible dependency direction: with feature slicing, the layering
is enforced *within* a folder a reviewer reads top to bottom, and a feature's blast radius is one
directory. Genuinely shared, domain-free UI stays in `components/`, and genuinely shared rules stay in
`lib/`. `properties/` holds no slice of its own, following R-009: farms and plantings are always read
as part of the producer detail response and re-fetched through it.

## Complexity Tracking

> One Constitution Check deviation, requiring an amendment before implementation begins.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **`react-router-dom` v6** — a dependency outside the Principle VII stack | FR-006 (own address per destination, bookmarkable, reloadable, Back/Forward), FR-010 (redirect to sign-in, then return to the originally requested destination), FR-024 (search term and page in the address) and FR-005 (swap only the main area, keep the shell mounted) together require nested layout routes, route params, search params, a guard and programmatic navigation. | Hand-rolling a router over the History API means ~200 lines of path matching, param extraction, guard composition and history syncing that carry no business rule, and which Principle IV then obliges us to unit-test. Reinventing routing is a larger KISS and YAGNI violation than depending on the ecosystem-standard library. Hash routing was rejected because it contradicts the URL style the user asked for; a single state-driven page fails FR-006 outright. |

**Required action before `/speckit-implement`**: Principle VII states that a technology outside the
stack "MUST be justified in writing and MUST be recorded as a constitution amendment before
implementation begins." The justification is written (here and in [research.md](./research.md) R-001).
The amendment is **not yet recorded** — run `/speckit-constitution` to add `react-router-dom` to the
mandated frontend stack (a MINOR version bump, 1.0.0 → 1.1.0, since it materially expands existing
guidance). Implementation of the routing tasks should not begin until that lands.

Note what is deliberately *absent* from this table: icon, charting, decimal and validation libraries
were each considered and each hand-written instead (R-002, R-004, R-008, R-010), specifically so that
this feature carries one amendment rather than four.
