# Feature Specification: Shared Harvests, Crop as Junction

**Feature Branch**: `004-harvest-remodel`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Chat, I just noticed we created a feature wrong. But its ok to fix it, its how we wired entities on rural producers crud. Currently we're handling 'Harvests' as specific for a Property, which isnt true and isnt good. And I could explain to you in two main reasons: 1. Since it's just a number theres no reason keeps repeting for all properties, also if a Harvests grow in future with more fields, would be not nice to change all. 2. It's way easier to treat dashboards latter, because Crops would become the conciliation entity, where would carry both harvest_id and property_id. So I think this way it's better. […] use `COUNT(DISTINCT property_id)` instead of `COUNT(*)`. Because the dashboard aggregates all harvests, a property that planted soybeans in both 2021 and 2022 will generate two rows for 'soybeans' in the `Crop` table; without `DISTINCT`, it would count as two properties in the chart, even though it is actually just one. […] But this changes a little how dashboard works and how crud works so it'll hit both features, could you take care of it?"


**Subsequent correction**: the original request asked for `COUNT(DISTINCT property_id)` on the crop
chart, which would have made it count farms. That was withdrawn in favour of keeping the chart as it
is — counting plantings, where a farm that recorded one crop across several seasons contributes more
than once. This specification reflects the corrected decision; the quoted text above is preserved
verbatim as the original request.

## Why This Change

Today a harvest belongs to exactly one property. Ten farms recording a 2021 season produce ten
separate "2021" records that describe the same thing. Two consequences follow:

1. **A season is a shared fact, not a per-farm one.** If a harvest ever carries more than a year — a
   start date, a region, an official label — that information would have to be entered, and
   corrected, once per farm.
2. **A crop cannot say which farm planted it.** A crop hangs off a harvest, which hangs off a
   property, so the farm is two relationships away and never appears on the crop record itself.
   Any future question that pairs a crop with something about the farm — its state, its size, its
   producer — has to travel that chain.

Making the season shared and the crop the junction — carrying both the property and the season —
fixes both. A season is recorded once; a crop states plainly which farm planted what, in which
season.

**What this does not change: the crop chart.** The existing breakdown counts crop records and
groups them by name; it never reads the farm or the season. It keeps working exactly as it does
today, and the benefit in point 2 is for the charts that come next, not this one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a Season Once, for Everyone (Priority: P1)

A user records the 2021 season a single time. It is then available to every property in the
registry; nobody records "2021" again. Correcting or extending a season is done once and every farm
sees the correction.

**Why this priority**: Everything else depends on the season existing as a shared record. On its
own it already delivers the first stated benefit — no repetition, one place to correct.

**Independent Test**: Record the 2021 season once, list the available seasons, and confirm a single
entry. Nothing about crops needs to exist.

**Acceptance Scenarios**:

1. **Given** an empty registry, **When** a user records the 2021 season, **Then** it is created once
   and appears in the list of available seasons.
2. **Given** the 2021 season already exists, **When** a user records it again, **Then** the request
   is rejected as a duplicate — a year identifies a season, so there can never be two
   indistinguishable "2021" records.
3. **Given** several seasons exist, **When** a user lists them, **Then** each appears exactly once,
   regardless of how many farms planted in them.
4. **Given** a season exists, **When** a user corrects it, **Then** the correction is visible to
   every property that planted in it, without touching any property record.
5. **Given** an implausible year — before 1900 or more than one year ahead — **When** it is
   submitted, **Then** it is rejected as invalid input.
6. **Given** no credential is presented, **When** any season operation is called, **Then** it is
   refused as unauthenticated.

---

### User Story 2 - Record What a Farm Planted in a Season (Priority: P2)

A user records that a given farm planted a given crop in a given season. The crop record names both
the farm and the season, so "which farm planted this" is answerable without following a chain of
relationships.

**Why this priority**: This is the substance of the change — the crop becoming the junction. It
needs seasons (P1) and properties to exist, and is independently testable by seeding both.

**Independent Test**: With one property and the 2021 season seeded, record soybeans for that farm
in that season, then read the crop back and confirm it names both.

**Acceptance Scenarios**:

