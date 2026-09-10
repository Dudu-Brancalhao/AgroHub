# Specification Quality Checklist: Dashboard Summary (Backend)

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

1. *Requirements are testable and unambiguous* — FAILED. "Pizza chart by state" leaves the single
   most important thing unsaid: **what number each slice holds**. A count of farms and a sum of
   hectares produce completely different charts from identical data. Split into **FR-021** (the
   response must state its own unit) and Q1, with **FR-011** requiring reconciliation against the
   headline total — a check that is only possible once the measure is pinned down.
2. *Edge cases are identified* — FAILED. The description's four edge cases were covered, but three
   that follow from the existing schema were missing: the same crop across two harvests of one
   property (became Q3), a category computing to zero, and decimal drift when summing many
   two-decimal areas. The last became **FR-006** and **SC-005**, because feature 002 already proved
   the naive version of that sum wrong.

**Iteration 2 (2026-09-10)** — 1 item failed: three `[NEEDS CLARIFICATION]` markers awaiting Q1–Q3.

**Iteration 3 (2026-09-10)** — all 16 items pass. Q1–Q3 answered and folded in:

| Q | Answer | Spec changes |
|---|--------|--------------|
| Q1 | Hectares by state, count by crop | **FR-011** fixes state values as hectares reconciling with FR-006. **FR-021** requires each breakdown to declare its unit. **FR-023** (new) requires the crop breakdown to be documented as *not* reconciling with the farm count — the two count different things. US2 scenarios rewritten with concrete hectare figures. |
| Q2 | Third "unclassified" category, **omitted when zero** | **FR-019** reports the remainder so land use reconciles with the hectare total. The refinement generalised into **FR-022** (new): *no breakdown ever returns a zero-valued category* — the same rule that already keeps 24 empty federative units out of the state chart. US4 §2 now asserts a clean two-slice result when every property fully classifies its land. |
| Q3 | Every crop record counts | **FR-017** states the chart describes plantings. US3 gained §6 (soybeans in 2021 and 2022 counts twice) and §7 (crop totals deliberately do not match the farm count). |

Adding FR-022 and FR-023 shifted the Consistency/Documentation block from FR-022–025 to
FR-024–027. Sequence is FR-001–FR-027 with no gaps or duplicates; SC-001–SC-011.

### Accepted trade-offs

Recorded in the spec's **Assumptions**, and worth re-reading at plan time:

- **The two charts cannot be compared.** A state slice answers "how much land is here"; a crop
  slice answers "how often is this planted". Someone will eventually notice the crop numbers do not
  add up to the farm count and report it as a bug — hence FR-023 requiring it to be documented.
- **The crop chart is weighted by planting history.** A farm growing one crop for ten years
  outweighs ten farms in their first year. If "which farms grow what" is ever wanted, that is a
  different chart.
- **An area-weighted crop chart remains impossible.** A `Crop` record carries only a name; there is
  no area on it, and no way to split a property's hectares between two crops in one harvest.
  Q1's answer keeps this out of scope, so an area-weighted version starts with a schema change in
  feature `002-rural-producer-crud`, not here.

None blocks this feature. All three are direct inputs to the frontend feature that follows, which
has to label these charts in a way that does not invite the comparison.
