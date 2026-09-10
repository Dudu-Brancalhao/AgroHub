---

description: "Task list for feature implementation"
---

# Tasks: Web Frontend

**Input**: Design documents from `/specs/005-web-frontend/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Test tasks are **included and mandatory**. Constitution Principle IV is NON-NEGOTIABLE
("Every business rule MUST have a unit test... A change to a business rule without a corresponding
test change MUST NOT be merged"), and SC-013 requires every screen's success, empty, loading and error
states to be covered. Within each story, tests are written **before** the implementation they cover.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested and
demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: Which user story the task belongs to (US1–US6)
- Every task names its exact file path

## Path Conventions

All paths are relative to the repository root. The backend is **not modified by any task in this
feature**. New code lives under `frontend/`, per the structure in [plan.md](./plan.md).

---

## ⚠️ Blocking gate before Phase 1

- [X] T001 Record the `react-router-dom` constitution amendment in `.specify/memory/constitution.md` by running `/speckit-constitution` — add it to the Principle VII frontend stack, bump 1.0.0 → 1.1.0 (MINOR), citing the justification in `specs/005-web-frontend/research.md` (R-001) and `plan.md` → Complexity Tracking. Principle VII requires this to be **recorded before implementation begins**; T050 and every routing task depend on it.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the frontend workspace and its tooling.

- [X] T002 Scaffold the Vite React + TypeScript project at `frontend/`, producing `frontend/index.html`, `frontend/src/main.tsx` and `frontend/package.json` (name `agrohub-frontend`, private, type module)
- [X] T003 Install dependencies and define scripts in `frontend/package.json` — runtime: `react`, `react-dom`, `@reduxjs/toolkit`, `react-redux`, `styled-components`, `react-router-dom`; dev: `typescript`, `vite`, `@vitejs/plugin-react`, `jest`, `ts-jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/*`, `eslint`, `prettier`; scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `lint`, `typecheck`
- [X] T004 [P] Configure `frontend/vite.config.ts` — React plugin, `server.port: 5173`, and `server.proxy` mapping `/api` to `http://localhost:3000` with `changeOrigin: true` (research.md R-006; the API owns port 3000, so the client must not)
- [X] T005 [P] Configure `frontend/tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess`, `jsx: react-jsx`, target ES2022, and a `@/*` path alias to `src/*`
- [X] T006 [P] Configure `frontend/jest.config.ts` — `ts-jest` preset, `testEnvironment: jsdom`, `setupFilesAfterEnv` loading `@testing-library/jest-dom`, `testMatch` on `src/**/*.test.ts?(x)`, and a `moduleNameMapper` entry pointing `src/config/env` at `src/config/env.stub.ts` (research.md R-005 — this is what keeps `import.meta.env` from breaking the Jest transform)
- [X] T007 [P] Configure ESLint and Prettier in `frontend/.eslintrc.cjs` and `frontend/.prettierrc` — TypeScript, React hooks and jsx-a11y rules, and a rule banning `dangerouslySetInnerHTML` (Principle V, research.md R-007)
- [X] T008 [P] Create `frontend/src/config/env.ts` as the **only** module reading `import.meta.env`, its Jest counterpart `frontend/src/config/env.stub.ts`, and `frontend/.env.example` listing every `VITE_`-prefixed key with no secret values
- [X] T009 [P] Add `frontend/node_modules`, `frontend/dist` and `frontend/.env` to `.gitignore` at the repository root
- [X] T010 [P] Write `frontend/README.md` in pt-BR — what the application is, how to run it against the API, how to test it, and the port/proxy arrangement (Principle III, Principle VIII)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The theme, the pure rule modules, the HTTP layer, the store and the shared UI kit. Every
user story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Styling foundation

- [X] T011 [P] Create `frontend/src/styles/theme.ts` — colour tokens (surface, text, primary, danger, success, border), spacing scale, radii, typography scale and motion durations (all ≤ 200ms per FR-052)
- [X] T012 [P] Create `frontend/src/styles/motion.ts` — `fadeIn`, `slideIn` and `shimmer` keyframes plus a `respectMotionPreference` mixin that wraps any animation in `@media (prefers-reduced-motion: no-preference)` (FR-054)
- [X] T013 Create `frontend/src/styles/GlobalStyle.ts` — reset, base typography, and a `:focus-visible` ring token used application-wide (FR-053, FR-056); depends on T011

### Pure rule modules (tests first)

- [X] T014 [P] Write `frontend/src/lib/area.test.ts` — `parseArea("1500.11") === 150011`; `formatArea(150011) === "1.500,11"`; `sumAreas` exactness; and the regression case `1000 + 500.11 <= 1500.11` returning **true** (research.md R-004 — this fails in floats)
- [X] T015 [P] Write `frontend/src/lib/documents.test.ts` — valid CPF `52998224725` and valid CNPJ pass; wrong check digits fail; repeated digits `11111111111` **fail** (research.md R-010); punctuation is stripped before checking
- [X] T016 [P] Write `frontend/src/lib/format.test.ts` — pt-BR number formatting, ISO date to `dd/MM/yyyy`, CPF mask `529.982.247-25` and CNPJ mask `11.222.333/0001-81` from digits-only input
- [X] T017 Create `frontend/src/lib/area.ts` — the `Centiares` integer type with `parseArea`, `toApiNumber`, `formatArea`, `sumAreas` and `isWithinTotal`; every comparison in integers, never floats (data-model.md → Property)
- [X] T018 Create `frontend/src/lib/documents.ts` — CPF and CNPJ check-digit algorithms plus `detectDocumentType`, returning `'CPF' | 'CNPJ' | null`
- [X] T019 Create `frontend/src/lib/format.ts` — pt-BR number, date and document mask helpers
- [X] T020 [P] Create `frontend/src/lib/states.ts` — the 27 Brazilian UF codes as a readonly tuple with a `isValidState` guard (FR-034)
- [X] T021 [P] Create `frontend/src/icons/index.tsx` — ~12 hand-written inline SVG components (`DashboardIcon`, `ProducersIcon`, `HarvestIcon`, `MenuIcon`, `CloseIcon`, `ChevronIcon`, `PlusIcon`, `PencilIcon`, `TrashIcon`, `SearchIcon`, `AlertIcon`, `CheckIcon`), each using `currentColor` and `aria-hidden` by default (research.md R-002 — no icon library)

### HTTP layer

- [X] T022 Write `frontend/src/lib/httpClient.test.ts` — the `/api` prefix is applied; the bearer header is attached except on register and login; an error envelope becomes a typed `ApiError` carrying only `statusCode`, `message`, `details` and `requestId`; a network failure yields a pt-BR fallback with `statusCode: 0`; a `401` dispatches `sessionCleared`
- [X] T023 Create `frontend/src/lib/httpClient.ts` — the **only** module in the codebase that calls `fetch` (Principle II). Four responsibilities and no more, per contracts/api-client.md: prefix and serialise, authorise, normalise failures, signal a dead session. It never retries, caches or transforms domain data

### Store foundation

- [X] T024 Create `frontend/src/app/store.ts` — `configureStore` with default middleware kept (serializability and immutability checks), plus a `rootReducer` wrapping `combineReducers` so the `sessionCleared` action returns `undefined` state to every slice (FR-047, contracts/store.md)
- [X] T025 [P] Create `frontend/src/app/hooks.ts` — typed `useAppDispatch` and `useAppSelector`, and export the `RootState` / `AppDispatch` types
- [X] T026 Create `frontend/src/features/ui/uiSlice.ts` — `toasts`, `sidebarOpen` and `confirm` state with their actions (contracts/store.md → `ui`)
- [X] T027 Write `frontend/src/features/ui/uiSlice.test.ts` — toasts are added and dismissed by id; `sidebarOpen` resets to `false` on the navigation action (FR-007)

### Shared UI kit

- [X] T028 [P] Create `frontend/src/components/Button.tsx` with `frontend/src/components/Button.test.tsx` — variants (primary, secondary, danger), a `busy` prop that shows a spinner and sets `aria-busy`, and **ignores repeated activation while busy** (FR-049)
- [X] T029 [P] Create `frontend/src/components/TextField.tsx` and `frontend/src/components/Select.tsx` with tests — label, `aria-describedby` error wiring, `aria-invalid`, and a visible focus ring (FR-053, FR-056)
- [X] T030 [P] Create `frontend/src/components/Skeleton.tsx`, `EmptyState.tsx` and `ErrorState.tsx` with tests — the skeleton shimmers only when motion is allowed (FR-048, FR-054); `ErrorState` takes a pt-BR message and a retry callback (FR-050)
- [X] T031 [P] Create `frontend/src/components/Toast.tsx` and `ToastRegion.tsx` with tests — self-dismissing, non-blocking, announced via `role="status"` (FR-051)
- [X] T032 Create `frontend/src/components/Modal.tsx` and `ConfirmDialog.tsx` with tests — focus is trapped while open, `Esc` closes, and focus returns to the trigger on close (FR-056); `ConfirmDialog` takes distinct title, body and confirm-label props so a cascading delete and a blocked delete can read differently (data-model.md → relationships)

**Checkpoint**: The theme, rules, HTTP layer, store and UI kit exist and are tested. User story work can begin.

---

## Phase 3: User Story 1 - Sign in and move around the application (Priority: P1) 🎯 MVP

**Goal**: A visitor signs in, lands in a persistent shell with a fixed header and a three-destination
sidebar, moves between destinations without the shell reloading, survives a browser reload, and signs
out.

**Independent Test**: Sign in with valid credentials, select each of the three menu entries, confirm
the main area changes and the address changes with it, reload on each one, then sign out and confirm
the destinations are no longer reachable.

### Tests for User Story 1

- [X] T033 [P] [US1] Write `frontend/src/features/auth/authSlice.test.ts` — `bootstrap` starts `pending`, not `idle`; `signIn` transitions pending → succeeded/failed; `sessionCleared` empties the session; a `fulfilled` action carrying a **stale `requestId` is ignored** (FR-046)
- [X] T034 [P] [US1] Write `frontend/src/features/auth/SignIn.test.tsx` — valid submit signs in; a `401` renders `E-mail ou senha inválidos.`, clears the password field and stays on the screen; the message never reveals whether the e-mail exists (FR-011)
- [X] T035 [P] [US1] Write `frontend/src/features/auth/SignUp.test.tsx` — password rules (≥ 8 chars, at least one letter and one digit) are enforced before submitting; success chains register → login without retyping (FR-012); a `429` renders the rate-limit explanation, not a generic error
- [X] T036 [P] [US1] Write `frontend/src/features/auth/RequireAuth.test.tsx` — no session redirects to `/entrar` remembering the target and returns to it after sign-in (FR-010); during bootstrap it renders a skeleton rather than flashing the sign-in screen; a signed-in user on `/entrar` is redirected to `/dashboard`
- [X] T037 [P] [US1] Write `frontend/src/layout/AppShell.test.tsx` — the header and sidebar stay mounted across a route change (FR-005); the current destination is marked (FR-004); `/produtores/:id` keeps **Produtores** marked; below the tablet breakpoint the sidebar collapses behind the header toggle (FR-007)

### Implementation for User Story 1

- [X] T038 [P] [US1] Create `frontend/src/features/auth/types.ts` — `Session`, `AuthUser`, and the request/response types for operations 1–3, mirrored from the backend DTOs (data-model.md → Session)
- [X] T039 [US1] Create `frontend/src/features/auth/api.ts` — `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (contracts/api-client.md ops 1–3); register and login are the only unauthenticated calls
- [X] T040 [US1] Create `frontend/src/features/auth/sessionStorage.ts` — read, write and clear the single `localStorage` key; store `expiresAt` (now + `expiresIn` seconds) rather than `expiresIn`, and discard an already-expired token on read (research.md R-007)
- [X] T041 [US1] Create `frontend/src/features/auth/authSlice.ts` — `bootstrapSession`, `signIn`, `signUp` (chaining register → login, discarding the credentials afterwards) and the `sessionCleared` action, each with the `RequestState` shape from contracts/store.md
- [X] T042 [US1] Wire the `sessionCleared` reset into `frontend/src/app/store.ts` so every slice returns to its initial state, and register the `auth` and `ui` reducers (FR-047)
- [X] T043 [US1] Complete `frontend/src/lib/httpClient.ts` — read the token from the store for the `Authorization: Bearer` header (FR-014), and dispatch `sessionCleared` on any `401` so the redirect happens once, centrally (FR-015)
- [X] T044 [P] [US1] Create `frontend/src/features/auth/SignIn.tsx` — e-mail and password fields, pt-BR labels and errors, busy submit button; applies **only** the required-field rule to the password, never the sign-up strength rules (data-model.md → Session)
- [X] T045 [P] [US1] Create `frontend/src/features/auth/SignUp.tsx` — e-mail (valid format, ≤ 254 chars) and password (≥ 8 chars, at least one letter and one digit) mirroring the server exactly, with a link back to sign-in
- [X] T046 [US1] Create `frontend/src/features/auth/RequireAuth.tsx` — the single guard for every protected route; redirects with `replace` and `state.from`, and renders the shell skeleton while `bootstrap` is pending (contracts/routes.md)
- [X] T047 [P] [US1] Create `frontend/src/layout/Header.tsx` — fixed to the viewport, product name **AgroHub** on the left edge linking to `/dashboard` (FR-002), the signed-in e-mail (FR-017), a sign-out action (FR-016) and the mobile menu toggle
- [X] T048 [P] [US1] Create `frontend/src/layout/Sidebar.tsx` — exactly three `NavLink` destinations with icons and pt-BR labels: **Dashboard** → `/dashboard`, **Produtores** → `/produtores`, **Safras** → `/safras`; active marking is by section, not exact URL (FR-003, FR-004)
- [X] T049 [US1] Create `frontend/src/layout/AppShell.tsx` — the parent layout route holding the fixed header and the sidebar, rendering destinations into `<Outlet />` so only the main area swaps (FR-001, FR-005); the main area scrolls while the header stays fixed
- [X] T050 [US1] Create `frontend/src/app/routes.tsx` and `frontend/src/App.tsx` — the route table from contracts/routes.md, with `/` redirecting to `/dashboard` and every protected route nested under `RequireAuth` → `AppShell` (**depends on T001**)
- [X] T051 [US1] Create `frontend/src/components/NotFound.tsx` — rendered inside the shell for any unmatched address, with a way back to the Dashboard (FR-008)
- [X] T052 [US1] Complete `frontend/src/main.tsx` — mount `App` inside the Redux `Provider`, the styled-components `ThemeProvider` and `BrowserRouter`; dispatch `bootstrapSession` on start-up; register the `storage` event listener that signs out every other open tab (spec.md edge case "two tabs, one session")

