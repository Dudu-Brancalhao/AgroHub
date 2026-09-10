# Specification Quality Checklist: User Authentication (Registration & Login)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-09
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

**Iteration 1 (2026-09-09)** — 2 items failed:

1. *No implementation details* — FAILED. Draft named the mandated stack directly ("issue a JWT",
   "hash with bcrypt", "Passport strategy"). Those belong in the plan, not the spec. Rewritten as
   capability language: "issues a session credential" (FR-008), "stored only in an irreversible,
   individually salted form" (FR-015).
2. *Scope is clearly bounded* — FAILED. Draft had no statement of exclusions, leaving password
   reset, refresh tokens, MFA, and roles ambiguous. Added the **Out of Scope** section.

**Iteration 2 (2026-09-09)** — 1 item failed: `No [NEEDS CLARIFICATION] markers remain`. Three
markers were raised as Q1 (identifier type), Q2 (verification before first login) and Q3 (session
continuation).

**Iteration 3 (2026-09-09)** — all 16 items pass. Q1–Q3 answered by the user and folded in:

| Q | Answer | Spec changes |
|---|--------|--------------|
| Q1 | Email address, **string-form validation only** | New FR-003 (well-formedness checked; no mailbox, domain, or deliverability lookup; no outbound mail dependency). Old FR-003 became FR-004 (normalisation), shifting FR-004…FR-026 to FR-005…FR-027. Added US1 scenarios 5 and 6. |
| Q2 | No verification before first login | FR-001 now states the account is usable immediately and that no confirmation step may be required. Recorded as a confirmed assumption with its trade-off (addresses are unproven). |
| Q3 | No refresh; log in again | FR-018 now forbids renewing or extending a credential without a fresh password check. **Session Credential** entity marked non-renewable. |

### Trade-offs accepted by these answers

Recorded in the spec's **Assumptions** section, and worth re-reading at plan time:

- **No credential revocation and no server-side logout.** Q3 means an issued credential stays
  valid until it expires. Signing out can only discard it client-side; a copy taken beforehand
  keeps working. This makes the credential's validity period the only lever limiting the damage
  from a leak — hence the proposed 1-hour default, which the plan should confirm.
- **Unverified addresses.** Q1 + Q2 mean a registered address is never proven reachable. Any
  later feature that emails an account holder must not assume it is, and junk accounts may
  accumulate.

Neither blocks this feature. Both are inputs to whichever feature adds password reset, since that
flow depends on a reachable address.
