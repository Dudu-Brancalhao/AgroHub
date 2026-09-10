# Contract: Routes

**Feature**: 005-web-frontend | **Date**: 2026-09-10

The URL surface of the application. Real path URLs via `BrowserRouter` — no hash fragments — matching
the style the user asked for (`/dashboard`, not `#/dashboard`).

**Dev origin**: `http://localhost:5173`. Vite's default is used because the API already owns port 3000
(R-006). In production the bundle and the API share one origin, so `/dashboard` and `/api/dashboard`
sit side by side.

**Language**: paths use the pt-BR nouns shown in the menu, because a URL is user-facing surface
(Principle VIII). Code identifiers around them stay English (`ProducerListPage`, `producersRoutes`).

---

## Route table

| Path | Screen | Guard | Data | Spec |
|---|---|---|---|---|
| `/` | — | — | Redirects to `/dashboard` | FR-002 |
| `/entrar` | Sign in | public | — | FR-011 |
| `/criar-conta` | Sign up | public | — | FR-012 |
| `/dashboard` | Dashboard | protected | op 4 | US2, FR-018–FR-021 |
| `/produtores` | Producer list | protected | op 5 | US3, FR-022–FR-024 |
| `/produtores/novo` | Producer create form | protected | — | FR-026 |
| `/produtores/:id` | Producer detail — farms and plantings | protected | op 6, op 19 | US3, US4 |
| `/produtores/:id/editar` | Producer edit form | protected | op 6 | FR-028 |
| `/safras` | Safra list | protected | op 19 | US5, FR-038–FR-041 |
| `/safras/:id` | Safra detail — plantings in this season | protected | op 20, op 17 | FR-042 |
| `*` | Not found | protected shell | — | FR-008 |

Operation numbers refer to [api-client.md](./api-client.md).

**Not routed**: farm and planting forms open as **modal dialogs** over the producer detail screen
rather than as their own routes. They are always creating or editing a child of the producer already
on screen, they carry no state worth bookmarking, and routing them would force a full re-fetch of the
producer on cancel. The confirmation dialogs for every delete behave the same way.

---

## Route structure

```text
<Routes>
  /entrar                     public,  standalone (no shell)
  /criar-conta                public,  standalone (no shell)

  <RequireAuth>               guard: no session -> redirect to /entrar, remembering the target
    <AppShell>                fixed header + sidebar; renders <Outlet/>   (FR-001..FR-005)
      /                       -> <Navigate to="/dashboard" replace/>
      /dashboard
      /produtores
      /produtores/novo
      /produtores/:id
      /produtores/:id/editar
      /safras
      /safras/:id
      *                       not found, inside the shell                (FR-008)
    </AppShell>
  </RequireAuth>
</Routes>
```

`AppShell` is the parent layout route. That is what delivers FR-005 structurally: the header and
sidebar are mounted once by the parent and never unmount on navigation — only the `<Outlet />`
content is replaced. Nothing else in the design has to work to keep the shell from reloading.

---

## The guard

`RequireAuth` is the single enforcement point for FR-009 and FR-010.

- **No session** → `<Navigate to="/entrar" state={{ from: location }} replace/>`. `replace` matters:
  without it, Back would land on the protected URL again and bounce.
- **After a successful sign-in** → navigate to `location.state.from` if present, otherwise
  `/dashboard`. This is what makes a deep link survive an interposed sign-in (FR-010).
- **Session still rehydrating on start-up** → render the shell's skeleton, not a redirect. Redirecting
  during rehydration would flash the sign-in screen at every reload for an already-signed-in user.
- **Signed in and on `/entrar` or `/criar-conta`** → redirect to `/dashboard`; a signed-in user has no
  business on the sign-in screen.

A `401` from any request clears the session centrally in the http client, at which point the guard
redirects on the next render — one code path for expiry, not one per screen (FR-015).

---

## Search parameters

Only the producer list carries them (FR-024).

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `busca` | string | absent | The search term. Omitted entirely when empty, never `?busca=`. |
| `pagina` | integer ≥ 1 | `1` | Omitted when 1, so the clean URL is `/produtores`. |

Rules:

- The URL is the source of truth: the component reads `useSearchParams` and dispatches from it, rather
  than holding its own copy that could drift.
- A search term change **replaces** the history entry (`replace: true`) while typing, so Back does not
  step through every keystroke; a page change **pushes**, so Back returns to the previous page.
- Changing the search resets `pagina` to 1 — keeping page 7 while narrowing to 3 results would show an
  empty page.
- Values are validated on read: a non-numeric or out-of-range `pagina` falls back to 1 rather than
  propagating a bad request.

---

## Navigation behaviour

- **Active marking** (FR-004): `NavLink` with `end` on `/dashboard`. `/produtores/:id` and
  `/produtores/novo` keep **Produtores** marked, and `/safras/:id` keeps **Safras** marked — the menu
  reflects the section, not the exact URL.
- **Scroll** resets to the top of the main area on a path change, while the header stays fixed
  (FR-001). It is not reset on a search-parameter change, so paging does not yank the viewport.
- **Transitions** (FR-052): the outlet content animates in on path change only — a search-parameter
  change updates the list in place, since animating a keystroke's result would read as flicker. All of
  it is suppressed under `prefers-reduced-motion` (FR-054).
- **Focus** moves to the main region's heading on navigation, so keyboard and screen-reader users are
  not left with focus on a link in the sidebar (FR-056).
- **Deep link to a missing record**: `/produtores/:id` or `/safras/:id` with an unknown id renders the
  not-found screen inside the shell with a way back — not a broken layout, and not a redirect that
  would hide what happened.

---

## Server requirement

`BrowserRouter` needs the static host to serve `index.html` for any unmatched path, so that reloading
`/produtores/abc` does not 404. In development Vite does this automatically. In production the
reverse proxy must route `/api/*` to the API and fall back to `index.html` for everything else — the
same single-origin proxy R-006 already requires. Recording it here so it is not discovered on the
first production reload.
