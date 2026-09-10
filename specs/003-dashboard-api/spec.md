# Feature Specification: Dashboard Summary (Backend)

**Feature Branch**: `003-dashboard-api`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Perfect all working good, now let's move to Dashboard feature (Backend APIs Only, next feature will be whole frontend). As a system user, I want to visualize a panel with consolidated vision with all producers and properties registered, to quickly understand a picture of database without having to check each record individually. Functional Requirements: Dashboard must show total farms(properties) registered as a simple count; Dashboard should show total hectares, summing the total area of all registered properties; Pizza charts: By state, By planted area, By used-ground (area and vegetation); The displayed data must reflect the current state of the database, no data range or time-period filter is required for this version. Edge cases: System without producer or property registered the dashboard should show zero/empty without error; Property registered without associated harvest or crop must count towards the totals for farms and hectares, but must not appear in the "by planted crop" chart; Property with multiple crops in the same harvest each crop must contribute individually to the crop char distribution, not just the main one; States with inconsistent names or abbreviations must not generate duplicate categories in the cart by state."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the Headline Totals (Priority: P1)

A signed-in user opens the dashboard and immediately sees two numbers: how many farms are on
record, and how many hectares they cover in total. No filtering, no date range — just the current
state of the registry, at a glance.

**Why this priority**: These two numbers are the smallest thing that answers "how big is this
registry?" without opening a single record. They depend on nothing else and are already useful on
their own.

**Independent Test**: With three properties of 100, 250.50 and 1500.11 hectares recorded, the
dashboard reports 3 farms and 1850.61 hectares. Nothing about charts needs to exist.

**Acceptance Scenarios**:

1. **Given** three properties totalling 1850.61 hectares, **When** a user requests the dashboard,
   **Then** it reports a farm count of 3 and a total of 1850.61 hectares.
2. **Given** an empty registry, **When** a user requests the dashboard, **Then** it reports 0 farms
   and 0 hectares and succeeds — an empty registry is a valid state, not an error.
3. **Given** producers exist but none of them has any property, **When** a user requests the
   dashboard, **Then** it still reports 0 farms and 0 hectares without failing.
4. **Given** areas with decimal parts such as 33.33 and 66.67, **When** they are totalled, **Then**
   the reported sum is exact and is not distorted by rounding.
5. **Given** a property is deleted, **When** the dashboard is requested again, **Then** both totals
   drop immediately to reflect the registry as it now stands.
6. **Given** no credential is presented, **When** the dashboard is requested, **Then** the request
   is refused as unauthenticated.

---

### User Story 2 - See How Farms Are Spread Across States (Priority: P2)

The user sees the registry broken down by federative unit, in a form ready to render as a pie
chart: one slice per state that actually has farms, with the value each slice represents.

**Why this priority**: "Where are we?" is the first question the totals provoke. It depends only on
properties existing, so it is testable as soon as US1 is.

**Independent Test**: With properties of 100 ha and 200 ha in MG, 50 ha in SP and 25 ha in BA, the
breakdown returns exactly three categories carrying 300, 50 and 25 hectares.

**Acceptance Scenarios**:

1. **Given** properties of 100 ha and 200 ha in MG, 50 ha in SP and 25 ha in BA, **When** the
   breakdown by state is requested, **Then** exactly three categories are returned carrying 300.00,
   50.00 and 25.00 hectares — the value is hectares, not a count of farms.
2. **Given** properties in only three states, **When** the breakdown is requested, **Then** the
   other 24 federative units are absent — not present with a value of zero.
3. **Given** an empty registry, **When** the breakdown is requested, **Then** an empty list is
   returned and the request succeeds.
4. **Given** properties whose stored state differs only in letter casing or surrounding
   whitespace, **When** the breakdown is requested, **Then** they fall into **one** category, not
   several.
