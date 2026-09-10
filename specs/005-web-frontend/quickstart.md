# Quickstart: Web Frontend

**Feature**: 005-web-frontend | **Date**: 2026-09-10

How to run the frontend against the existing API, and how to validate that each user story actually
works. This is a run-and-verify guide; implementation detail lives in `tasks.md` and in the code.

---

## Prerequisites

- Node.js 20+ and npm
- Docker Desktop running (for the API and PostgreSQL)
- The backend's `.env` present (copy from `backend/.env.example` if it is missing)

---

## Start the API

From the repository root:

```bash
docker compose up -d           # PostgreSQL + the API on http://localhost:3000
curl http://localhost:3000/api/health
```

Expect `{"status":"ok","timestamp":"..."}`. The live contract is browsable at
<http://localhost:3000/api/docs>.

## Start the frontend

```bash
cd frontend
cp .env.example .env           # only VITE_-prefixed, non-secret values
npm install
npm run dev                    # http://localhost:5173
```

Port 5173, not 3000 — the API already owns 3000. Vite proxies `/api` to it, so the browser sees a
single origin and no CORS configuration is involved (research.md R-006).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check and produce the production bundle in `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm test` | Jest, jsdom, all unit and component tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run lint` | ESLint over `src/` |
| `npm run typecheck` | `tsc --noEmit` |

The quality gate before any merge (Development Workflow & Quality Gates) is:
`npm run lint && npm run typecheck && npm test && npm run build`.

---

## Seed some data

The screens are far easier to judge with content. Create an account and a small registry through the
API — this is also the fastest confirmation that the API is reachable:

```bash
BASE=http://localhost:3000/api

TOKEN=$(curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"demo@agrohub.com.br","password":"SenhaSegura1"}' > /dev/null; \
  curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@agrohub.com.br","password":"SenhaSegura1"}' | jq -r .accessToken)

AUTH="Authorization: Bearer $TOKEN"

