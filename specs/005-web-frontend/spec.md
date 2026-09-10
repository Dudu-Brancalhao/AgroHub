# Feature Specification: Web Frontend

**Feature Branch**: `005-web-frontend`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Perfect! Now let's wire all together with a Frontend. For this feature I need you to use the stack I already described on constitution. I'll want a page with a header fixed on top, with the project name on left edge of it, with a sidebar with three options "Dashboard", "Producers" and "Safras" all with icons and navigations pages. Then on main page we could handle all navigations to their respective features. Here I want to wire all endpoints that make sense we have so far and also use Redux to manage the react states. Also we could add little css animations on loadings and when navigating to a smooth UX."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and move around the application (Priority: P1)

An agronomy technician opens the AgroHub web address. Because they are not signed in, they land on a
sign-in screen. They enter the e-mail and password of their account and are taken into the
application. From then on they see a persistent shell: a bar fixed to the top of the window carrying
the product name on its left edge, and a vertical menu down the left side with three destinations —
**Dashboard**, **Produtores** and **Safras** — each shown with an icon and a label. Selecting a
destination swaps the content of the main area without the surrounding shell reloading or jumping,
and the selected destination stays visibly marked. Reloading the browser on any destination keeps
them on that same destination, still signed in. They can sign out from the top bar, which returns
them to the sign-in screen and prevents the destinations from being reached again until they sign
back in.

**Why this priority**: Nothing else in this feature is reachable without it. The shell, the routing,
the session and the guard around protected destinations are the frame every other story is rendered
inside; delivered on its own it is already a demonstrable, deployable application.

**Independent Test**: Sign in with valid credentials, select each of the three menu entries, confirm
the main area changes and the browser address changes with it, reload on each one, then sign out and
confirm the destinations are no longer reachable.

**Acceptance Scenarios**:

1. **Given** a visitor who is not signed in, **When** they request any destination inside the
   application, **Then** they are shown the sign-in screen instead and, after signing in
   successfully, are taken to the destination they originally asked for.
2. **Given** the sign-in screen, **When** valid credentials are submitted, **Then** the visitor is
   taken into the application shell and the Dashboard is shown by default.
3. **Given** the sign-in screen, **When** invalid credentials are submitted, **Then** a message in
   Brazilian Portuguese explains that the e-mail or password is wrong, the password field is cleared,
   and the visitor remains on the sign-in screen.
4. **Given** a signed-in user on any destination, **When** they reload the browser, **Then** the same
   destination is shown and they are still signed in.
5. **Given** a signed-in user, **When** they choose to sign out, **Then** the session is discarded,
   the sign-in screen is shown, and pressing the browser Back button does not restore the protected
   content.
6. **Given** a signed-in user whose session has expired, **When** they take any action that needs the
   server, **Then** they are returned to the sign-in screen with a message explaining that the session
   ended, rather than being shown a raw error.
7. **Given** a visitor without an account, **When** they follow the "create account" option on the
   sign-in screen and submit a valid e-mail and password, **Then** an account is created and they are
   signed in without having to type the credentials a second time.
8. **Given** any destination, **When** the window is narrowed to a phone-sized width, **Then** the
   menu collapses behind a toggle in the top bar and every destination remains reachable.

---

### User Story 2 - Read the registry at a glance on the Dashboard (Priority: P2)

The technician opens **Dashboard** and immediately sees the size of the registry: how many farms are
recorded and how many hectares they cover in total. Below that they see three breakdowns — farms by
state, hectares by crop, and hectares by land use (arable, vegetation, and any unclassified
remainder) — each presented as a proportional visual with readable labels and values. While the
figures are being fetched, the areas that will hold them show placeholder shapes rather than an empty
screen or a jumping layout. If the registry is still empty, the screen says so in plain language and
points to where producers are created.

**Why this priority**: It is the highest-value read-only screen and the natural landing page, and it
depends only on the shell from Story 1.

**Independent Test**: Seed the registry with a handful of producers, farms and plantings, open the
Dashboard, and confirm every total and every breakdown matches the seeded data; then empty the
registry and confirm the empty state appears instead.

**Acceptance Scenarios**:

1. **Given** a registry containing farms, **When** the Dashboard is opened, **Then** the total number
   of farms and the total hectares are shown, and each of the three breakdowns lists its categories
   with a label, a value and a proportional visual.
2. **Given** the Dashboard is fetching its figures, **When** the response has not arrived yet, **Then**
   placeholder shapes occupy the final position of each figure so the layout does not shift when the
   data arrives.
3. **Given** the land-use breakdown, **When** it is displayed, **Then** its categories add up exactly
   to the total hectares shown above it, and an unclassified category appears only when some area is
   genuinely unaccounted for.
4. **Given** an empty registry, **When** the Dashboard is opened, **Then** zero totals and an
   explanatory empty state are shown, with a way to go and create the first producer.
5. **Given** the figures fail to load, **When** the failure is detected, **Then** an error message and
   a retry action are shown in place of the figures, and retrying re-fetches without a full page
   reload.

---

### User Story 3 - Keep the producer registry up to date (Priority: P3)

The technician opens **Produtores** and sees the recorded producers in a paginated list showing name
and document. They type part of a name or a document into a search box and the list narrows as they
type, without them having to press a button. They open a producer to see its details, edit its name
or document, or delete it after confirming. They create a new producer by filling a form with name
and document; the form tells them immediately when the document is not a valid CPF or CNPJ, and tells
them clearly if the document already belongs to another producer. Deleting a producer warns that the
producer's farms and plantings go with it.

**Why this priority**: Producers are the root of the whole registry — no farm or planting can exist
without one — so this is the first screen that lets a user put data into the system.

**Independent Test**: Create a producer, find it through search, edit its name, then delete it, and
confirm the list reflects each change without a page reload.

**Acceptance Scenarios**:

1. **Given** the producer list, **When** it is opened, **Then** producers are shown one page at a time
   with a visible page control, and the current page survives a browser reload.
2. **Given** the producer list, **When** a search term is typed, **Then** the list narrows to producers
   whose name or document matches, ignoring letter case and accents, and repeated keystrokes do not
   issue one request per character.
3. **Given** a search that matches nothing, **When** the results come back empty, **Then** an empty
   state names the term that was searched and offers to clear it.
4. **Given** the producer form, **When** a document that is not a valid CPF or CNPJ is entered,
   **Then** the field is marked invalid with an explanatory message and the form cannot be submitted.
5. **Given** the producer form, **When** a document already registered to another producer is
   submitted, **Then** the message returned by the server is shown against the document field rather
   than as a generic failure.
6. **Given** a producer being edited, **When** the changes are saved, **Then** the updated values are
   visible in both the detail view and the list without a page reload.
7. **Given** a producer with farms, **When** deletion is requested, **Then** a confirmation states that
   the producer's farms and plantings will also be removed, and nothing is deleted unless it is
   confirmed.
8. **Given** any create, edit or delete action, **When** it succeeds, **Then** a short confirmation
   message appears and disappears on its own without blocking further work.

---

### User Story 4 - Manage a producer's farms and plantings (Priority: P4)

From a producer's detail screen the technician sees that producer's farms, each with its farm name,
city, state and its three areas. They add a farm by filling a form; if the arable area plus the
vegetation area exceeds the total area, the form explains the problem before anything is sent. They
edit or remove a farm. Inside a farm they see which crops were planted in which season, add a
planting by choosing a season and naming a crop, and remove a planting. Trying to record the same
crop twice for the same farm and season is refused with a clear explanation.

**Why this priority**: It completes the data the Dashboard reports on, but it is only reachable once
producers exist, so it follows Story 3.

**Independent Test**: On an existing producer, add a farm, add two plantings to it in one season,
attempt a duplicate planting, remove one planting, then remove the farm — confirming each result on
screen.

**Acceptance Scenarios**:

1. **Given** a producer's detail screen, **When** it is opened, **Then** that producer's farms are
   listed with farm name, city, state and the total, arable and vegetation areas.
2. **Given** the farm form, **When** the arable and vegetation areas together exceed the total area,
   **Then** the form explains the rule and refuses to submit.
3. **Given** the farm form, **When** an area is entered with decimals, **Then** the value is preserved
   exactly as entered, with no rounding drift between what was typed and what is displayed after
   saving.
