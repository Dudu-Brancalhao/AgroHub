# Specification Quality Checklist: Shared Harvests, Crop as Junction

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

**Status: 16/16 pass. Spec is ready for `/speckit-plan`.**

### Validation history

**Iteration 1 (2026-09-10)** — 2 items failed:

1. *Scope is clearly bounded* — FAILED. The draft described the remodel but never said what must
   **not** change. A restructure touching two shipped features needs its blast radius stated, or a
   reviewer cannot tell an intended change from a regression. Added **Behaviour That Must Not
   Regress** (FR-027 – FR-032), plus **SC-005**.
2. *Requirements are testable and unambiguous* — FAILED. "Use `COUNT(DISTINCT property_id)`" is an
   implementation instruction, not a testable requirement, and left the chart's *meaning* unstated.
   Rewritten as an explicit statement of what a category counts, plus a summing invariant that makes
   it checkable without reading a query.

**Iteration 2 (2026-09-10)** — 1 item failed: three `[NEEDS CLARIFICATION]` markers awaiting Q1–Q3.

**Iteration 3 (2026-09-10)** — all 16 items pass. Q1–Q3 answered:

| Q | Answer | Spec changes |
|---|--------|--------------|
| Q1 | A year identifies exactly one season | **FR-008** rejects a duplicate year. Safra/safrinha becomes unrepresentable — recorded in Assumptions and Out of Scope. |
| Q2 | Refuse deletion while crops reference it | **FR-010** refuses and reports how many crops block it; **FR-011** allows deleting an unused season. New **SC-007**. |
| Q3 | Rebuild from empty | **The migration story removed entirely**, with four requirements and two success criteria. |

**Iteration 4 (2026-09-10)** — the crop chart reverts to counting plantings. All 16 items still pass.

The `COUNT(DISTINCT property_id)` instruction was withdrawn: a property recording a crop across
several seasons **may** count more than once, because the chart measures plantings. Consequences:

- **The dashboard story was removed.** With the chart unchanged there is no dashboard work, so the
  feature dropped from three stories to two.
- **FR-021 – FR-026 became regression guards** rather than changes — pinning that the breakdown
  keeps counting records, keeps grouping by normalised name, and keeps its documented meaning.
- **FR-022 replaced the "no category exceeds the farm count" invariant**, which is false for
  plantings: one farm across ten seasons produces ten. The categories now sum to the number of crop
  records held, which is the invariant that actually holds.
- **SC-002, SC-003 and SC-004 were rewritten** in the same direction.
- **Nothing in feature `003-dashboard-api` changes.** Its FR-017 and FR-023 were about to be
  reversed and now stand as written, along with the tests guarding them.

### The finding that reshaped this feature

**The remodel does not change the crop chart, and never needed to.**

The shipped breakdown groups crop records by name and counts them. It reads neither the season nor
the property — verified against the implementation, not inferred. So moving the farm onto the crop
record moves data the chart never touched.

This matters for how the feature is justified. The original request gave two reasons: a season is a
shared fact rather than a per-farm one, and the remodel makes dashboards easier. The first stands
entirely. The second is real but **deferred** — the benefit lands on charts that pair a crop with
something about the farm (crops by state, crops by producer, area by crop), none of which exist yet.
The spec now says so plainly rather than claiming a benefit this change does not deliver.

### One genuine chart consequence, from Q1 rather than the remodel

**FR-026.** A year now identifies exactly one season, and a crop is unique per farm-and-season. A
farm that previously recorded soybeans in both a safra and a safrinha harvest of 2021 could
contribute two records to that crop; it can now contribute one, because the second is no longer
recordable.

That is the only way this feature moves a dashboard figure, and it comes from the season rule, not
from any change to how the chart counts.

### Known work in feature `002-rural-producer-crud`

The plan must cover these, since this specification contradicts them where they stand:

| Artefact | Why it changes |
|----------|----------------|
| `002` spec — Harvest entity, US3 scenarios | A harvest no longer belongs to a property |
| `002` spec — the note explaining why `(propertyId, year)` is deliberately not unique | The reasoning no longer applies; a year is now globally unique |
| `002` test — "accepts two harvests in the same year (safra and safrinha)" | Now rejected; must assert the rejection |
| `002` contract — harvest and crop endpoint shapes | A crop names a property and a season |

Feature `003-dashboard-api` needs **no changes**, which is the outcome of iteration 4.

### Worth knowing at plan time

**Q3 means data loss is intended.** Rebuilding from empty is safe only while nothing is in
production. The deployment posture from feature 002 is still undecided; if it is settled before this
ships, Q3 has to be revisited, because a migration written afterwards costs far more than one
written now.

**The season rule is the risky part, not the junction.** Making the crop carry both keys is additive
and mechanical. Making a year globally unique removes a capability that feature 002 chose
deliberately, and that choice was documented with a reason. Worth confirming once more at plan time
that safra/safrinha genuinely is not needed.