**Checkpoint**: The application is signed-in, navigable and reloadable. This is the MVP — it is demonstrable and deployable with placeholder destination content.

---

## Phase 4: User Story 2 - Read the registry at a glance on the Dashboard (Priority: P2)

**Goal**: The Dashboard shows total farms and total hectares plus three proportional breakdowns, with
skeletons while loading, an empty state for an empty registry and a retry on failure.

**Independent Test**: Seed producers, farms and plantings, open the Dashboard and confirm every total
and breakdown matches the seeded data; then empty the registry and confirm the empty state appears.

### Tests for User Story 2

- [X] T053 [P] [US2] Write `frontend/src/features/dashboard/dashboardSlice.test.ts` — the four request transitions, and that `stale` is set by a mutation elsewhere and cleared by a successful re-fetch (FR-045)
- [X] T054 [P] [US2] Write `frontend/src/features/dashboard/Dashboard.test.tsx` — the four states SC-013 requires: loading renders skeletons (FR-048), success renders totals and all three breakdowns, an empty registry renders the empty state rather than zero-height bars (FR-021), and a failure renders a pt-BR message with a working retry (FR-050)
- [X] T055 [P] [US2] Write `frontend/src/features/dashboard/selectors.test.ts` — the `byLandUse` categories sum **exactly** to `totals.hectares` in integer centi-hectares (SC-007), and bar proportions are computed against the largest category

