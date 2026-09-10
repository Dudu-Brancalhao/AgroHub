# Phase 0 Research: Web Frontend

**Feature**: 005-web-frontend | **Date**: 2026-09-10

This document resolves every NEEDS CLARIFICATION raised in the plan's Technical Context, plus the two
questions the specification's checklist flagged for planning. Each entry states the decision, why it
was taken, and what was rejected.

---

## R-001: Client-side routing

**Question raised by the user**: *"Routing assets you could create as standard, like
`http://localhost:3000/dashboard`."*

**Decision**: Use **`react-router-dom` v6** with `BrowserRouter`, giving real path URLs
(`/dashboard`, `/produtores`, `/produtores/:id`, `/safras`, `/safras/:id`) exactly as requested — no
hash fragments, no query-string routing.

**Rationale**:

- FR-006 requires each destination to be bookmarkable, reloadable and reachable directly, with Back
  and Forward working. FR-010 requires a redirect to sign-in that remembers the originally requested
  destination. FR-024 requires the producer search term and page number to live in the address.
  Together that is nested layout routes, route parameters, search parameters, a route guard and
  programmatic navigation — the full set, not a subset.
- `react-router-dom`'s nested-route model maps directly onto FR-005: the shell (top bar + side menu)
  is the parent route element and the destination renders into its `<Outlet />`, which is precisely
  the "replace only the main area, leave the shell mounted" requirement. Achieving that by hand means
  hand-rolling the same tree.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Hand-rolled router over the History API | Roughly 200 lines of infrastructure — path matching, parameter extraction, guard composition, scroll restoration, Back/Forward sync — carrying zero business rules, which would then need its own unit tests under Principle IV. Reinventing it is a worse KISS violation than depending on it. |
| Hash routing (`#/dashboard`) | Contradicts the URL style the user asked for. |
| One page, state-driven view switching | Fails FR-006 outright: no bookmarking, no reload, no Back button. |

**Constitution impact**: `react-router-dom` is **not** in the Principle VII stack. Per Principle VII
this must be justified in writing (done here) **and recorded as a constitution amendment before
implementation begins**. This is tracked as the single open gate in `plan.md` → Complexity Tracking.

---

## R-002: Icons

**Question raised by the user**: *"Icons we could use some default too, you pick one — on these
libraries Styled Components and Emotion, they do not provide?"*

**Direct answer**: Correct, they do not. `styled-components` and `@emotion/styled` are CSS-in-JS
styling libraries — they turn component definitions into scoped CSS. Neither ships any icon set, and
neither has any notion of an icon. (NestJS is a backend HTTP framework and ships none either.) An
icon set is always a separate concern from a styling library.

**Decision**: **Hand-author inline SVG icon components** inside the frontend, in
`frontend/src/icons/`. One small component per glyph, each a `<svg>` with `currentColor` as its
stroke or fill so it inherits colour from the styled parent.

**Rationale**:

- The whole application needs roughly a dozen glyphs: three for the menu destinations (a chart glyph
  for Dashboard, a people glyph for Produtores, a wheat/harvest glyph for Safras), plus menu, close,
  chevron, plus, pencil, trash, search, alert and check for the shared UI.
- Twelve inline SVGs cost about 120 lines total, ship no runtime, add nothing to the bundle beyond
  their own markup, and are trivially testable (`<svg role="img" aria-hidden>` with a title where the
  icon carries meaning).
- Most importantly, it adds **no dependency**, so it needs **no Principle VII amendment**. That keeps
  R-001 as the *only* stack addition this feature requires, which is a materially better position to
  defend at review than three.
- `currentColor` means the icon participates in the styled-components theme automatically, including
  the hover and focus states FR-053 requires.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| `lucide-react` | Excellent library, but a second Principle VII amendment for ~12 glyphs. Its tree-shaken output for 12 icons is not smaller than 12 hand-written SVGs. |
| `react-icons` | Same amendment cost, and it bundles whole icon families behind a single import surface, which is easy to use carelessly. |
| Emoji or icon font | Emoji render differently per platform and cannot be recoloured; an icon font is a network request and an accessibility liability. |