PRODUCER=$(curl -s -X POST $BASE/producers -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Jose Antonio de Almeida","document":"529.982.247-25"}' | jq -r .id)

PROPERTY=$(curl -s -X POST $BASE/producers/$PRODUCER/properties -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"farmName":"Fazenda Santa Helena","city":"Uberaba","state":"MG","totalArea":1500.11,"arableArea":1000,"vegetationArea":500.11}' | jq -r .id)

HARVEST=$(curl -s -X POST $BASE/harvests -H "$AUTH" -H 'Content-Type: application/json' -d '{"year":2021}' | jq -r .id)

curl -s -X POST $BASE/properties/$PROPERTY/crops -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"harvestId\":\"$HARVEST\",\"name\":\"Soja\"}" > /dev/null
```

Note the areas: `1000 + 500.11 = 1500.11` exactly. This farm is the standing check that the client's
area arithmetic is done in integers — in floats the sum is `1500.1100000000001` and a naive client
check would refuse to submit a farm the server accepts (research.md R-004).

---

## Validation scenarios

Each maps to a user story in [spec.md](./spec.md). Run them against the seeded data above.

### 1. Shell and navigation (US1)

1. Open <http://localhost:5173/dashboard> while signed out → the sign-in screen appears.
2. Sign in with the seeded credentials → you land on `/dashboard`, not on the sign-in screen again.
3. Click each menu entry → the address changes to `/dashboard`, `/produtores`, `/safras`; the entry you
   are on is visibly marked; the header and sidebar do not flicker or reload.
4. Reload on `/safras` → still `/safras`, still signed in.
5. Browser Back → returns to the previous destination.
6. Open `/produtores/00000000-0000-4000-8000-000000000000` → a not-found screen **inside the shell**,
   with a way back.
7. Sign out → the sign-in screen; press Back → you do not see protected content again.
8. Narrow the window to 360px → the sidebar collapses behind a toggle in the header; every destination
   is still reachable; the page body does not scroll horizontally.

**Expected**: FR-001–FR-017, SC-001, SC-011, SC-012.

### 2. Dashboard (US2)

1. Open `/dashboard` → total farms `1`, total hectares `1.500,11`.
2. The three breakdowns render with labels, values and proportional bars: `MG` under by-state, `Soja`
   under by-crop, and arable/vegetation under land use.
3. **Add the land-use values** → they equal `1.500,11` exactly, with no rounding drift (SC-007).
4. Throttle the network in devtools and reload → skeleton placeholders occupy the final positions;
   nothing jumps when the values arrive.
5. Stop the API (`docker compose stop api`) and reload → an error message with a retry action, not an
   endless spinner. Restart it and press retry → the figures load without a page reload.
6. Empty the registry (delete the producer) → an empty state with a link to create a producer, not
   zero-height bars.

**Expected**: FR-018–FR-021, FR-048, FR-050, SC-005, SC-007.

### 3. Producers (US3)

1. `/produtores` → the seeded producer, with a page control.
2. Type `jose` in the search → the list narrows. Watch the network tab: **one** request after you stop
   typing, not one per keystroke. The address becomes `/produtores?busca=jose`.
3. Type `zzz` → an empty state naming the term, offering to clear it.
4. Create a producer with document `111.111.111-11` → rejected client-side before any request
   (repeated digits fail the CPF check digits).
5. Create one with the seeded document `529.982.247-25` → the server's `409` appears **on the document
   field**, not as a generic banner.
6. Create a valid one → success toast, and it appears in the list without a reload.
7. Edit its name → the new name shows in both the detail and the list.
8. Delete it → the confirmation warns that its farms and plantings go too; the toast afterwards names
   what was removed.

**Expected**: FR-022–FR-030, FR-045, FR-051, SC-002, SC-008.

### 4. Farms and plantings (US4)

1. Open the seeded producer → the farm shows name, city, state and all three areas.
2. Add a farm with total `100`, arable `60`, vegetation `50` → refused client-side with the sum rule
   explained; nothing is sent.
3. Add a farm with total `1500.11`, arable `1000`, vegetation `500.11` → **accepted**. This is the
   float trap; if it is refused, the area comparison is being done in floats.
4. Add a planting: season `2021`, crop `Milho` → appears under 2021 for that farm.
5. Add `Soja` for 2021 on the seeded farm again → the server's duplicate `409` shows as a readable
   message on the form; no duplicate row appears.
6. Delete a planting, then the farm → each disappears; the producer's other data is untouched.
7. Return to `/dashboard` → the totals reflect every change, with no manual reload.

**Expected**: FR-031–FR-037, FR-045, SC-003, SC-008.

### 5. Safras (US5)

1. `/safras` → `2021` listed.
2. Add `2021` again → `409`, shown on the year field.
3. Add `1899` → refused client-side, before any request.
4. Add `2024` → appears in the list.
5. Open `2021` → the plantings recorded in it, each identifying its farm.
6. Delete `2021` (which has plantings) → **refused with an explanation that it is in use**, and the
   season stays. This is a designed refusal, not a failure — if it reads as a generic error, FR-041 is
   not met.
7. Delete `2024` (no plantings) → it disappears.

**Expected**: FR-038–FR-042.

### 6. Motion and accessibility (US6)

1. Throttle to Slow 3G, navigate between all three destinations → skeletons everywhere, content fades
   in, the shell never moves.
2. Submit any form and watch the button → it goes busy; double-clicking sends one request, not two
   (check the network tab).
3. Enable reduced motion (Windows: Settings → Accessibility → Visual effects → Animation effects off;
   macOS: Accessibility → Display → Reduce motion) → reload. **No animation anywhere**, and every
   screen still shows the same information.
4. Put the mouse away and Tab through the whole application → focus is always visible, every control
   is reachable, and modals trap focus and return it on close.
5. Navigate with the keyboard → focus lands on the new screen's heading, not back in the sidebar.

**Expected**: FR-048, FR-049, FR-052–FR-054, FR-056, SC-009, SC-010.

---

## Production check

The dev proxy does not exist in a built bundle. Before calling this done:

```bash
cd frontend && npm run build && npm run preview
```

Serve `dist/` and the API behind one origin, with `/api/*` routed to the API and every other path
falling back to `index.html` — otherwise reloading `/produtores/<id>` returns a 404 from the static
host (contracts/routes.md). A genuinely cross-origin deployment would need CORS enabled on the
backend, which is backend work and out of scope for this feature (research.md R-006).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every request 404s | The dev proxy is off, or the `/api` prefix was dropped | Check `vite.config.ts`; the API's global prefix is `api` |
| Requests blocked by CORS | The client is calling `http://localhost:3000` absolutely instead of relative `/api` | All paths must be relative; the proxy does the rest |
| `SyntaxError: Cannot use 'import.meta' outside a module` in Jest | A file other than `src/config/env.ts` reads `import.meta.env` | Route the read through `config/env.ts`, which Jest maps to a stub (research.md R-005) |
| A valid 1500.11 ha farm is refused | Areas are being compared as floats | Compare in integer centi-hectares (research.md R-004) |
| Signed out on every reload | The token is not being rehydrated, or `expiresAt` is being computed wrong | Check the `localStorage` read on start-up (research.md R-007) |
| Reloading a deep link 404s in production | The static host is not falling back to `index.html` | Configure the SPA fallback in the reverse proxy |