5. **Given** any set of properties, **When** the breakdown is requested, **Then** the categories
   add up exactly to the hectare total of US1 — a user comparing the chart with the headline figure
   never sees them disagree.

---

### User Story 3 - See What Is Being Planted (Priority: P3)

The user sees which crops appear across the registry and in what proportion, ready to render as a
pie chart.

**Why this priority**: Answers "what do we grow?", the other half of the registry's purpose. It
needs harvests and crops to exist, so it comes after the property-only views.

**Independent Test**: With one property whose 2021 harvest records soybeans and corn, and a second
property with no harvest at all, the breakdown returns exactly two categories — soybeans and corn
— and the second property is absent from it while still counting in the US1 totals.

**Acceptance Scenarios**:

1. **Given** a harvest recording both soybeans and corn, **When** the crop breakdown is requested,
   **Then** **both** appear as separate categories — recording two crops in one season must not
   collapse to one.
2. **Given** a property with no harvest, or a harvest with no crop, **When** the crop breakdown is
   requested, **Then** that property contributes nothing to it, while still counting towards the
   farm and hectare totals of US1.
3. **Given** an empty registry, or a registry where no crop has ever been recorded, **When** the
   crop breakdown is requested, **Then** an empty list is returned and the request succeeds.
4. **Given** crops recorded as "Soja", "soja" and "SOJA" in different harvests, **When** the
   breakdown is requested, **Then** they fall into **one** category rather than three.
5. **Given** crops recorded as "Soja" and "Soya", **When** the breakdown is requested, **Then**
   they remain **two** categories — they are different words, and the registry has never claimed
   to know they mean the same plant.
6. **Given** one property recording soybeans in its 2021 harvest and again in its 2022 harvest,
   **When** the breakdown is requested, **Then** soybeans counts **twice** — the chart describes
   plantings, so a farm growing one crop for ten years weighs ten times a farm in its first year.
7. **Given** a registry of 3 farms where one has recorded four crops, **When** the crop breakdown
   is requested, **Then** its categories total 4 and **do not** match the farm count of 3 — the two
   figures count different things and are not meant to reconcile.

---

### User Story 4 - See How the Land Is Used (Priority: P4)

The user sees how the registered hectares divide between arable land and vegetation, ready to
render as a pie chart.

**Why this priority**: The most specialised of the four views, and the one that depends on the
areas already summed in US1.

**Independent Test**: With one property of 100 hectares recording 60 arable and 30 vegetation, the
land-use breakdown reports 60 arable, 30 vegetation and 10 unclassified, which together account for
the whole 100.

**Acceptance Scenarios**:

1. **Given** properties totalling 60 hectares of arable land and 30 of vegetation, **When** the
   land-use breakdown is requested, **Then** those two figures are reported exactly.
2. **Given** a registry where every property's arable and vegetation areas exactly consume its
   total, **When** the breakdown is requested, **Then** exactly **two** categories are returned —
   the unclassified category is omitted entirely rather than shown as an empty slice.
3. **Given** a property of 100 ha with 60 arable and 30 vegetation, **When** the breakdown is
   requested, **Then** a third category reports 10.00 hectares of unclassified land, and the three
   categories sum exactly to the hectare total of US1.
4. **Given** an empty registry, **When** the breakdown is requested, **Then** both figures are zero
   and the request succeeds.
5. **Given** a property recording zero arable and zero vegetation area, **When** the breakdown is
   requested, **Then** its whole area appears under unclassified, and its total is still counted in
   US1.

---

### Edge Cases

- **Nothing registered at all**: every figure is zero and every breakdown is an empty list. The
  dashboard succeeds; it does not fail, and it does not return "no data" as an error.
- **Producers but no properties**: same as above for every figure. A producer alone contributes
  nothing to a farm count or a hectare total.
- **Property with no harvest, or a harvest with no crop**: counts fully towards farms and hectares,
  contributes nothing to the crop breakdown. These two facts must both hold at once.