---

## R-003: State management shape

**Decision**: **Redux Toolkit** (`@reduxjs/toolkit` + `react-redux`), using `configureStore`,
`createSlice` and `createAsyncThunk`. **RTK Query is deliberately not used.**

**Rationale**:

- Redux Toolkit *is* Redux — it is the Redux team's official, recommended way to write Redux, and it
  has `redux` itself as a direct dependency. Choosing it satisfies Principle VII's "Redux" rather
  than departing from it. Writing raw `createStore` with hand-written action constants and immutable
  spread reducers would be more code, more error-prone, and is explicitly discouraged by the library's
  own maintainers.
- `createAsyncThunk` produces exactly the four states FR-044 requires — `idle`, `pending`,
  `fulfilled`, `rejected` — as real, inspectable values in the store, rather than something screens
  infer from whether data happens to be absent.
- Its `requestId` and `signal` are what satisfy FR-046: a slice records the `requestId` of the latest
  in-flight request and ignores any `fulfilled` action whose `requestId` no longer matches, so a slow
  response that lands after the user has navigated away is discarded instead of painted.

**Why not RTK Query**, despite it being the natural fit for cached server data: the user's request was
to *"use Redux to manage the react states"*. RTK Query hides the state behind generated hooks and its
own cache-lifetime rules, so the store shape stops being something a reviewer can read. Explicit
slices keep FR-043's "single shared store, every screen reads one value" visible and reviewable. The
cost is hand-written invalidation after mutations (FR-045), which R-009 shows is small here.

**Alternatives considered**: raw Redux (rejected above); React Context + `useReducer` (rejected — no
devtools, no middleware, and it contradicts a constitutional mandate); a server-cache library such as
TanStack Query (rejected — a Principle VII addition that would displace the mandated Redux).

---

## R-004: Exact hectare arithmetic

**Question raised by the user (Q2)**: *"Two decimals is OK on front."*

**Decision**: Represent every area internally as an **integer number of centi-hectares** (the decimal
string times 100). Parse `"1500.11"` → `150011`, compare and sum as integers, and format back to a
2-decimal pt-BR string (`"1.500,11"`) only at the moment of display. Never let an area value exist as
a fractional JavaScript number.

**Rationale**:

- The backend stores areas as `Decimal(12,2)` and returns them as **strings** (`PropertyResponseDto`
  maps them through `decimalToString`), precisely so that no float rounding happens in transit. The
  frontend must honour the same discipline or it reintroduces the bug at the last mile.
- The concrete failure is already documented in the backend's own schema comments: `1000 + 500.11`
  evaluates to `1500.1100000000001` in JavaScript, so a naive float check would reject a perfectly
  valid 1500.11 ha farm. FR-033's client-side check would then contradict the server.
- Fixing the scale at 2 decimals — the user's answer to Q2, and the same scale the database
  enforces — makes the integer representation exact, not approximate. The maximum representable area
  is `10^10 - 0.01` hectares, so the largest integer in play is under `10^12`, comfortably inside
  `Number.MAX_SAFE_INTEGER` (about `9.007 × 10^15`). No overflow is reachable.
- Summing the land-use breakdown for FR-019 and FR-020 uses the same integers, so the categories add
  up to the total exactly, as SC-007 requires.

**Request/response asymmetry to respect**: `CreatePropertyDto` declares its areas as JSON **numbers**
(`type: Number`, e.g. `1500.11`) while the response returns **strings**. So the client parses strings
on the way in, and emits a number literal on the way out — produced by dividing the integer by 100 at
serialisation time only, where `JSON.stringify` round-trips a 2-decimal value exactly.

**Alternatives considered**: `decimal.js` or `big.js` (rejected — a Principle VII addition to solve a
fixed-scale-2 problem that plain integers solve exactly); floats with an epsilon tolerance (rejected —
an epsilon is a guess, and it would silently accept or reject values at the boundary differently from
the server); keeping areas as strings and comparing lexically (rejected — wrong for differing digit
counts).

---

## R-005: Running Jest against a Vite + TypeScript React project