### Implementation for User Story 2

- [X] T056 [US2] Create `frontend/src/features/dashboard/types.ts` and `api.ts` — `GET /api/dashboard` (op 4), parsing every hectare string to `Centiares` at the boundary; `value` is `string` for `unit: 'hectares'` and `number` for `unit: 'count'`, branched on `unit` and never guessed from the runtime type (data-model.md → Registry summary)
- [X] T057 [US2] Create `frontend/src/features/dashboard/dashboardSlice.ts` — `fetchSummary` plus the `stale` flag; re-fetch on mount when `stale` is true or `status` is `idle`, and **not** on every visit (contracts/store.md)
- [X] T058 [US2] Create `frontend/src/features/dashboard/selectors.ts` — `selectSummaryTotals` and a memoised `selectBreakdown(kind)` computing each category's proportion from integers
- [X] T059 [P] [US2] Create `frontend/src/components/Bar.tsx` with `Bar.test.tsx` — a proportional horizontal bar whose label and value are **real text** (so screen readers and SC-007's data check read the same numbers), with a width transition honouring `prefers-reduced-motion` (research.md R-008 — no charting library)
- [X] T060 [US2] Create `frontend/src/features/dashboard/Dashboard.tsx` — the totals row plus farms-by-state, hectares-by-crop and hectares-by-land-use; the land-use breakdown renders `unclassified` only when the server sent it (FR-018, FR-019, FR-020)
- [X] T061 [US2] Create `frontend/src/features/dashboard/DashboardSkeleton.tsx` — placeholder shapes occupying the **final position** of every figure so nothing shifts when data arrives (FR-048, SC-005)

**Checkpoint**: Sign in, land on a populated Dashboard, and see the registry at a glance.

---

## Phase 5: User Story 3 - Keep the producer registry up to date (Priority: P3)

**Goal**: A paginated, searchable producer list; create, edit and delete with client-side CPF/CNPJ
validation and server conflicts bound to their fields.

**Independent Test**: Create a producer, find it through search, edit its name, then delete it,
confirming the list reflects each change without a page reload.

### Tests for User Story 3

- [X] T062 [P] [US3] Write `frontend/src/features/producers/producersSlice.test.ts` — `list` and `detail` hold independent request states so opening a producer does not blank the list; a `fulfilled` with a stale `requestId` is ignored (FR-046); every mutation sets `dashboard.stale` and triggers `fetchProducer` (FR-045)
- [X] T063 [P] [US3] Write `frontend/src/features/producers/ProducerList.test.tsx` — the four states; typing fires **one** debounced request rather than one per keystroke (FR-023); a no-match search names the term and offers to clear it; `busca` and `pagina` round-trip through the URL (FR-024)
- [X] T064 [P] [US3] Write `frontend/src/features/producers/ProducerForm.test.tsx` — `111.111.111-11` is refused client-side before any request; a valid CPF submits; a server `409` renders **on the document field**, not as a banner (FR-030); the name is required and capped at 200 chars
- [X] T065 [P] [US3] Write `frontend/src/features/producers/deleteProducer.test.tsx` — the confirmation states that farms and plantings go too (FR-029); cancelling deletes nothing; the success toast names the counts from the deletion report

### Implementation for User Story 3

- [X] T066 [US3] Create `frontend/src/features/producers/types.ts` — `Producer`, `ProducerDetail` (with `properties`, each carrying `harvests`), and the paged-result type `{ data, total, page, pageSize }` (data-model.md → Producer)
- [X] T067 [US3] Create `frontend/src/features/producers/api.ts` — operations 5–9 from contracts/api-client.md; `search` is trimmed and the parameter **omitted when empty**, never sent as `?busca=`
- [X] T068 [US3] Create `frontend/src/features/producers/producersSlice.ts` — the `list`, `detail` and shared `mutation` state from contracts/store.md; `detail.id` guards the render so a previously opened producer is never shown under a new `:id`
- [X] T069 [US3] Create `frontend/src/features/producers/selectors.ts` — `selectProducerList`, `selectProducerDetail` and a memoised `selectPageCount` derived from `total` and `pageSize`
- [X] T070 [P] [US3] Create `frontend/src/components/Pagination.tsx` with tests — page controls with `aria-current`, disabled at the boundaries, fully keyboard-operable (FR-022, FR-056)
- [X] T071 [P] [US3] Create `frontend/src/components/SearchField.tsx` with tests — ~300ms debounce, a clear button, and `role="searchbox"` labelling in pt-BR
- [X] T072 [US3] Create `frontend/src/features/producers/useProducerListParams.ts` — reads `busca` and `pagina` from `useSearchParams` as the **source of truth**; a search change uses `replace` (so Back does not step through keystrokes) while a page change **pushes**; changing the search resets `pagina` to 1; a non-numeric or out-of-range page falls back to 1 (contracts/routes.md)
- [X] T073 [US3] Create `frontend/src/features/producers/ProducerList.tsx` — name and masked document per row, the search field, pagination, and a link to each producer's detail
- [X] T074 [US3] Create `frontend/src/features/producers/ProducerListSkeleton.tsx` and the list's empty and error states — the empty state distinguishes "no producers yet" from "no match for «term»" (FR-050, SC-005)
- [X] T075 [US3] Create `frontend/src/features/producers/ProducerForm.tsx` — create and edit in one component; name required and ≤ 200 chars; document stripped of punctuation and validated with `lib/documents.ts` before submitting; server `details[]` mapped to fields by name (FR-026, FR-027, FR-028)
- [X] T076 [US3] Create `frontend/src/features/producers/ProducerDetail.tsx` — the producer header (name, masked document, type) loaded by a **single** `fetchProducer` call, with a not-found screen for an unknown id (contracts/api-client.md op 6, research.md R-009)
- [X] T077 [US3] Implement the producer delete flow in `frontend/src/features/producers/ProducerDetail.tsx` — a `ConfirmDialog` warning about the cascade, then a success toast naming what the deletion report says was removed (FR-029, FR-051)
- [X] T078 [US3] Add the `/produtores`, `/produtores/novo`, `/produtores/:id` and `/produtores/:id/editar` routes to `frontend/src/app/routes.tsx`
- [X] T079 [US3] Implement the shared post-mutation routine in `frontend/src/features/producers/producersSlice.ts` — on success, re-fetch the owning query, set `dashboard.stale = true` and push a success toast; the same three steps for every mutating thunk (FR-045)

**Checkpoint**: Producers can be listed, searched, created, edited and deleted, and the Dashboard reflects every change.

---

## Phase 6: User Story 4 - Manage a producer's farms and plantings (Priority: P4)

**Goal**: From a producer's detail screen, add, edit and remove farms with exact area validation, and
record and remove plantings per season.

**Independent Test**: On an existing producer, add a farm, add two plantings in one season, attempt a
duplicate, remove one planting, then remove the farm — confirming each result on screen.

### Tests for User Story 4

- [X] T080 [P] [US4] Write `frontend/src/features/properties/PropertyForm.test.tsx` — total `100` / arable `60` / vegetation `50` is refused client-side with the sum rule explained and **nothing sent**; total `1500.11` / arable `1000` / vegetation `500.11` is **accepted** (the float trap from research.md R-004); a non-UF state is refused (FR-033, FR-034)
- [X] T081 [P] [US4] Write `frontend/src/features/properties/FarmCard.test.tsx` — farm name, city, state and all three areas render; plantings appear grouped by season; a farm with no plantings shows its empty state
- [X] T082 [P] [US4] Write `frontend/src/features/properties/CropForm.test.tsx` — the season is chosen from the loaded list rather than typed; a duplicate `409` renders as a readable message on the form with no duplicate row appearing (FR-037)

### Implementation for User Story 4

- [X] T083 [US4] Create `frontend/src/features/properties/types.ts` and `api.ts` — operations 10–14; areas are parsed from strings to `Centiares` on the way in and emitted as JSON **numbers** on the way out, divided by 100 only at serialisation (contracts/api-client.md, research.md R-004)
- [X] T084 [US4] Create `frontend/src/features/properties/cropsApi.ts` — operations 15, 16 and 18 (create, list by farm, delete)
- [X] T085 [US4] Add the farm and planting thunks to `frontend/src/features/producers/producersSlice.ts` — they live here because their result invalidates the producer detail this slice owns; cross-slice invalidation would point a dependency the wrong way (Principle II, contracts/store.md)
- [X] T086 [P] [US4] Create `frontend/src/components/AreaField.tsx` with tests — accepts at most 2 decimals, holds the value as `Centiares`, and displays it pt-BR formatted (data-model.md → Property; the user's Q2 answer fixes the scale at 2)
- [X] T087 [US4] Create `frontend/src/features/properties/PropertyForm.tsx` — farm name (required, ≤ 200), city (required, ≤ 120), state (one of the 27 UF codes, sent uppercase), and the three areas; the composite rule `arable + vegetation ≤ total` evaluated **in integers** with the pt-BR message `A soma da área agricultável e da vegetação não pode ultrapassar a área total.`
- [X] T088 [US4] Create `frontend/src/features/properties/FarmCard.tsx` — one farm with its areas, an `unclassified` remainder shown only when positive, and edit/delete actions
- [X] T089 [US4] Create `frontend/src/features/properties/PlantingList.tsx` — a farm's crops grouped by season from the `harvests` array already nested in the producer detail response (FR-035, research.md R-009)
- [X] T090 [US4] Create `frontend/src/features/properties/CropForm.tsx` — a season **selector** populated from the harvests slice plus a crop name (required, ≤ 120); may grey out crops already present in that season as a courtesy, but never treats its own check as authoritative (data-model.md → Crop)
- [X] T091 [US4] Add the farm and planting delete confirmations to `frontend/src/features/properties/FarmCard.tsx` and `PlantingList.tsx` — each states what it removes, and neither implies the cascade wording used for producers (FR-032, FR-036)
- [X] T092 [US4] Dispatch `fetchHarvests` when `ProducerDetail` mounts in `frontend/src/features/producers/ProducerDetail.tsx`, so the planting form's season selector is populated without a second copy of the list living in this slice (FR-043)

**Checkpoint**: A producer's full registry — farms and plantings — is manageable, and the Dashboard totals follow.

---

## Phase 7: User Story 5 - Maintain the shared list of safras (Priority: P5)

**Goal**: List, create, edit and delete seasons, and open a season to see what was planted in it across
all farms.

**Independent Test**: Create a season, open it to view its plantings, attempt to delete one that is in
use, then delete an unused one.

### Tests for User Story 5

- [X] T093 [P] [US5] Write `frontend/src/features/harvests/harvestsSlice.test.ts` — the four request transitions for the list and the detail, and that a mutation sets `dashboard.stale`
- [X] T094 [P] [US5] Write `frontend/src/features/harvests/SafraList.test.tsx` — the four states; a duplicate year `409` renders on the year field; `1899` is refused client-side before any request; a delete refused with `409` renders the **in-use explanation** and the season stays in the list (FR-041)
- [X] T095 [P] [US5] Write `frontend/src/features/harvests/SafraDetail.test.tsx` — plantings render with the farm each belongs to; a season with no plantings shows its empty state

### Implementation for User Story 5

- [X] T096 [US5] Create `frontend/src/features/harvests/types.ts` and `api.ts` — operations 19–23 plus operation 17 (crops by season, each item carrying `propertyId`)
- [X] T097 [US5] Create `frontend/src/features/harvests/harvestsSlice.ts` — `items`, `detail` and `mutation` per contracts/store.md; `items` is fetched once and shared with the producer detail screen, never duplicated
- [X] T098 [US5] Create `frontend/src/features/harvests/SafraList.tsx` — seasons listed by year in a stable order, with an inline create form and edit/delete actions (FR-038, FR-040)
- [X] T099 [US5] Implement year validation in `frontend/src/features/harvests/SafraList.tsx` — an integer between 1900 and **the current year + 1**, with the upper bound computed at render time to match the server's `isPlausibleHarvestYear`, never hard-coded (data-model.md → Harvest)
- [X] T100 [US5] Implement the season delete flow in `frontend/src/features/harvests/SafraList.tsx` — on `409`, present the server's explanation and the count of blocking plantings as a **designed refusal**, not a failure, leaving the season in place (FR-041)
- [X] T101 [US5] Create `frontend/src/features/harvests/SafraDetail.tsx` — the plantings recorded in the season, resolving each farm's name from the producers already held and falling back to the identifier only when a name is genuinely unavailable (FR-042, contracts/api-client.md op 17)
- [X] T102 [US5] Add the `/safras` and `/safras/:id` routes to `frontend/src/app/routes.tsx`

**Checkpoint**: All three menu destinations are fully functional. Every functional requirement except the motion polish is met.

---

## Phase 8: User Story 6 - Feel the application respond smoothly (Priority: P6)

**Goal**: Loading never looks like nothing happening, navigation never jolts, and every effect is
suppressed under reduced motion.

**Independent Test**: Throttle the network, move between all three destinations and submit one form on
each, confirming placeholders, busy buttons and transitions; then enable reduced motion and confirm the
movement stops while the content still updates.

### Tests for User Story 6

- [X] T103 [P] [US6] Write `frontend/src/styles/motion.test.ts` — every animated style is wrapped so that under `prefers-reduced-motion: reduce` no animation is emitted, while the same content still renders (FR-054, SC-010)
- [X] T104 [P] [US6] Write `frontend/src/layout/PageTransition.test.tsx` — content animates in on a **path** change but not on a search-parameter change (animating a keystroke's result would read as flicker), and the header and sidebar do not remount (FR-052)
- [X] T105 [P] [US6] Write `frontend/src/layout/focusManagement.test.tsx` — on navigation, focus moves to the main region's heading rather than staying on the sidebar link (FR-056, SC-009)

### Implementation for User Story 6

- [X] T106 [US6] Create `frontend/src/layout/PageTransition.tsx` — wraps the `<Outlet />` and fades/settles incoming content on path change only, with every duration ≤ 200ms (FR-052)
- [X] T107 [US6] Add scroll and focus handling to `frontend/src/layout/AppShell.tsx` — reset the main area's scroll on a **path** change but not on a search-parameter change (so paging does not yank the viewport), and move focus to the destination heading
- [X] T108 [US6] Audit every screen for skeleton coverage and fix the gaps — Dashboard, producer list, producer detail, safra list and safra detail must each show placeholders shaped like their eventual content, with no layout shift on arrival (FR-048, SC-005)
- [X] T109 [US6] Audit every submitting control across the auth, producer, farm, planting and safra forms and confirm each uses the `busy` `Button` so a double-click sends one request, not two (FR-049)
- [X] T110 [US6] Add hover and focus-visible states to the sidebar entries, list rows, buttons and inputs across `frontend/src/layout/` and `frontend/src/components/` (FR-053)
- [X] T111 [US6] Apply the `respectMotionPreference` mixin to every remaining animation — skeleton shimmer, toast entry, modal entry, bar widths and the mobile sidebar (FR-054)
- [X] T112 [US6] Animate the mobile sidebar open/close in `frontend/src/layout/Sidebar.tsx` and dispatch the `ui` action that closes it on every navigation, so the menu never sits over the content on a phone (FR-007)

**Checkpoint**: All six user stories are complete.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T113 [P] Complete `frontend/README.md` in pt-BR — prerequisites, the two-port dev arrangement, every npm script, and the production single-origin requirement (Principle III, Principle VIII)
- [X] T114 [P] Verify `frontend/.env.example` lists every key the code reads, holds no secret, and that no `.env` file is tracked (Additional Constraints)
- [X] T115 Verify every screen at 360px width — no horizontal scrolling of the page body, every destination reachable, and long producer, farm and city names wrapping or truncating predictably (SC-011, spec.md edge case "long text")
- [X] T116 Complete a keyboard-only sweep of every destination and every form, confirming a visible focus ring at each step and that modals trap and restore focus (SC-009)
- [X] T117 Audit every error path and confirm only the envelope's pt-BR `message` (or a pt-BR fallback) ever reaches a screen — `error`, `path`, `statusCode` and stack traces never do (SC-006, Principle V)
- [X] T118 Remove dead code, unused exports and any speculative abstraction; confirm no generic "resource slice" factory was introduced over the four concrete slices (Principle I)
- [X] T119 Run the full quality gate from `frontend/` — `npm run lint && npm run typecheck && npm test && npm run build` — and fix everything it reports (Development Workflow & Quality Gates)
- [X] T120 Execute all six validation scenarios in `specs/005-web-frontend/quickstart.md` against a running stack, including the seeded `1500.11 = 1000 + 500.11` farm that proves the area arithmetic is integer-based
- [X] T121 Verify the production path — `npm run build && npm run preview`, served behind a single origin with `/api/*` routed to the API and every other path falling back to `index.html`, then reload `/produtores/<id>` and confirm it does not 404 (contracts/routes.md, research.md R-006)
- [X] T122 Review the whole feature against `.specify/memory/constitution.md` — confirm the `react-router-dom` amendment from T001 is recorded, that `lib/httpClient.ts` is still the only `fetch` caller, that no business rule lives in a component, and that no rule shipped without a test (Principles I, II, IV, VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **T001 (amendment gate)**: blocks T050 and every routing task. Everything else in Phases 1–2 can proceed alongside it.
- **Setup (Phase 1)**: no dependencies beyond T002 creating the workspace.
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**.
- **User Stories (Phases 3–8)**: all depend on Foundational.
  - **US1 (P1)** is the true MVP and should land first; it creates the shell and routes every later story renders into.
  - **US2 (P2)**, **US3 (P3)** and **US5 (P5)** are independent of each other once US1 exists.
  - **US4 (P4)** depends on **US3** — farms are reached through the producer detail screen US3 creates — and on **US5**'s `fetchHarvests` thunk for its season selector (T092). If US4 is built before US5, implement `harvestsSlice` list-only as part of it.
  - **US6 (P6)** is polish over whichever stories exist; it can be applied incrementally rather than waiting for all five.
- **Polish (Phase 9)**: depends on every story that is being shipped.

### Within Each Story

Tests → types → API module → slice → selectors → screens → route wiring. Slices before the screens
that read them; the route wiring last, so a half-built screen is never reachable.

### Parallel Opportunities

- **Phase 1**: T004–T010 are seven different config files — all parallel after T003.
- **Phase 2**: the three rule-module test tasks (T014–T016) run in parallel, then their three implementations; `theme`, `motion`, `states` and `icons` (T011, T012, T020, T021) are four independent files; the UI-kit tasks (T028–T031) are four independent component groups.
- **Every story**: all test tasks in a story are parallel — they touch different files and share no state.
- **Across stories**: with more than one developer, US2, US3 and US5 can proceed simultaneously once US1 is merged.

---

## Parallel Example: User Story 1

```bash
# All five US1 test files, written together:
Task: "authSlice.test.ts — bootstrap starts pending; stale requestId ignored"
Task: "SignIn.test.tsx — 401 clears password, reveals nothing about the e-mail"
Task: "SignUp.test.tsx — password rules mirrored; register chains into login"
Task: "RequireAuth.test.tsx — redirect remembers the target; no sign-in flash on reload"
Task: "AppShell.test.tsx — shell stays mounted; active marking by section"

# Then the independent shell pieces:
Task: "layout/Header.tsx — product name, e-mail, sign out, mobile toggle"
Task: "layout/Sidebar.tsx — three destinations with icons and active marking"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Land T001 — the constitution amendment. Nothing routing-related is compliant until it exists.
2. Complete Phase 1: Setup.
3. Complete Phase 2: Foundational — the largest single investment, and every story rests on it.
4. Complete Phase 3: User Story 1.
5. **STOP and VALIDATE**: run quickstart.md scenario 1. Sign in, navigate all three destinations,
   reload, sign out. The destinations can hold placeholders and this is still a real, deployable app.

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. **+ US1** → sign-in and navigable shell → **MVP, demo it**
3. **+ US2** → the Dashboard fills the landing destination → demo
4. **+ US3** → producers become manageable → demo
5. **+ US5** → safras become manageable, and its `fetchHarvests` unblocks US4 → demo
6. **+ US4** → farms and plantings complete the registry → demo
7. **+ US6** → the polish pass across everything → demo
8. Phase 9 → gate, validate, ship

US5 is deliberately pulled ahead of US4 in this order: it is smaller, independently valuable, and it
supplies the season list that US4's planting form needs anyway.

### Parallel Team Strategy

1. Everyone lands Setup + Foundational together — it is the shared surface.
2. One developer takes US1 alone; it is on the critical path and touches the routing every other story renders into.
3. Once US1 merges: Developer A takes US2, Developer B takes US3 → US4, Developer C takes US5.
4. US6 is applied last by whoever finishes first, since it touches every screen.

---

## Notes

- **[P]** = different files, no dependency on incomplete work.
- Every rule module (`area`, `documents`, `format`) and every reducer has a unit test — Principle IV is non-negotiable, and a rule changed without its test must not merge.
- Every screen is tested in all four states (loading, success, empty, error) against a **mocked API client** — never a live server, never a network interceptor (SC-013, Principle IV).
- The two facts most likely to be got wrong, both already load-bearing in the tests: areas must be compared as **integer centi-hectares** (T014, T080), and a `fulfilled` action with a stale `requestId` must be **ignored** (T033, T062).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.

---

## Verification notes

Recorded at completion, so what was and was not directly observed is not left to inference.

**Verified live**, against `docker compose up` with a seeded registry, driving the real UI in Chrome:
the sign-in guard and redirect; deep-link reload keeping the session; the three destinations with
active marking; the Dashboard totals and all three breakdowns (land use summing to `6.911,11 ha`
exactly); the producer list with masked CPF and CNPJ; the producer detail rendering the
`1.500,11 = 1.000,00 + 500,11` farm with no unclassified remainder; creating a planting and seeing
the detail *and* the Dashboard reflect it without a reload; the safra list; and the in-use season
deletion refused with the server's own count.

**Verified statically** (T115, SC-011): no fixed `min-width`/`width` above 360px anywhere in `src`,
18 wrap/truncate guards, `auto-fit minmax` grids, `flex-wrap` on every horizontal row, and the
sidebar collapse asserted in `AppShell.test.tsx`. The browser tooling available here scaled the
window rather than producing a true 360px viewport, so this was **not** confirmed by eye at that
width. Worth one manual pass in device-emulation mode before shipping.

## Defects found and fixed during implementation

Four, all caught by running the thing rather than by reading it:

1. **Bootstrap deadlock on reload.** `/auth/me` was called before the stored token reached the
   store, so it went out unauthenticated, returned 401, and the resulting `sessionCleared` reset
   the slice mid-flight — which made the `requestId` guard discard the response that settles
   start-up, stranding the app on its skeleton forever. Fixed by restoring the session *before*
   verifying it, and by exempting bootstrap from the staleness guard (a stale response elsewhere is
   merely wrong; here, ignoring it is fatal). Regression tests in `authSlice.test.ts`.
2. **Invisible deletion refusal.** The confirm dialog stays open on failure, but had nowhere to show
   the failure — so FR-041's "this season is in use" message never reached the user. `ConfirmDialog`
   now takes an `error`.
3. **Stale error banner.** Dismissing a dialog left its failure behind as a banner with no way to
   clear it. `closeDialog` now clears the mutation state — which also put the previously unused
   `mutationErrorCleared` action to work (Principle I).
4. **Stray focus ring.** The programmatic focus anchor drew the global `:focus-visible` outline as a
   line across the top of every page after each navigation.

## Contract correction

The live API returns **hectares** in `byState` and a **count** in `byCrop` — the reverse of what
spec.md FR-019 assumed. The renderer branches on the `unit` the response declares rather than on
the dimension's name, so the values were always right, but the hard-coded card titles ("Fazendas por
estado", "Hectares por cultura") contradicted them. Titles now name the dimension and the unit is
labelled from the payload. **spec.md FR-019 still carries the wrong assumption and should be
corrected** — the behaviour is right, the specification's wording is not.

---

## Follow-up changes (post-implementation, requested by the product owner)

**Breakdowns are now pie charts.** The three Dashboard breakdowns render as donut charts instead
of proportional bars. `components/Bar.tsx` was deleted; `components/PieChart.tsx` replaces it.

The selector changed with them, and the change is not cosmetic: a bar's length is a share of the
*largest* category, while a slice is a share of the *total*. `selectBreakdown` now returns
`share` (percent of the whole) plus the whole itself, which the donut shows in its hole.

Two rules the pie form brings with it, both enforced in `selectors.ts`:

- **At most six slices.** Past six a slice is too thin to read and the palette runs out of
  colourblind-safe hues, so the tail folds into one neutral "Outras (n)" rather than inventing a
  seventh colour.
- **Largest first**, so the eye reads slices in the order they matter.

**Palette.** The all-green ramp is replaced by a six-hue categorical palette
(`#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300`), assigned in fixed order and never cycled —
a category keeps its colour however many others are on screen. The ordering was validated rather
than eyeballed: worst adjacent ΔE 9.1 for protanopia and 19.6 for normal vision against a white
surface, clearing both gates. Three of the six sit below 3:1 contrast on white, which obligates
visible labels — discharged by the legend (label + value + share as real text) and by in-place
share labels on slices wide enough to hold one (≥9%).

**Icons are Material Icons.** `src/icons/index.tsx` re-exports `@mui/icons-material` behind the
same role-named components the codebase already imported, so no call site changed. Recorded as
constitution amendment **1.2.0**, with its cost written down: `@mui/icons-material` requires
`@mui/material`, which brings Emotion — a second CSS-in-JS runtime alongside the mandated
styled-components, and +31 kB gzipped (97 kB → 128 kB). Emotion is a transitive dependency only;
application styling remains styled-components, and the amendment says so explicitly.

Suite grew 254 → 271 tests: `PieChart.test.tsx` (8) and `dashboard/selectors.test.ts` (9) are new.
