# Contract: Redux Store

**Feature**: 005-web-frontend | **Date**: 2026-09-10

The shape of the single application-wide store (FR-043), the request-state discipline every slice
follows (FR-044), and the invalidation rules that keep screens fresh (FR-045). Built with Redux
Toolkit `configureStore` + `createSlice` + `createAsyncThunk`; RTK Query is deliberately not used, so
this shape is hand-written and reviewable (R-003).

---

## Request state — the one pattern every slice repeats

```ts
type RequestStatus = 'idle' | 'pending' | 'succeeded' | 'failed';

type RequestState = {
  status: RequestStatus;
  error: string | null;        // pt-BR message, ready to render. Never a raw envelope.
  requestId: string | null;    // the latest dispatched request; older ones are ignored
};
```

Three rules, applied identically everywhere:

1. **Screens render from `status`**, never from whether data happens to be `null`. "No data yet" and
   "loaded, genuinely empty" are different screens (a skeleton versus an empty state), and only
   `status` distinguishes them.
2. **`error` holds the pt-BR message and nothing else.** The http client has already reduced the
   envelope; `statusCode`, `error` and `path` never reach the store, so they cannot leak to a screen
   (SC-006).
3. **`requestId` is how FR-046 is satisfied.** A `pending` action records its `requestId`; a
   `fulfilled` or `rejected` action whose `requestId` does not match the stored one is ignored
   entirely. A slow response landing after the user has moved on cannot repaint the current screen.

---

## Root state

```ts
type RootState = {
  auth:       AuthState;
  dashboard:  DashboardState;
  producers:  ProducersState;
  harvests:   HarvestsState;
  ui:         UiState;
};
```

Four server-data slices and one UI slice. There is no `properties` slice: farms and plantings always
arrive inside the producer detail response and are re-read through it (R-009). Adding one would create
two places holding the same farm — exactly what FR-043 forbids.

---

## `auth`

```ts
type AuthState = {
  session: Session | null;       // token, expiry and user — see data-model.md
  bootstrap: RequestState;       // the start-up rehydrate + GET /auth/me
  signIn: RequestState;
  signUp: RequestState;
};
```

- `bootstrap` starts at `pending`, not `idle`: the app genuinely does not know whether it has a
  session until the stored token is read and verified, and the guard must render a skeleton rather
  than the sign-in screen during that window (routes.md).
- `signIn` and `signUp` are separate request states because both forms can be visited in one session
  and neither should show the other's error.
- `session` is the only slice field persisted, to `localStorage`, on change (R-007).
- **`sessionCleared`** is a plain action, dispatched by the http client on any `401`, by the sign-out
  button, and by the cross-tab `storage` listener. Its reducer sets `session` to `null` — and the root
  reducer additionally resets every other slice to its initial state (FR-047), so a subsequent sign-in
  as a different account cannot show a trace of the previous one. Implemented by wrapping
  `combineReducers` so `sessionCleared` returns `undefined` state to every slice: one line, and no
  slice has to remember to participate.

## `dashboard`

```ts
type DashboardState = {
  summary: RegistrySummary | null;
  request: RequestState;
  stale: boolean;                // set by any successful mutation anywhere
};
```

`stale` is how FR-045 reaches a screen that is not mounted. Any fulfilled create/update/delete in any
slice sets it; the Dashboard re-fetches on mount when `stale` is true, or when `status` is `idle`. It
does not poll and does not re-fetch on every visit — a user flipping between destinations without
changing anything should not re-issue the query.

## `producers`

```ts
type ProducersState = {
  list: {
    items: Producer[];
    total: number;
    page: number;
    pageSize: number;
    search: string;              // mirrors the URL; the URL remains the source of truth
    request: RequestState;
  };
  detail: {
    id: string | null;
    producer: ProducerDetail | null;   // includes properties, each with crops grouped by harvest
    request: RequestState;
  };
  mutation: RequestState;        // shared by producer, farm and planting writes
};
```

- `list` and `detail` hold separate request states so opening a producer never blanks the list behind
  it.
- `detail.id` guards the render: while it does not match the `:id` in the URL, the screen shows a
  skeleton rather than the previously opened producer's data.
- A single `mutation` request state is shared by every write reachable from the producer screens.
  Justified because only one dialog is open at a time — the UI makes concurrent writes unreachable.
  If that ever stops being true, this is the field to split.

## `harvests`