- **Several crops in one harvest**: each is counted. Soybeans and corn in 2021 is two
  contributions, not one.
- **The same crop in two harvests of one property**: two occurrences. The chart counts plantings,
  not farms, and therefore does not reconcile with the farm count.
- **State written inconsistently**: must not produce two categories. Note that the registry
  already stores states as a validated two-letter code, so this cannot arise from new data — but
  the breakdown must not depend on that remaining true.
- **Crop spelling variants**: "Soja" and "soja" are one category; "Soja" and "Soya" are two.
- **Decimal areas**: totals must be exact. A sum of many two-decimal areas must not drift, and must
  not be reported with more or fewer decimal places than it has.
- **Very large totals**: a registry of many large properties must report a total that is still
  exact, not rounded into scientific notation or truncated.
- **A category with a zero value**: never returned, in any breakdown. A federative unit with no
  properties, a crop with no records, and an unclassified remainder of exactly zero are all simply
  absent — an empty slice carries no information and renders as a visual artefact.
- **Data changing between two requests**: each request reflects the registry at the moment it is
  served. Two requests either side of a deletion legitimately disagree.

## Requirements *(mandatory)*

### Functional Requirements

**Access and Scope**

- **FR-001**: The dashboard MUST require an authenticated caller, consistent with every other
  operation in the system.
- **FR-002**: The dashboard MUST aggregate across the entire registry. There is no per-user
  scoping, because the registry is shared and has no roles.
- **FR-003**: The dashboard MUST be read-only. It MUST NOT create, change or delete any record.
- **FR-004**: The dashboard MUST reflect the registry as it stands when the request is served. It
  MUST NOT offer a date range, a time-period filter, or any other filter in this version.

**Headline Totals**

- **FR-005**: System MUST report the total number of registered properties as a plain count.
- **FR-006**: System MUST report the total area of all registered properties, summed exactly with
  no loss of precision, expressed in hectares to two decimal places.
- **FR-007**: With no properties registered, System MUST report zero for both figures and succeed.

**Breakdown by State**

- **FR-008**: System MUST report a breakdown of the registry by federative unit, in a form that can
  be rendered as a pie chart without further calculation.
- **FR-009**: The breakdown MUST contain exactly one category per federative unit that has at least
  one property. Units with no properties MUST be omitted rather than returned with a value of zero.
- **FR-010**: Categories MUST be derived from a normalised form of the state, so that differences
  in casing or surrounding whitespace cannot produce two categories for one unit.
- **FR-011**: Each state category's value MUST be the **total hectares** of the properties in that
  federative unit, and the categories MUST sum exactly to the hectare total of FR-006 — so a user
  comparing the chart with the headline figure can never see them disagree.

**Breakdown by Crop**

- **FR-012**: System MUST report a breakdown of the registry by planted crop, in a form that can be
  rendered as a pie chart without further calculation.
- **FR-013**: A property with no harvest, or with a harvest carrying no crop, MUST contribute
  nothing to this breakdown while still counting in full towards FR-005 and FR-006.
- **FR-014**: Every crop recorded in a harvest MUST contribute individually. Two crops in one
  harvest MUST produce two contributions, not one.
- **FR-015**: Crops MUST be grouped by the same normalised name the registry already uses to
  prevent duplicates within a harvest, so that "Soja", "soja" and "SOJA" form one category while
  "Soja" and "Soya" remain two.
- **FR-016**: Each category MUST carry a human-readable label. Where spellings differ, the label
  MUST be chosen by a stated, deterministic rule rather than arbitrarily, so that repeated requests
  over unchanged data return the same label.
- **FR-017**: Each crop category's value MUST be a **count of crop records**. Every recorded crop
  counts, including the same crop recorded in two different harvests of one property — the chart
  describes *plantings*, not farms.

**Breakdown by Land Use**