1. **Given** a property and the 2021 season, **When** a user records soybeans for that pair,
   **Then** the crop is created and identifies both the property and the season.
2. **Given** a property that already has soybeans recorded for 2021, **When** the same crop is
   recorded again for the same farm and season, **Then** it is rejected as a duplicate.
3. **Given** two different properties, **When** each records soybeans for 2021, **Then** both are
   accepted — the duplicate rule applies within one farm-and-season pair, not across farms.
4. **Given** one property, **When** it records soybeans for 2021 and again for 2022, **Then** both
   are accepted — the same crop in two different seasons is two plantings.
5. **Given** a property and a season, **When** a user records soybeans and corn for that pair,
   **Then** both are accepted.
6. **Given** a crop submitted for a property that does not exist, or a season that does not exist,
   **When** it is submitted, **Then** it is rejected and no orphan crop is created.
7. **Given** a property with crops in several seasons, **When** the property is retrieved, **Then**
   its crops are returned grouped by season, so the shape stays readable.

### Edge Cases

- **The same farm, same crop, two seasons**: two crop records, counting **twice** in the chart. The
  chart measures plantings, so a farm growing soybeans for ten years weighs ten times a farm in its
  first year.
- **The same crop, same season, two farms**: two records, counting twice. Every record counts, with
  no de-duplication of any kind.
- **A season nobody planted in**: exists, and appears nowhere in the crop chart.
- **A season deleted while farms have crops in it**: refused, with the number of crops blocking it
  reported. A shared season cannot be destroyed by someone who thinks they are tidying their own
  farm.
- **A season deleted with no crops against it**: allowed.
- **A property deleted**: its crops go with it; the shared seasons remain, because they belong to
  nobody.
- **A crop naming a property that exists and a season that does not**, or the reverse: rejected, and
  no partial record is created.
- **The same crop recorded twice for one farm and season**, in different spellings ("Soja" then
  "SOJA"): rejected as a duplicate, as it is today.
- **A farm recording the same crop in ten seasons**: ten crop records and ten contributions to the
  chart. The chart total can therefore exceed the number of farms, which is correct and expected.
- **Two plantings of one crop by one farm in one calendar year** (safra and safrinha): no longer
  representable, because a year identifies exactly one season and a crop is unique per farm and
  season. A deliberate loss — see Assumptions. It also means such a farm now contributes one record
  rather than two to that crop's total, which is the only way this change moves a chart figure.
- **An empty registry**: every season and crop operation succeeds, and the crop breakdown is empty.

## Requirements *(mandatory)*

### Model Restructure

- **FR-001**: A season MUST exist independently of any property. It MUST NOT reference a property,
  and MUST NOT be duplicated per property.
- **FR-002**: A crop MUST reference **both** a property and a season, making it the record that
  reconciles the two.
- **FR-003**: A crop MUST NOT be reachable only through a chain of relationships. "Which farm
  planted this" MUST be answerable from the crop record itself.
- **FR-004**: A season MUST be able to exist with no crops recorded against it.
- **FR-005**: A property MUST be able to exist with no crops recorded against it, and MUST still
  count in full towards every property-level figure.

### Seasons

- **FR-006**: System MUST allow an authenticated user to create, list, retrieve, update and delete
  seasons.
- **FR-007**: A season MUST carry a year, and MUST reject a year before 1900 or more than one year
  beyond the current year.
- **FR-008**: A year MUST identify exactly one season across the whole registry. System MUST reject
  a second season carrying a year that already exists.
- **FR-009**: Correcting a season MUST take effect for every property with crops in it, without any
  property record being touched.
- **FR-010**: System MUST refuse to delete a season while any crop references it, and MUST say how
  many crops are blocking the deletion. A season is shared, so an unguarded delete would erase a
  year across every farm at once — a far larger blast radius than the per-property harvest it
  replaces.
- **FR-011**: System MUST allow deleting a season that no crop references.

### Crops

- **FR-012**: System MUST allow an authenticated user to record, list, retrieve and delete crops,
  each naming exactly one property and exactly one season.
- **FR-013**: System MUST reject a crop naming a property that does not exist, or a season that does
  not exist, and MUST NOT create a partial or orphan record.
