# Specification Quality Checklist: Rural Producer Registry (CRUD)

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

1. *Requirements are testable and unambiguous* — FAILED. The draft carried "System MUST prevent
   registration where arable + vegetation exceeds total area" almost verbatim from the description,
   leaving three things untested: whether equality is allowed, whether the rule applies to updates,
   and how a *partial* update is evaluated. Split into **FR-013** (exceeds, not equals),
   **FR-014** (evaluated against the post-change record) and **FR-016** (exact decimal comparison),
   with US5 §3 and two edge cases pinning the behaviour.
2. *Edge cases are identified* — FAILED. No case for repeated-digit documents
   (`111.111.111-11` passes a naive check-digit routine), none for floating-point drift on the area
   comparison, none for empty children. All added; the first two promoted to **FR-006** and
   **FR-016** because each is a defect that ships silently.

**Iteration 2 (2026-09-10)** — 1 item failed: three `[NEEDS CLARIFICATION]` markers awaiting Q1–Q3.

**Iteration 3 (2026-09-10)** — all 16 items pass. Q1–Q3 answered and folded in:

| Q | Answer | Spec changes |
|---|--------|--------------|
| Q1 | Shared registry, no roles | **FR-002** now states any authenticated caller may read, change and delete any record, with no creator scoping and no role distinction. Roles moved firmly to **Out of Scope**. |
| Q2 | Cascade delete | **FR-030**/**FR-031** cascade producer → property → harvest → crop. Two requirements added that the answer implies but did not state: **FR-032** (all-or-nothing) and **FR-034** (report what was removed). US5 gained scenarios 5 and 6; **SC-006** verifies atomicity. |
| Q3 | Free-text crop names | **FR-024** trims, collapses inner whitespace, preserves the caller's capitalisation, compares case- and accent-insensitively. **FR-025** makes the duplicate rule use that normalisation. |

Inserting the deletion requirements created duplicate FR numbers; the Validation/Security block was
renumbered from FR-032–036 to FR-035–039 and all cross-references updated. Sequence is now
FR-001–FR-039 with no gaps, SC-001–SC-010.

### Accepted trade-offs

All three answers are recorded in the spec's **Assumptions** with their costs. Two are worth
re-reading at plan time:

- **The registry is publicly writable in its current form.** `001-user-auth` allows anyone to
  self-register with no verification; a shared registry with no roles means any member of the
  public who registers can edit or delete every record — and deletes now cascade. Neither feature
  is wrong on its own; the combination is. Closing self-registration or adding roles is the
  mitigation, and both are out of scope here. Raised, decided by the user, recorded.
- **Deletion is permanent, cascading, and has no undo**, since soft delete and audit history are
  both out of scope. FR-032 and FR-034 bound the damage — never half-deleted, and the caller is
  told how many records went — but nothing recovers them.

Neither blocks this feature. Both are direct inputs to whichever feature adds roles or reporting.