- **FR-018**: System MUST report the total arable area and the total vegetation area across all
  registered properties, each summed exactly.
- **FR-019**: The remaining area — total minus arable minus vegetation, summed across all
  properties — MUST be reported as a third **unclassified** category, so that the land-use
  breakdown sums exactly to the hectare total of FR-006. Where that remainder is exactly zero, the
  category MUST be omitted entirely per FR-022, leaving a breakdown of just arable and vegetation.
- **FR-020**: With no properties registered, System MUST report zero for every land-use figure and
  succeed.

**Measurement**

- **FR-021**: Every breakdown MUST state explicitly what its values represent — hectares for the
  state and land-use breakdowns, a count of crop records for the crop breakdown — so a consumer
  never has to guess whether a number is hectares or a tally.
- **FR-022**: No breakdown MUST EVER return a category whose value is zero. A federative unit with
  no properties, a crop with no records, and an unclassified area of zero are all simply absent.
  An empty slice carries no information and renders as a visual artefact.
- **FR-023**: The crop breakdown MUST NOT be expected to reconcile with the farm count or the
  hectare total, and this MUST be stated in its documentation. It counts plantings, and one
  property may contribute several — the numbers are deliberately incomparable.

**Consistency, Documentation and Observability**

- **FR-024**: All figures in a single dashboard response MUST be computed from one consistent view
  of the registry, so that a record created or deleted mid-request cannot make the totals disagree
  with the breakdowns.
- **FR-025**: The dashboard MUST be described in the published API documentation, including the
  shape of every figure and breakdown, and the meaning of each value.
- **FR-026**: A failure to produce the dashboard MUST be logged with enough context to diagnose it,
  and MUST NOT expose internal detail to the caller.
- **FR-027**: The dashboard MUST NOT include any producer document (CPF/CNPJ) or any other personal
  data. It reports aggregates only.

### Key Entities *(include if feature involves data)*

This feature introduces **no new stored data**. It reads what features `001-user-auth` and
`002-rural-producer-crud` already record:

- **Property** — the source of the farm count, the hectare total, the state breakdown and the
  land-use breakdown. Carries state, total area, arable area and vegetation area.
- **Harvest** — the link between a property and its crops. Contributes no figure of its own.
- **Crop** — the source of the crop breakdown. Carries a name and the normalised form of that name.
  **It carries no area**, which is why the crop breakdown cannot be expressed in hectares — see the
  Assumptions and Q1.
- **Producer** — owns properties but contributes to no figure in this version. Producers are not
  counted, because the description asks for farms and hectares.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can understand the size and shape of the registry from a single dashboard
  request, without opening any individual record.
- **SC-002**: The dashboard returns in under two seconds for a registry of 10,000 properties,
  50,000 harvests and 150,000 crops.
- **SC-003**: The state breakdown and the land-use breakdown each reconcile exactly with the
  hectare total in 100% of cases, verified across randomised data sets including empty,
  single-record and large registries.
- **SC-004**: An empty registry returns a successful response with zeroes and empty breakdowns in
  100% of cases — never an error, and never a null figure.
- **SC-005**: Hectare totals are exact to two decimal places, verified against a data set built
  from values known to drift under naive floating-point addition.
- **SC-006**: A property with no crops appears in the farm and hectare totals and in no crop
  category, verified in the same response.
- **SC-007**: Two consecutive requests over unchanged data return identical figures and identical
  category labels.
- **SC-008**: 100% of dashboard requests without a valid credential are refused.
- **SC-009**: No producer document or personal datum appears anywhere in a dashboard response,
  verified by scanning a full run of the automated test suite.
- **SC-010**: A newcomer can interpret every figure using only the published API documentation,
  without reading source code.
- **SC-011**: No breakdown ever returns a category whose value is zero, verified including the case
  where every property fully classifies its land and the unclassified category must disappear.

## Assumptions