**Decision**: Jest with **`ts-jest`** and **`jest-environment-jsdom`**, plus
`@testing-library/react`, `@testing-library/jest-dom` and `@testing-library/user-event`. Vite builds
and serves; Jest tests. They do not share a transform.

**Rationale and the two traps**:

1. **Vite does not run tests.** It has no test runner, so Jest needs its own TypeScript transform.
   `ts-jest` type-checks during the test run, which catches contract drift between the API client's
   declared types and the components that consume them — valuable here, since those types are
   hand-mirrored from the backend DTOs.
2. **`import.meta.env` is a syntax error under Jest's CommonJS transform.** This is the failure that
   bites every Vite + Jest setup. Mitigation: every environment read is funnelled through one module,
   `src/config/env.ts`, which is the only file in the codebase mentioning `import.meta`. Jest maps
   that single path to a stub through `moduleNameMapper`. No other file needs to know.
3. **styled-components needs no CSS transform.** Because styling is CSS-in-JS, there are no `.css`
   imports to stub — the usual `identity-obj-proxy` mapping is unnecessary. Styles render as real
   class names under jsdom, so `toHaveStyleRule`-style assertions are available if ever needed,
   though tests should assert behaviour and accessible roles instead.

**Test doubles**: the API client module (R-006) is the single seam. Screen tests mock that module, not
`fetch` and not a network interceptor. This keeps Principle IV's "no dependency on external real
state" literally true — no server, no port, no MSW worker — and makes the four required states per
screen (success, empty, loading, error) trivial to drive.

**Alternatives considered**: Vitest (rejected — the constitution names Jest, and Vitest would be a
Principle VII substitution); Babel instead of `ts-jest` (rejected — faster, but drops the type
checking that guards the hand-mirrored DTO types); MSW (rejected — a dependency, and it tests the HTTP
layer twice when the client module is already the seam).

---

## R-006: Talking to the API — origins, CORS and the dev proxy

**Finding**: `backend/src/main.ts` never calls `app.enableCors()`. The API is same-origin only. A
frontend served from a Vite dev server on a different port would have every request blocked by the
browser.

**Decision**: Use **Vite's dev-server proxy**. The client always issues **relative** requests to
`/api/...`; in development, `vite.config.ts` proxies `/api` to `http://localhost:3000`. The browser
therefore only ever sees one origin, and CORS never enters the picture.

**Rationale**: it keeps the specification's assumption true — *no backend change is required by this
feature*. Enabling CORS would be a backend change, and a security-relevant one (Principle V), which
does not belong inside a frontend feature.

**Production consequence, recorded now so it is not discovered late**: the built static assets must be
served from the **same origin** as the API (a reverse proxy routing `/api` to the API container and
everything else to the static bundle). If a deployment ever needs a genuinely separate origin, that is
a backend change — an explicit CORS allowlist — and must be specified and reviewed as backend work,
not bolted on here.

**Base path**: the API's global prefix is `api` (`app.setGlobalPrefix('api')`), so every path in the
client contract is `/api/...`. Swagger lives at `/api/docs`.

**Dev port**: the API already owns port **3000**, so the frontend dev server uses Vite's default
**5173**. The user's `http://localhost:3000/dashboard` example is honoured in the part that matters —
the path shape — while the port differs because 3000 is taken. In production, behind the single-origin
proxy, `/(dashboard|produtores|safras)` and `/api/*` genuinely do share one origin and one port.

---

## R-007: Where the session token lives

**Decision**: Store the JWT in **`localStorage`** under one key, read once at start-up to rehydrate the
auth slice, and clear it on sign-out and on any `401`.

**Rationale**:

- FR-013 requires the session to survive a browser reload, and the backend issues a bearer token with
  an `expiresIn` and **no refresh endpoint**. An in-memory-only token would force a re-login on every
  refresh, failing FR-013.
- `sessionStorage` also survives reload but is per-tab, so opening a link in a new tab would demand a
  fresh sign-in — worse for the user with no security gain against the threat that matters (XSS reads
  either one).
- An `httpOnly` cookie is the genuinely stronger option, and it is rejected only because it requires
  the backend to set cookies instead of returning a bearer token — out of scope here. Worth recording
  as a future backend hardening item.