```ts
type HarvestsState = {
  items: Harvest[];
  request: RequestState;
  detail: { id: string | null; crops: Crop[]; request: RequestState };
  mutation: RequestState;
};
```

`items` is loaded by the Safras screen **and** by the producer detail screen, which needs it to
populate the planting form's season selector. It is fetched once and shared — a second copy inside the
producers slice would violate FR-043.

## `ui`

```ts
type UiState = {
  toasts: Array<{ id: string; kind: 'success' | 'error'; message: string }>;
  sidebarOpen: boolean;          // mobile only; the desktop sidebar is always visible
  confirm: ConfirmRequest | null;
};
```

The only slice holding no server data. Toasts satisfy FR-051 and are dismissed by their own timeout or
by the user; `sidebarOpen` satisfies FR-007 and resets to `false` on every navigation so the menu does
not stay over the content on a phone.

---

## Thunks

One per operation in [api-client.md](./api-client.md), named after what it does, not after its HTTP
verb:

| Slice | Thunks |
|---|---|
| `auth` | `bootstrapSession`, `signIn`, `signUp` (chains register → login), `signOut` (plain action) |
| `dashboard` | `fetchSummary` |
| `producers` | `fetchProducers`, `fetchProducer`, `createProducer`, `updateProducer`, `deleteProducer`, `createProperty`, `updateProperty`, `deleteProperty`, `createCrop`, `deleteCrop` |
| `harvests` | `fetchHarvests`, `fetchHarvest`, `fetchHarvestCrops`, `createHarvest`, `updateHarvest`, `deleteHarvest` |

The farm and planting thunks live in the **producers** slice because their result invalidates the
producer detail, which that slice owns. Putting them elsewhere would mean reaching across slices to
invalidate — a dependency pointing the wrong way (Principle II).

**Every mutating thunk ends the same way**: on success it re-fetches the one query that owns the
changed data (`fetchProducer` for anything under a producer, `fetchHarvests` for a season), sets
`dashboard.stale = true`, and pushes a success toast. Three lines, always the same three, which is why
FR-045 holds without hand-patching nested state (R-009).

---

## Selectors

Every component reads through a selector; none reaches into `state` directly. This keeps the shape
above changeable without touching components, and gives the derived values one home:

- `selectSession`, `selectIsAuthenticated`, `selectUserEmail`
- `selectProducerList`, `selectProducerListStatus`, `selectPageCount` (derived from `total` and
  `pageSize`)
- `selectProducerDetail`, `selectProducerFarms`, `selectFarmHarvests(farmId)`
- `selectHarvests`, `selectHarvestOptions` (sorted, shaped for the season selector)
- `selectSummaryTotals`, `selectBreakdown(kind)` — parsing hectare strings to `Centiares` and computing
  each bar's proportion
- `selectToasts`, `selectSidebarOpen`

Selectors that compute (`selectPageCount`, `selectBreakdown`) are memoised with `createSelector`; the
plain field reads are not, because memoising a property access adds cost and indirection for nothing.

---

## Store configuration

```ts
configureStore({
  reducer: rootReducer,          // combineReducers wrapped for sessionCleared (see auth)
  // Default middleware is kept: serializability and immutability checks catch a Date or a class
  // instance entering the store, which is exactly the mistake this shape must not tolerate.
});
```

- **No custom middleware.** The http client's `401` handling is a dispatch from a module the store
  already knows about, not an interceptor, so nothing needs to sit in the pipeline.
- **Nothing non-serialisable in the store**: dates stay ISO strings, areas stay integers
  (data-model.md). The default checks enforce this in development and in tests.
- **Devtools** are enabled by `configureStore` in development only, which is the practical payoff of
  writing the slices out by hand: the whole application state is one readable tree.

---

## What tests assert against this contract

Per Principle IV, the store is business logic and gets unit tests independent of any component:

- Each reducer: the `pending` → `fulfilled` and `pending` → `rejected` transitions, and that a
  `fulfilled` with a **stale `requestId` is ignored** (FR-046 — the rule most likely to regress
  silently).
- `sessionCleared` resets every slice, asserted by seeding all five and checking the whole tree
  returns to initial (FR-047).
- Each mutating thunk marks the dashboard stale and triggers the owning re-fetch (FR-045).
- Computed selectors: `selectPageCount` at boundaries (0 items, exact multiples), and
  `selectBreakdown` summing land-use categories to the total exactly, in integers (SC-007).