- **Backend only.** This feature delivers the data a dashboard needs. Rendering, colours, layout
  and the charts themselves belong to the frontend feature that follows. "Pie chart" here means
  *data shaped so a pie chart can be drawn from it without further calculation*.
- **Builds on `001-user-auth` and `002-rural-producer-crud`.** Authentication already exists and
  protects every route by default; the registry already exists and is the sole data source. No new
  table, column or write path is introduced.
- **"By planted area" means by planted crop.** The description lists the second chart as "By
  planted area", but its own edge cases refer to it three times as the crop chart — "the by planted
  crop chart", "the crop chart distribution". It is read as a breakdown by crop.
- **State is measured in hectares, crop in record counts (confirmed).** A state category carries
  the total area of the properties in that unit; a crop category carries how many crop records
  name it. The response states which is which, so a consumer never has to infer it.

  Accepted consequence: the two charts answer different questions and **cannot be compared**. A
  state slice says "how much land is here"; a crop slice says "how often is this planted". This is
  also why FR-025 requires the crop breakdown to be documented as not reconciling with the farm
  count.
- **Every crop record counts, including repeats across harvests (confirmed).** One property
  recording soybeans in 2021 and again in 2022 contributes two occurrences.

  Accepted consequence: the chart is weighted by planting history, so a farm that has grown one
  crop for ten years outweighs ten farms in their first year. If the intent were ever "which farms
  grow what", that is a different chart and a later feature.
- **Unclassified land is a third category, omitted when it is zero (confirmed).** The remainder of
  total minus arable minus vegetation is reported so the land-use breakdown reconciles exactly with
  the hectare total. Where every property fully classifies its land, the remainder is zero and the
  category disappears, leaving a clean two-slice chart.

  This generalises into FR-022: **no breakdown ever returns a zero-valued category**, which is the
  same rule that already keeps 24 empty federative units out of the state chart.
- **Per-crop hectares are not available.** A recorded crop carries a name and nothing else — there
  is no area attached to a crop, and no way to attribute a property's hectares to one crop rather
  than another when a harvest holds several. Any hectare-based crop chart would require adding an
  area to each crop, which is a change to the previous feature and out of scope here. This is what
  Q1 turns on.
- **States cannot be inconsistent in new data.** The registry validates state against the 27
  federative units and stores it uppercased, so the duplicate-category problem the description
  raises cannot arise from data entered through the system. FR-012 still requires normalisation on
  read, so that the dashboard stays correct if data ever arrives another way.
- **Crop grouping reuses the existing normalised name.** The registry already stores a normalised
  form of each crop name to prevent duplicates within a harvest. The breakdown groups on that same
  key, which is what makes FR-017 possible without new data.
- **Producers are not counted.** The description asks for farms and hectares; a producer count was
  not requested and is not invented here.
- **Computed on demand, not cached.** FR-006 requires the current state of the registry, so every
  request recomputes. No cache, no scheduled snapshot, no eventual consistency.
- **Testing uses fixture data only**, per the project constitution — including a fixture set of
  areas chosen because they drift under naive floating-point addition.

## Out of Scope

Deliberately excluded, to be specified separately where valuable:

- Any frontend, chart rendering, colour scheme or layout — the next feature.
- Filtering of any kind: by date, by period, by state, by producer, by crop.
- Trends over time, comparisons between periods, or any historical series. The registry keeps no
  history, so there is nothing to trend.
- Adding an area to each crop. A hectares-by-crop chart would require it, and the decision on Q1
  was to keep the crop chart as a count rather than reopen the previous feature. Should an
  area-weighted crop chart be wanted later, it starts with a schema change there, not here.
- Counting producers, or any producer-level figure.
- Exporting the dashboard to a file (CSV, PDF, spreadsheet).
- Caching, pre-computation, materialised snapshots, or scheduled refresh.
- Per-user or per-role views. The registry is shared and has no roles.
- Drilling from a category into the records behind it.