- **FR-014**: System MUST reject recording the same crop twice for the **same property and the same
  season**, comparing names case- and accent-insensitively as it does today.
- **FR-015**: System MUST accept the same crop recorded by **different properties** in one season.
- **FR-016**: System MUST accept the same crop recorded by **one property in different seasons**.
- **FR-017**: System MUST accept several different crops for one property in one season.
- **FR-018**: Deleting a property MUST delete its crops. Deleting a property MUST NOT delete any
  season.

### Retrieval

- **FR-019**: Retrieving a producer MUST return their properties and, for each, its crops grouped by
  season, so the response stays readable now that seasons are shared.
- **FR-020**: System MUST allow listing the crops of one property, and listing the crops of one
  season across all properties.

### Dashboard

The crop breakdown keeps its current meaning. These requirements exist to pin that it survives the
restructure, not to change it.

- **FR-021**: The crop breakdown MUST continue to count **crop records** — plantings. A property
  that recorded one crop in several seasons MUST count **once per record**, and therefore more than
  once for that crop.
- **FR-022**: The crop categories MUST sum exactly to the total number of crop records held. This
  replaces any expectation that a category relates to the farm count.
- **FR-023**: A property with no crops MUST contribute nothing to the crop breakdown while counting
  in full towards the farm count and the hectare total.
- **FR-024**: Crops MUST continue to be grouped by their normalised name, so spelling variants form
  one category and genuinely different words stay separate.
- **FR-025**: The documented meaning of the crop breakdown MUST continue to state that it counts
  plantings and does not reconcile with the farm count.
- **FR-026**: A farm that can no longer record two plantings of one crop in one calendar year (see
  FR-008) MUST therefore contribute one record instead of two for that crop and year. This is a
  consequence of the season rule, not of any change to how the chart counts.

### Behaviour That Must Not Regress

The registry and dashboard already work. This change reshapes how crops and seasons relate and
MUST NOT alter anything else.

- **FR-027**: Every operation MUST continue to require authentication.
- **FR-028**: Producer document validation, document uniqueness, and the rule that arable plus
  vegetation area must not exceed total area MUST all continue to hold unchanged.
- **FR-029**: Deleting a producer MUST continue to remove its properties and their crops in one
  atomic operation, leaving no orphan of any kind.
- **FR-030**: The farm count, the hectare total, the breakdown by state and the breakdown by land
  use MUST all be unaffected by this change.
- **FR-031**: No producer document or other personal data MUST appear in any dashboard response.
- **FR-032**: All changed operations MUST be described in the published API documentation, including
  the new shape of a crop and the new meaning of the crop breakdown.

## Key Entities *(include if feature involves data)*

- **Producer** — unchanged. Owns properties.
- **Property** — unchanged in its own right, and still owned by exactly one producer. It no longer
  owns harvests; it now has crops.
- **Season** (formerly Harvest) — a planting season, identified by its year, existing **once for the
  whole registry**. Belongs to nobody. Referenced by crops.
- **Crop** — the junction. Names exactly one property and exactly one season, plus what was planted.
  A property and a season are related **only** through the crops that connect them.

The shape changes from a chain to a junction:

```
before:   Producer -> Property -> Harvest -> Crop
after:    Producer -> Property ----\
                                    >-- Crop
                          Season --/
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A season is recorded once regardless of how many farms plant in it — a registry of 100
  farms all planting in 2021 holds exactly one 2021 season.
- **SC-002**: A crop record names its farm and its season directly, so a question pairing a crop
  with something about the farm can be answered without traversing another record.
- **SC-003**: A farm that recorded one crop across ten seasons contributes ten to that crop's
  total, in 100% of cases — the chart measures plantings.
- **SC-004**: The crop categories sum exactly to the number of crop records held, verified across
  randomised registries including single-farm, many-season and empty cases.
- **SC-005**: Every previously passing behaviour of the registry and dashboard still passes —
  authentication, document validation, the area rule, cascade deletion, and all four dashboard
  figures including the crop breakdown, whose meaning and arithmetic are unchanged.
- **SC-006**: The dashboard still returns within two seconds at 10,000 properties and 150,000 crops.
- **SC-007**: A season carrying crops cannot be deleted, in 100% of attempts, and the refusal names
  how many crops are blocking it.
- **SC-008**: A newcomer can record a season, a farm and a planting using only the published API
  documentation, without reading source code.

## Assumptions

- **Backend only**, consistent with the three features before it. The frontend has not been built,
  so no client depends on the current shape yet — which is precisely why this is the moment to make
  the change.
- **Builds on `001-user-auth`, `002-rural-producer-crud` and `003-dashboard-api`.** This feature
  reshapes part of what those built; it does not replace them.
- **The word "harvest" becomes "season" in this document** to avoid confusion with the old
  per-property record. Whether the API keeps the name `harvest` is a naming decision for the plan,
  not a change of meaning.
- **The crop breakdown keeps its meaning: it counts plantings (confirmed).** A `COUNT(DISTINCT
  property_id)` correction was considered and rejected — that would have made the chart count farms
  and reversed the decision taken in feature `003-dashboard-api`, where the chart was defined as
  counting plantings and documented as not reconciling with the farm count. Counting records
  stands, so that feature's requirements remain correct as written and need no change.
- **The dashboard therefore requires no work.** The existing breakdown already groups crop records
  by name and counts them; it reads neither the season nor the property. This restructure moves
  data the chart never touched, so its query, its figures and its documentation all stay as they
  are. FR-021 through FR-026 exist to pin that, not to change it.
- **The structural benefit is for later charts, not this one.** Putting the farm on the crop record
  removes a relationship hop for any future question pairing a crop with something about the farm —
  crops by state, crops by producer, area planted by crop. None of those exist yet, so the payoff
  is deferred, and the remodel is justified on the first reason (a season is a shared fact) rather
  than the second.
- **A year identifies exactly one season (confirmed, Q1).** Two seasons can never share a year.

  Accepted loss, and it is a real one: feature `002-rural-producer-crud` deliberately allowed one
  property to hold two harvests in the same calendar year, because **safra and safrinha** — a main
  crop and a second planting — are both ordinary in Brazil. There is a passing test asserting a
  second 2021 harvest is accepted. With a unique year and a crop unique per farm-and-season, a farm
  can no longer record that it planted soybeans twice in 2021. Representing it again later means
  giving a season a label alongside its year, which is a migration on live data rather than a
  configuration change.

  Worth noting the loss does not affect the chart: under FR-022 that farm counts once for soybeans
  either way. What is lost is the ability to *record* the second planting, not to *count* it.
- **Deleting a season is refused while any crop references it (confirmed, Q2).** A season is now
  shared, so an unguarded delete would erase a year across every farm at once. Refusing keeps the
  blast radius at zero and makes the user delete the crops deliberately first.
- **The registry is rebuilt from empty (confirmed, Q3).** No records are migrated; the existing
  producers, properties, harvests and crops are discarded when the change is applied.

  Accepted consequence: **any data in a running instance is lost.** This is safe today only because
  the deployment posture from feature 002 is still undecided and nothing is in production. If that
  changes before this ships, the decision has to be revisited — a migration afterwards is far more
  expensive than one written now.
- **A season carries only a year for now.** The stated motivation is that it *could* grow more
  fields later; none are being added in this change.
- **Crop names remain free text**, grouped by their normalised form, exactly as today.
- **Testing uses fixture data only**, per the project constitution — including a fixture where one
  farm records the same crop across several seasons, since that is the case the chart correction
  exists for and the one small test data never produces.

## Out of Scope

- Any frontend.
- Adding fields to a season beyond the year — the point is that adding them later becomes cheap, not
  that they are added now.
- Adding an area to a crop. A hectares-by-crop chart remains impossible and out of scope, as before.
- Changing the state or land-use breakdowns, or any other dashboard figure.
- Changing producers, properties, authentication, or any rule not named above.
- Filtering the dashboard by season, or any other filter.
- A per-season view of the whole registry beyond listing that season's crops.
- Backfilling or reconciling crop-name spelling variants.
- Migrating existing records. The registry is rebuilt from empty (Q3), so no migration is written,
  tested or run.
- Representing two plantings of one crop by one farm in a single calendar year (safra and
  safrinha). A year identifies one season (Q1), so this is no longer representable; restoring it
  means adding a label to a season, which is a later feature.