4. **Given** a farm, **When** its plantings are opened, **Then** the crops recorded for it are shown
   grouped by season.
5. **Given** a farm's planting form, **When** a season and a crop name are chosen and submitted,
   **Then** the planting appears in that farm's list for that season.
6. **Given** a crop already recorded for a farm in a season, **When** the same crop is submitted again
   for that same farm and season, **Then** the server's rejection is shown as a readable message and
   no duplicate appears.
7. **Given** a farm or a planting, **When** removal is confirmed, **Then** it disappears from the
   screen and the producer's remaining data is unaffected.

---

### User Story 5 - Maintain the shared list of safras (Priority: P5)

The technician opens **Safras** and sees the seasons recorded in the system, listed by year. They add
a season by entering its year, rejected clearly if that year already exists or is outside the accepted
range. They open a season to see which farms planted what in it. They delete a season, and when the
season still has plantings attached the system explains that it cannot be removed while it is in use
rather than failing silently.

**Why this priority**: Seasons are shared reference data with a small surface, and the seasons needed
for day-to-day work can already be chosen from the planting form in Story 4 — so a dedicated screen is
valuable but the last of the three destinations to become essential.

**Independent Test**: Create a season, open it to view its plantings, attempt to delete a season that
is in use, then delete an unused one.

**Acceptance Scenarios**:

1. **Given** the Safras screen, **When** it is opened, **Then** every recorded season is listed by
   year in a consistent order.
2. **Given** the season form, **When** a year that already exists is submitted, **Then** a message
   states that the season is already registered and no duplicate is created.
3. **Given** the season form, **When** a year outside the accepted range is submitted, **Then** the
   field is marked invalid before anything is sent to the server.
4. **Given** a season, **When** it is opened, **Then** the plantings recorded in it are listed with the
   farm each one belongs to.
5. **Given** a season that still has plantings, **When** its deletion is confirmed, **Then** an
   explanatory message states it cannot be removed while it is in use and the season remains.
6. **Given** a season with no plantings, **When** its deletion is confirmed, **Then** it disappears
   from the list.

---

### User Story 6 - Feel the application respond smoothly (Priority: P6)

Throughout the application, waiting never looks like nothing happening and changing screens never
looks like a jolt. Content that is being fetched shows placeholder shapes in the shape of the content
to come. Buttons that trigger a request show a busy state and cannot be pressed twice. Moving between
destinations fades and settles the new content into place. Menu entries, rows and buttons respond
visibly to hover and to keyboard focus. Every one of these effects is short enough not to be felt as
a delay, and all of them are suppressed for visitors whose system asks for reduced motion.

**Why this priority**: It is polish layered over screens that already work; every earlier story is
demonstrable without it, and it can be applied across all of them at once.

**Independent Test**: Throttle the network, move between all three destinations and submit one form on
each, confirming placeholders, busy buttons and transitions appear; then enable the operating system's
reduced-motion setting and confirm the movement stops while the content still updates.

**Acceptance Scenarios**:

1. **Given** any screen whose content is being fetched, **When** the response has not arrived, **Then**
   placeholder shapes matching the eventual layout are shown instead of a blank area or a bare spinner.
2. **Given** any button that sends a request, **When** it is pressed, **Then** it enters a busy state
   and further presses are ignored until the request settles.
3. **Given** a destination change, **When** the new content is shown, **Then** it transitions in
   smoothly and the top bar and menu do not flicker, reload or move.
4. **Given** a visitor whose system requests reduced motion, **When** they use the application,
   **Then** transitions and animated placeholders are replaced by immediate state changes with no loss
   of information.
5. **Given** keyboard-only navigation, **When** focus moves through the menu and a form, **Then** the
   focused element is always visibly marked.

---

### Edge Cases

- **Server unreachable**: every screen that fetches data shows a message and a retry action instead of
  an indefinite loading state; the shell itself stays usable.
- **Session expiring mid-form**: the user is returned to sign-in with an explanation; unsaved input is
  not silently submitted after re-authentication.
- **Two tabs, one session**: signing out in one tab must not leave another tab showing protected
  content when it next interacts with the server.