**Mitigations adopted**, since `localStorage` is XSS-readable:

- No `dangerouslySetInnerHTML` anywhere in the codebase, and no rendering of server strings as HTML.
- A `storage` event listener signs the app out in every other open tab when one tab signs out,
  covering the spec's "two tabs, one session" edge case.
- The token's expiry is checked on rehydrate, so an already-expired token never produces a doomed
  first request.
- The token is never logged, and never placed in a URL — only in the `Authorization` header (FR-014).

---

## R-008: Rendering the dashboard breakdowns

**Decision**: Build the three breakdowns as **hand-written proportional bars** with
styled-components — horizontal bars for farms-by-state and hectares-by-crop, and a single stacked bar
for hectares-by-land-use. No charting library.

**Rationale**: FR-019 asks for "a proportional visual representation" with labels and values, not for
interactive analytics. The server already returns each breakdown pre-aggregated as
`{ unit, categories: [{ key, label, value }] }` — the hard work is done. A bar whose width is a
percentage of the largest category is a handful of lines, is accessible by default (the label and
value are real text, so screen readers and SC-007's data check both read the same numbers), animates
its width with the same CSS transitions used everywhere else (FR-052), and honours
`prefers-reduced-motion` through the shared mixin (FR-054).

**Alternatives considered**: `recharts` / `chart.js` / `nivo` (rejected — a third Principle VII
amendment, roughly 100 kB of runtime, and canvas- or SVG-rendered text that needs separate
accessibility work, all to draw three proportional bars).

---

## R-009: Fetch granularity and cache invalidation

**Finding**: `GET /api/producers/:id` returns `ProducerDetailDto` — the producer **plus** its
properties, each already carrying its crops grouped by harvest (`PropertyDetailDto.harvests`).

**Decision**: The producer detail screen — which covers all of User Story 4 — loads from **one
request**. After creating, editing or deleting a farm or a planting, the frontend re-fetches that
single producer rather than patching nested state by hand.

**Rationale**: this is what makes FR-045 cheap without RTK Query. The alternative — surgically
updating a producer → properties → harvests → crops tree inside a reducer after every mutation — is
where hand-written Redux normally goes wrong, and it is exactly the class of bug that would show up as
a stale screen. One re-fetch of one endpoint is a single line, is always correct, and costs one round
trip on an action the user just initiated. The Dashboard is likewise marked stale after any mutation
and re-fetched when next shown.

**Consequence**: no entity normalisation is needed. The store holds a producers list page, a single
producer detail, a harvests list, and a dashboard summary — four independent server-data shapes, each
with its own request state.

---

## R-010: Client-side CPF and CNPJ validation

**Decision**: Implement the CPF and CNPJ check-digit algorithms as a pure module in
`frontend/src/lib/documents.ts`, unit-tested against valid and invalid samples including the
repeated-digit cases (`111.111.111-11`) that pass a naive checksum.

**Rationale**: FR-027 requires the invalid-document message before submission. The algorithm is fixed,
public and about 40 lines. Its only job is immediate feedback; the server remains the authority, and
its rejection is still surfaced against the field (FR-030).

**Alternative**: a validation package (rejected — another Principle VII addition for two well-known
algorithms).

---

## Summary of stack decisions

| Concern | Choice | New dependency? | Principle VII amendment needed? |
|---|---|---|---|
| UI | React + TypeScript | Mandated | No |
| Build/dev server | Vite | Mandated | No |
| Styling | styled-components | Mandated | No |
| State | Redux Toolkit + react-redux | Mandated (RTK *is* Redux) | No |
| Tests | Jest + React Testing Library (+ `ts-jest`, `jest-environment-jsdom`, `jest-dom`, `user-event`) | Mandated, with standard companions | No |
| **Routing** | **`react-router-dom` v6** | **Yes** | **Yes — the single open gate** |
| Icons | Hand-written inline SVG | No | No |
| Charts | Hand-written CSS bars | No | No |
| Decimals | Integer centi-hectares | No | No |
| Document validation | Hand-written CPF/CNPJ | No | No |
