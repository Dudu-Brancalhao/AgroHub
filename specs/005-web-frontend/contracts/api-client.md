# Contract: API Client

**Feature**: 005-web-frontend | **Date**: 2026-09-10

Every backend operation this frontend consumes. All paths are relative and carry the API's global
prefix `api` (`app.setGlobalPrefix('api')`). In development Vite proxies `/api` to
`http://localhost:3000`; in production the bundle and the API share one origin (R-006). The client
therefore never holds an absolute API URL.

**Layering rule (Principle II)**: `lib/httpClient.ts` is the only module in the codebase that calls
`fetch`. Each feature's `api.ts` is the only caller of the http client. Thunks are the only callers of
`api.ts`. A component never reaches past its selectors and dispatch.

---

## `httpClient` responsibilities

One module, four jobs, nothing else:

1. **Prefix and serialise** — prepend `/api`, set `Content-Type: application/json`, serialise the body.
2. **Authorise** — attach `Authorization: Bearer <token>` from the auth slice on every request except
   `POST /auth/register` and `POST /auth/login` (FR-014).
3. **Normalise failures** — parse the error envelope into a typed `ApiError`
   (`{ statusCode, message, details?, requestId }`); on a network failure or non-JSON body, synthesise
   one with a pt-BR fallback message and `statusCode: 0`. It never throws a raw `Response`, a
   `TypeError`, or anything a screen would have to interpret.
4. **Signal a dead session** — on `401`, dispatch the session-cleared action before rejecting, so the
   redirect in FR-015 happens once and centrally rather than in every thunk.

It does **not** retry, cache, or transform domain data. Parsing decimal strings to `Centiares` belongs
to the feature `api.ts` modules, at the edge where the DTO becomes a client model.

---

## Authentication — `features/auth/api.ts`

| # | Operation | Method & path | Request | Success | Failures the UI handles |
|---|---|---|---|---|---|
| 1 | Create account | `POST /api/auth/register` | `{ email, password }` | `201` → `UserResponseDto` | `409` e-mail taken → on the e-mail field; `429` rate limited → explain and suggest waiting; `400` → field details |
| 2 | Sign in | `POST /api/auth/login` | `{ email, password }` | `200` → `LoginResponseDto` `{ accessToken, tokenType, expiresIn, user }` | `401` → `E-mail ou senha inválidos.`, password cleared, no hint whether the e-mail exists |
| 3 | Current user | `GET /api/auth/me` | — | `200` → `UserResponseDto` | `401` → session cleared, redirect to sign-in |

**Notes**

- Operations 1 and 2 are the only unauthenticated calls; both are `@Public()` on the server.
- Registration returns the user but **no token**. FR-012 requires the visitor to be signed in without
  retyping credentials, so the sign-up thunk chains `register` → `login` using the same credentials
  held in memory for that one call, then discards them.
- Operation 3 is used on start-up to confirm a rehydrated token is still good before painting
  protected content. A `401` here is the ordinary "your session ended" path, not an error state.

---

## Dashboard — `features/dashboard/api.ts`

| # | Operation | Method & path | Success | Failures |
|---|---|---|---|---|
| 4 | Registry summary | `GET /api/dashboard` | `200` → `DashboardSummaryDto` `{ totals, byState, byCrop, byLandUse }` | `401`; any other → error state with retry (FR-050) |

Hectare values arrive as decimal strings and are parsed to `Centiares` here, at the boundary.

---

## Producers — `features/producers/api.ts`

| # | Operation | Method & path | Request | Success | Failures the UI handles |
|---|---|---|---|---|---|
| 5 | List | `GET /api/producers?page&pageSize&search` | query only | `200` → `{ data: Producer[], total, page, pageSize }` | `401`; other → error state with retry |
| 6 | Read one | `GET /api/producers/:id` | — | `200` → `ProducerDetailDto` (producer **+ properties + their crops grouped by harvest**) | `404` → not-found screen with a way back |
| 7 | Create | `POST /api/producers` | `{ document, name }` | `201` → `ProducerResponseDto` | `409` document already registered → on the document field (FR-030); `400` → field details |
| 8 | Update | `PATCH /api/producers/:id` | `{ document?, name? }` | `200` → `ProducerResponseDto` | `409`, `404`, `400` as above |
| 9 | Delete | `DELETE /api/producers/:id` | — | `200` → `DeletionReportDto` | `404` |

**Notes**

- `pageSize` defaults to 20 server-side, max 100; `page` starts at 1.
- `search` matches name (case- and accent-insensitively) or document. The client trims it, omits the
  parameter when empty, and debounces ~300ms so typing does not fire one request per keystroke
  (FR-023).
- Operation 6 is the whole producer detail screen in one call (R-009). After any farm or planting
  mutation, re-issue operation 6 rather than patching nested state.
- Operation 9 **cascades** — the confirmation must say so (FR-029), and the report names what went.