- **Slow response**: an action that has not settled within a couple of seconds shows progress rather
  than appearing frozen; a response arriving after the user has navigated away is discarded rather
  than applied to the new screen.
- **Stale view after mutation**: after creating, editing or deleting, any list, counter or dashboard
  figure affected by the change reflects it without a manual page reload.
- **Rapid typing in search**: the list reflects the final term typed, not an earlier one that happened
  to return later.
- **Deep link to a missing record**: opening a producer, farm or season that no longer exists shows a
  "not found" screen with a way back, not a broken layout.
- **Very large numbers**: hectare totals and counts remain readable and do not overflow their container
  when values are very large.
- **Rate-limited account creation**: when the server refuses because too many accounts were created,
  the reason and the suggestion to wait are shown, not a generic error.
- **Long text**: producer names, farm names and city names at their maximum length wrap or truncate
  predictably without breaking the list or the menu.
- **Empty collections**: producers with no farms, farms with no plantings and seasons with no
  plantings each show an explanatory empty state with the relevant create action.

## Requirements *(mandatory)*

### Functional Requirements

#### Application shell and navigation

- **FR-001**: The application MUST present a persistent bar fixed to the top of the viewport that
  remains visible while the main area scrolls.
- **FR-002**: The top bar MUST display the product name on its left edge, and selecting it MUST return
  the user to the Dashboard.
- **FR-003**: The application MUST present a side menu with exactly three destinations — Dashboard,
  Produtores and Safras — each rendered with an icon and a text label.
- **FR-004**: The side menu MUST visibly mark which destination is currently shown.
- **FR-005**: Selecting a destination MUST replace only the main area, leaving the top bar and side
  menu in place and unreloaded.
- **FR-006**: Every destination MUST have its own address, so it can be bookmarked, reloaded and
  reached directly, and browser Back and Forward MUST move between visited destinations.
- **FR-007**: On viewports narrower than a tablet, the side menu MUST collapse behind a control in the
  top bar while keeping every destination reachable.
- **FR-008**: An address that matches no destination MUST show a "not found" screen inside the shell
  with a way back to the Dashboard.

#### Access and session

- **FR-009**: The application MUST require an authenticated session for every destination except
  sign-in and account creation.
- **FR-010**: An unauthenticated visitor requesting a protected destination MUST be shown the sign-in
  screen and, after signing in, MUST be taken to the destination originally requested.
- **FR-011**: The application MUST let a visitor sign in with an e-mail and a password and MUST report
  invalid credentials with a readable message that does not reveal whether the e-mail exists.
- **FR-012**: The application MUST let a visitor create an account with an e-mail and a password, MUST
  apply the same password rules the server enforces before submitting, and MUST sign the visitor in on
  success without asking for the credentials again.
- **FR-013**: The application MUST keep the session across browser reloads and MUST restore the
  signed-in identity on start-up without a second sign-in.
- **FR-014**: The application MUST attach the active session credential to every request to protected
  server operations.
- **FR-015**: When the server rejects a request because the session is absent or expired, the
  application MUST discard the local session, return the user to sign-in, and explain why.
- **FR-016**: The application MUST offer a sign-out action in the top bar that discards the session and
  makes protected destinations unreachable, including via the browser Back button.
- **FR-017**: The application MUST display the signed-in user's e-mail in the top bar.

#### Dashboard

- **FR-018**: The Dashboard MUST display the total number of registered farms and the total registered
  hectares.
- **FR-019**: The Dashboard MUST display a breakdown of farms by state, a breakdown of hectares by
  crop, and a breakdown of hectares by land use, each with category labels, values and a proportional
  visual representation.
- **FR-020**: The Dashboard MUST present hectare values with the precision supplied by the server, with
  no rounding introduced by the display.
- **FR-021**: The Dashboard MUST show an explanatory empty state, rather than empty charts, when the
  registry contains no farms.

#### Producers

- **FR-022**: The application MUST list producers one page at a time, showing at least name and
  document, with controls to move between pages.
- **FR-023**: The application MUST let the user filter the producer list by a free-text term matched
  against name and document, and MUST wait for a short pause in typing before issuing a request.
- **FR-024**: The search term and the current page MUST be reflected in the address so the same view
  can be shared and survives a reload.
- **FR-025**: The application MUST let the user view a single producer's details.
- **FR-026**: The application MUST let the user create a producer by supplying a name and a document.
- **FR-027**: The application MUST check, before submitting, that the name is present and within its
  length limit and that the document is a structurally valid CPF or CNPJ.
- **FR-028**: The application MUST let the user edit an existing producer's name and document.
- **FR-029**: The application MUST let the user delete a producer, only after an explicit confirmation
  stating that the producer's farms and plantings will be removed with it.
- **FR-030**: When the server rejects a producer because the document is already registered, the
  application MUST present that rejection against the document field.

#### Farms and plantings

- **FR-031**: The application MUST list the farms belonging to a producer, showing farm name, city,
  state, total area, arable area and vegetation area.
- **FR-032**: The application MUST let the user create, edit and delete a farm belonging to a producer,
  with deletion requiring an explicit confirmation.
- **FR-033**: The application MUST check, before submitting, that a farm's arable and vegetation areas
  together do not exceed its total area, and MUST perform this comparison without introducing decimal
  rounding error.
- **FR-034**: The application MUST restrict the state field to the valid Brazilian two-letter state
  codes.
- **FR-035**: The application MUST list the plantings recorded for a farm, grouped by season.
- **FR-036**: The application MUST let the user record a planting by selecting an existing season and
  naming a crop, and MUST let the user remove a planting after confirmation.
- **FR-037**: When the server refuses a planting as a duplicate for that farm and season, the
  application MUST present the refusal as a readable message against the form.

#### Safras

- **FR-038**: The application MUST list every registered season by year in a stable order.
- **FR-039**: The application MUST let the user create a season by year, checking the accepted year
  range before submitting.
- **FR-040**: The application MUST let the user edit a season's year and delete a season, deletion
  requiring an explicit confirmation.
- **FR-041**: When the server refuses to delete a season because plantings still reference it, the
  application MUST explain that it is in use and leave the season in place.
- **FR-042**: The application MUST let the user open a season and see the plantings recorded in it,
  identifying the farm each planting belongs to.

#### Shared state and data freshness

- **FR-043**: Server data displayed on more than one screen MUST be held in a single shared
  application-wide store rather than duplicated per screen, so every screen reads one value.
- **FR-044**: Every remote operation MUST expose an explicit state — idle, in progress, succeeded, or
  failed with a reason — that screens render from, rather than inferring progress from absent data.
- **FR-045**: After any create, edit or delete, every affected list, detail view and dashboard figure
  MUST reflect the change without a manual page reload.
- **FR-046**: A response that arrives after the user has left the screen that requested it MUST NOT be
  applied to the current screen.
- **FR-047**: Signing out MUST clear all cached server data held by the client, so a subsequent sign-in
  as another account shows no trace of the previous one.

#### Feedback, errors and motion

- **FR-048**: Every screen or region awaiting server data MUST show placeholder content shaped like the
  content that will replace it.
- **FR-049**: Every control that triggers a remote operation MUST show a busy state while it is in
  progress and MUST ignore repeated activation until it settles.
- **FR-050**: Every failed remote operation MUST show a human-readable explanation in Brazilian
  Portuguese and, where retrying is meaningful, a retry action.
- **FR-051**: Successful create, edit and delete operations MUST produce a brief, self-dismissing
  confirmation that does not block interaction.
- **FR-052**: Changing destinations MUST animate the incoming content into place, and no transition
  used anywhere in the application may last long enough to be perceived as waiting.
- **FR-053**: Menu entries, list rows, buttons and inputs MUST respond visibly to hover and to keyboard
  focus.
- **FR-054**: All motion MUST be suppressed when the visitor's system requests reduced motion, without
  any loss of information or function.
- **FR-055**: All content shown to the user MUST be written in Brazilian Portuguese, including labels,
  messages, empty states and validation text.
- **FR-056**: Every interactive element MUST be reachable and operable by keyboard alone, and the
  element holding focus MUST always be visible.

### Key Entities *(include if feature involves data)*