---

## Properties / farms — `features/properties/api.ts`

| # | Operation | Method & path | Request | Success | Failures the UI handles |
|---|---|---|---|---|---|
| 10 | List by producer | `GET /api/producers/:producerId/properties` | — | `200` → `PropertyResponseDto[]` | `404` producer not found |
| 11 | Read one | `GET /api/properties/:id` | — | `200` → `PropertyDetailDto` | `404` |
| 12 | Create | `POST /api/producers/:producerId/properties` | `{ farmName, city, state, totalArea, arableArea, vegetationArea }` | `201` → `PropertyResponseDto` | `400` area rule or field errors → mapped to fields; `404` producer |
| 13 | Update | `PATCH /api/properties/:id` | any subset of the create body | `200` → `PropertyResponseDto` | `400`, `404` |
| 14 | Delete | `DELETE /api/properties/:id` | — | `200` → `DeletionReportDto` | `404` |

**Notes**

- **Areas go out as JSON numbers and come back as strings.** Serialise from `Centiares` by dividing by
  100 at the last moment; parse to `Centiares` on the way in (R-004, data-model.md).
- Operation 10 is redundant with operation 6 for the detail screen and is used only where a farm list
  is needed without the producer. Prefer 6.
- `state` must be sent uppercase; the server uppercases too, but sending the canonical value keeps the
  optimistic UI honest.

---

## Crops / plantings — `features/properties/api.ts`

| # | Operation | Method & path | Request | Success | Failures the UI handles |
|---|---|---|---|---|---|
| 15 | Create | `POST /api/properties/:propertyId/crops` | `{ harvestId, name }` | `201` → `CropResponseDto` | `409` duplicate for that farm+season → on the form (FR-037); `404` farm or season; `400` |
| 16 | List by farm | `GET /api/properties/:propertyId/crops` | — | `200` → `CropResponseDto[]` | `404` |
| 17 | List by season | `GET /api/harvests/:harvestId/crops` | — | `200` → `CropResponseDto[]`, each carrying `propertyId` | `404` season |
| 18 | Delete | `DELETE /api/crops/:id` | — | `200` → `DeletionReportDto` | `404` |

**Notes**

- Operation 17 backs the safra detail screen (FR-042). Each item carries `propertyId` directly, so the
  farm is identifiable without walking the tree — but the farm's *name* is not in the payload. The
  screen therefore resolves names from the producers it already holds, and falls back to showing the
  identifier only if a name is genuinely unavailable.
- Operation 16 is redundant with operation 6 for the producer detail screen; prefer 6 there.

---

## Harvests / safras — `features/harvests/api.ts`

| # | Operation | Method & path | Request | Success | Failures the UI handles |
|---|---|---|---|---|---|
| 19 | List | `GET /api/harvests` | — | `200` → `HarvestResponseDto[]` | `401` |
| 20 | Read one | `GET /api/harvests/:id` | — | `200` → `HarvestResponseDto` | `404` |
| 21 | Create | `POST /api/harvests` | `{ year }` | `201` → `HarvestResponseDto` | `409` year already registered → on the year field; `400` implausible year |
| 22 | Update | `PATCH /api/harvests/:id` | `{ year }` | `200` → `HarvestResponseDto` | `409`, `404`, `400` |
| 23 | Delete | `DELETE /api/harvests/:id` | — | `200` → `DeletionReportDto` | **`409` in use** → explain, keep the season (FR-041); `404` |

**Notes**

- The seasons list (19) is a prerequisite for the planting form, which selects rather than types a
  season. Load it when the producer detail screen mounts, not only on the Safras screen.
- Operation 23's `409` is a *designed refusal*, not an error: seasons are shared, so cascading would
  erase plantings across every farm in the registry. The message must convey that, and the count of
  blocking plantings that the server returns makes it concrete.

---

## Not consumed

`GET /api/health` — the operational liveness probe. It is infrastructure tooling with no place in the
user interface (recorded as an assumption in spec.md).

---

## Mapping to screens

| Screen | Operations |
|---|---|
| Sign in | 2 |
| Sign up | 1 → 2 |
| App start-up (rehydrate) | 3 |
| Dashboard | 4 |
| Produtores (list) | 5 |
| Produtor (detail, incl. farms and plantings) | 6, and 19 for the planting form's season options |
| Produtor form (create / edit) | 7, 8 |
| Producer deletion | 9 |
| Farm form (create / edit) | 12, 13 |
| Farm deletion | 14 |
| Planting form / deletion | 15, 18 |
| Safras (list) | 19, 21, 22, 23 |
| Safra (detail) | 20, 17 |

All 23 consumed operations appear at least once. Operations 10, 11 and 16 are implemented in the client
for completeness of the API surface but are not on a screen's primary path, since operation 6 already
returns their data — they exist for direct-link and refresh paths.