- **Session**: the signed-in identity and the credential that authorises requests; carries the user's
  e-mail and is discarded on sign-out or expiry.
- **Producer**: a person or company that farms; identified by a name and a unique CPF or CNPJ document;
  owns zero or more farms.
- **Farm**: a holding belonging to exactly one producer; has a farm name, a city, a state, and total,
  arable and vegetation areas in hectares.
- **Season (Safra)**: a planting year shared by the whole registry; identified by its year; belongs to
  no producer.
- **Planting**: the record that a given farm planted a named crop in a given season; unique per farm,
  season and crop name.
- **Registry summary**: aggregate farm count and hectare total for the whole registry, plus breakdowns
  by state, by crop and by land use.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can move between all three destinations and see each one's content
  without any full page reload occurring.
- **SC-002**: A user who knows a producer's name can find that producer and open its details in under
  20 seconds and no more than three interactions.
- **SC-003**: A user can register a new producer with one farm and one planting, end to end, in under
  3 minutes on their first attempt without consulting documentation.
- **SC-004**: On a first visit over a typical broadband connection, the application shell is visible in
  under 2 seconds, and each destination shows meaningful content or placeholders within 1 second of
  being selected.
- **SC-005**: 100% of screens that fetch data show placeholder content while waiting, and none shows a
  blank area or a shifting layout when the data arrives.
- **SC-006**: 100% of failed operations produce a readable Brazilian Portuguese explanation; no raw
  technical error text is ever shown to the user.
- **SC-007**: Every figure shown on the Dashboard matches the registry contents exactly, verified
  against a known seeded data set.
- **SC-008**: After any create, edit or delete, every affected view reflects the change with no manual
  reload, verified for producers, farms, plantings and seasons.
- **SC-009**: Every destination and every form can be completed using the keyboard alone, with the
  focused element visible at every step.
- **SC-010**: With reduced motion requested, no animated movement occurs anywhere in the application
  and every screen still conveys the same information.
- **SC-011**: The application is fully usable at 360px viewport width, with no horizontal scrolling of
  the page body and every destination reachable.
- **SC-012**: An expired session never surfaces as a raw failure: 100% of the time it results in a
  return to sign-in with an explanation.
- **SC-013**: Automated tests cover every screen's success, empty, loading and error states, and the
  suite passes deterministically in any execution order.

## Assumptions

- The frontend is a new, separately buildable and testable application in this repository, consuming
  the existing backend over its published HTTP contract; no backend change is required by this feature.
- The frontend is built on the stack the constitution mandates — ReactJS, Redux, Vite, Styled
  Components, Jest and React Testing Library — and adds no technology outside it beyond client-side
  routing and icon assets, which the planning phase must confirm against Principle VII or record as an
  amendment.
- Every server operation already published is consumed where it supports a screen in this
  specification: account creation, sign-in and current-user lookup; the registry summary; producer
  list with search and pagination, read, create, update and delete; farm list by producer, read,
  create, update and delete; planting list by farm, planting list by season, create and delete; and
  season list, read, create, update and delete. The health probe is operational tooling and is not
  surfaced in the interface.
- "Safras" is the user-facing Brazilian Portuguese term for what the backend calls harvests; the
  interface uses the Portuguese term throughout, and "Produtores" likewise for producers.
- Farms and plantings have no top-level menu entry because they are always reached through the producer
  or the season that owns them; the three menu destinations requested are the complete top-level
  navigation.
- Every account has the same permissions: there are no roles, and any signed-in user may read and
  modify the whole registry, matching what the backend enforces today.
- The session credential issued at sign-in is stored by the browser so it survives a reload, and it is
  the only credential the interface retains; the password is never kept after submission.
- Hectare values are treated as exact decimal text end to end — never converted to a binary floating
  point number for comparison, summation or display — because the backend's area rules depend on exact
  decimal comparison.
- Checks performed in the interface before submitting exist only to give immediate feedback; the server
  remains the authority, and every server rejection is surfaced against the field it concerns.
- Modern evergreen browsers are the target; no legacy browser support is in scope.
- Offline use, real-time push updates, data export, printing, languages beyond pt-BR, light/dark theme
  switching and user profile management are out of scope for this feature.
