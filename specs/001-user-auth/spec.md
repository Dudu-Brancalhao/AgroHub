# Feature Specification: User Authentication (Registration & Login)

**Feature Branch**: `001-user-auth`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Perfect chat let's start with authentication feature. As a user's system we need to have authentication, so system needs to have feature to login/register with all security needed. Functional requirements: System should allow login; System should validates both login/register fields, rejecting bad inputs; System should allow register new users with login/password fields; System needs to care about rate limiting login endpoints. Let's focus on backend first, frontend I'll do later."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a New Account (Priority: P1)

A new person wants to start using AgroHub. They provide an email address and a password of their
choosing. The system checks that both values meet the required rules, confirms the address is not
already taken, and creates their account. From that moment on, the account exists and can be used
to sign in immediately — there is no confirmation step to wait for.

**Why this priority**: Nothing else in this feature can be exercised until accounts can exist.
Registration is the entry point to the entire product, and on its own it already delivers value:
the business can start collecting real accounts.

**Independent Test**: Submit a registration request with valid values and confirm an account is
created; submit a second one with the same identifier and confirm it is rejected. No other part
of the feature needs to exist for this to be testable.

**Acceptance Scenarios**:

1. **Given** no account exists for the identifier `novo@agrohub.com.br`, **When** a registration
   request is submitted with that identifier and a password meeting the password rules, **Then**
   the account is created and the response confirms success without ever echoing the password.
2. **Given** an account already exists for the identifier `novo@agrohub.com.br`, **When** a second
   registration request is submitted with the same identifier, **Then** the request is rejected
   and no second account is created.
3. **Given** a registration request whose password is shorter than the minimum length, **When**
   it is submitted, **Then** the request is rejected with a message naming the failing rule, and
   no account is created.
4. **Given** a registration request containing extra fields the system does not recognise (for
   example an attempt to set a role or an account status), **When** it is submitted, **Then**
   those fields are ignored or the request is rejected — they MUST NOT be persisted.
5. **Given** a registration request whose identifier is not a well-formed email address (for
   example `joao@`, `joao agrohub.com.br`, or `joao@@agrohub`), **When** it is submitted, **Then**
   the request is rejected as invalid input and no account is created.
6. **Given** a registration request whose identifier is well-formed but whose mailbox does not
   actually exist, **When** it is submitted, **Then** the account is created and is immediately
   usable — the system does not attempt to contact the address or confirm it is reachable.

---

### User Story 2 - Log In with Existing Credentials (Priority: P2)

A registered person returns to AgroHub and wants access. They supply their identifier and
password. If both match a stored account, the system issues a credential proving who they are.
If either is wrong, they are turned away with a message that does not reveal which of the two
was wrong.

**Why this priority**: This is the headline capability of the feature, but it is only meaningful
once accounts exist (P1). It can be tested independently by seeding an account directly.

**Independent Test**: With one seeded account, submit correct credentials and confirm a usable
credential is returned; submit a wrong password and confirm rejection with a generic message.

**Acceptance Scenarios**:

1. **Given** a registered account with a known password, **When** a login request is submitted
   with the correct identifier and password, **Then** the system issues a session credential and
   returns it together with the account's non-sensitive details.
2. **Given** a registered account, **When** a login request is submitted with the correct
   identifier but a wrong password, **Then** the request is rejected with a generic failure
   message that does not state whether the identifier exists.
3. **Given** no account exists for the submitted identifier, **When** a login request is
   submitted, **Then** the request is rejected with the *same* generic failure message and in a
   comparable amount of time as scenario 2, so that the response cannot be used to discover which
   identifiers are registered.
4. **Given** a login request that omits the password entirely, **When** it is submitted, **Then**
   it is rejected before any account lookup occurs, with the *same* generic failure response used
   for wrong credentials and with no field-level detail — so a caller cannot tell a malformed
   request from a failed credential check. The reason is recorded in the log instead.

---

### User Story 3 - Use the Issued Credential to Reach Protected Operations (Priority: P3)

Having logged in, a person calls an operation that requires them to be signed in. The system
recognises the credential they present, identifies who they are, and lets the operation proceed.
Anyone presenting no credential, an expired one, or a tampered one is refused.

**Why this priority**: Issuing a credential is worthless unless something honours it. This slice
proves the credential is real, and establishes the protection mechanism every future feature will
reuse. It is lower priority only because it depends on P2.

**Independent Test**: Call a protected probe operation three ways — with a valid credential, with
no credential, and with a tampered credential — and confirm allow / refuse / refuse.

**Acceptance Scenarios**:

1. **Given** a valid, unexpired credential from a successful login, **When** a protected
   operation is called with it, **Then** the operation proceeds and the system knows which
   account made the call.
2. **Given** no credential at all, **When** a protected operation is called, **Then** it is
   refused as unauthenticated.
3. **Given** a credential whose contents have been altered, or one issued past its validity
   window, **When** a protected operation is called with it, **Then** it is refused as
   unauthenticated.
4. **Given** a person who is signed in, **When** they request their own account details, **Then**
   they receive their identifier and account metadata and never their stored password material.

---

### User Story 4 - Resist Brute-Force Attacks on Login (Priority: P4)

Someone repeatedly guesses passwords against the login operation. After a small number of failed
attempts, the system stops answering them for a cooling-off period, so guessing a password
becomes impractically slow. A legitimate person who mistypes a couple of times is not affected.

**Why this priority**: This hardens an operation that must already exist (P2). The feature is
demonstrable without it, but it MUST ship before the system is exposed publicly.

**Independent Test**: Fire failed login attempts in a loop against one identifier and confirm
that responses switch to "too many attempts" at the defined threshold, and that they succeed
again after the window elapses.

**Acceptance Scenarios**:

1. **Given** a login operation and a single identifier, **When** the number of consecutive failed
   attempts reaches the configured threshold within the configured window, **Then** further
   attempts for that identifier are refused as rate-limited, without revealing whether the
   password was correct.
2. **Given** an identifier that is currently rate-limited, **When** the cooling-off window
   elapses, **Then** login attempts are accepted again and a correct password succeeds.
3. **Given** a single network origin firing attempts across many different identifiers, **When**
   the per-origin request threshold is exceeded, **Then** further attempts from that origin are
   refused, so the per-identifier limit cannot be sidestepped by rotating identifiers.
4. **Given** a person who fails once and then enters the correct password, **When** they log in,
   **Then** they are not rate-limited and their failure count is cleared.

---

### Edge Cases

- **Identifier casing and padding**: `Joao@agrohub.com.br` and ` joao@agrohub.com.br ` must not
  create an account that collides with, or shadows, `joao@agrohub.com.br`.
- **Simultaneous duplicate registration**: two registration requests for the same identifier
  arriving at the same instant must result in exactly one account, not two.
- **Very long password**: a password beyond the accepted maximum length is rejected as invalid
  input rather than being silently truncated to a shorter, weaker value.
- **Unicode and whitespace-only values**: a password of only spaces, or an identifier of only
  whitespace, is rejected as invalid input.
- **Wrong payload shape**: a request whose body is missing, malformed, or not the expected shape
  is rejected as invalid input, never treated as empty credentials.
- **Credential presented after account removal**: a credential issued before an account was
  disabled or deleted must stop granting access.
- **Clock boundary**: a credential presented in the same instant it expires is treated as
  expired, not valid.
- **Rate-limit counter and restarts**: attempt counters behave correctly across service restarts
  and across more than one running instance — a limit must not be resettable by chance of
  routing.
- **Empty-state login**: a login attempt made when no accounts exist at all returns the same
  generic failure, not a distinguishable error.

## Requirements *(mandatory)*

### Functional Requirements

**Registration**

- **FR-001**: System MUST allow an unauthenticated visitor to register a new account by supplying
  an email address and a password. The resulting account MUST be usable for login immediately;
  the system MUST NOT require any confirmation or verification step before first login.
- **FR-002**: System MUST reject registration when the email address is already in use by an
  existing account, and MUST guarantee that at most one account exists per address even under
  concurrent requests.
- **FR-003**: System MUST validate that the submitted identifier is a well-formed email address,
  checking its *string form only*. The system MUST NOT attempt to confirm that the mailbox exists
  or is reachable — no message is sent, no domain lookup is performed, and registration MUST NOT
  depend on any outbound mail service.
- **FR-004**: System MUST normalise the email address before storing and comparing it, so that
  differences in letter casing and surrounding whitespace do not produce duplicate accounts.
- **FR-005**: System MUST enforce a password policy at registration: a minimum length of 8
  characters, a maximum accepted length, and at least one letter and one digit. Passwords failing
  the policy MUST be rejected with a message naming the unmet rule.
- **FR-006**: System MUST ignore or reject any field in a registration request that is not part
  of the declared contract; a client MUST NOT be able to set privileged attributes (such as role
  or account status) by including them in the payload.
- **FR-007**: System MUST NOT return the password, or any stored password material, in any
  registration response.

**Login**

- **FR-008**: System MUST allow a registered account holder to log in by supplying their
  identifier and password, and MUST issue a session credential when both match.
- **FR-009**: System MUST reject a login attempt where the identifier is unknown or the password
  does not match, using a single generic failure message that is identical in both cases.
- **FR-010**: System MUST take a comparable amount of time to reject an unknown identifier as it
  takes to reject a wrong password, so that response timing does not reveal which identifiers are
  registered.
- **FR-011**: System MUST return, alongside the issued credential, the account's non-sensitive
  details and the credential's validity period.

**Input Validation**

- **FR-012**: System MUST validate every field of both the registration and the login request
  against a declared contract before any account lookup or account creation occurs.
- **FR-013**: System MUST reject invalid input with a response that names every failing field at
  once, rather than surfacing them one at a time.
- **FR-013a**: The login operation is the exception to FR-013. It MUST reject malformed input with
  the *same* generic response it returns for wrong credentials, carrying no field-level detail, so
  a caller cannot distinguish a malformed request from a failed credential check. The field-level
  reason MUST still be recorded in the log against the same request identifier.
- **FR-014**: System MUST reject a request whose body is absent, malformed, or of an unexpected
  shape as invalid input, and MUST NOT interpret it as empty credentials.

**Credential Handling & Protected Access**

- **FR-015**: System MUST store passwords only in an irreversible, individually salted form. A
  plain-text or reversibly encrypted password MUST NEVER be written to storage.
- **FR-016**: System MUST refuse any protected operation called without a credential, with an
  expired credential, or with a credential whose contents have been altered.
- **FR-017**: System MUST identify the calling account from a valid credential, so protected
  operations can act on behalf of that account.
- **FR-018**: System MUST expire an issued credential after a fixed validity period and MUST
  reject it thereafter. Once it expires, the account holder MUST log in again with their email
  and password to obtain a new one; the system MUST NOT offer any means of renewing, refreshing,
  or extending a credential without a fresh password check.
- **FR-019**: System MUST provide an operation that returns the currently authenticated account's
  own non-sensitive details.

**Rate Limiting**

- **FR-020**: System MUST limit failed login attempts per identifier to 5 within a rolling
  15-minute window; beyond that, further attempts for that identifier MUST be refused as
  rate-limited until the window elapses.
- **FR-021**: System MUST additionally limit requests to the authentication operations per
  network origin to 20 per minute, so the per-identifier limit cannot be bypassed by rotating
  identifiers.
- **FR-021a**: System MUST apply a stricter limit of 5 requests per minute per network origin to
  the registration operation specifically. Registration answers differently for an address that
  already exists (FR-002), which makes it an account-existence oracle costing one request per
  address; the tighter limit raises the cost of farming it. This MUST NOT be relaxed to match
  FR-021 without accepting that trade-off explicitly.
- **FR-022**: System MUST clear an identifier's failed-attempt count upon a successful login.
- **FR-023**: A rate-limited response MUST NOT reveal whether the submitted credentials were
  correct, and MUST tell the caller when they may retry.
- **FR-024**: Rate-limit counters MUST be shared across all running instances of the service, so
  a limit cannot be evaded through which instance happens to serve the request.

**Security & Observability**

- **FR-025**: System MUST NEVER write a password, a stored password hash, or an issued credential
  to any log, error message, or diagnostic output.
- **FR-026**: System MUST record a structured log entry for each registration, each successful
  login, each failed login, and each rate-limit refusal, carrying at minimum the outcome, the
  time, and enough context to investigate, and excluding the values named in FR-025.
- **FR-027**: All authentication operations MUST be described in the published API documentation,
  including their request shapes, their success responses, and every failure case above.

### Key Entities *(include if feature involves data)*

- **User Account**: A person who can sign in. Holds a unique normalised email address, an
  irreversible password representation, a creation timestamp, and a last-update timestamp. The
  password representation is never readable and never leaves the system. The email address serves
  purely as the login identifier — this feature never sends anything to it.
- **Session Credential**: Proof of a successful login, issued to the account holder and presented
  on later requests. Carries the account it belongs to and an expiry moment. It is self-describing
  — the system can verify it without the holder proving themselves again — and it is
  non-renewable: when it expires, only a fresh login produces another.
- **Login Attempt Counter**: The running record of recent failed attempts, keyed by identifier and
  by network origin, used to decide whether an attempt is refused as rate-limited. Short-lived by
  nature; it expires on its own once the window passes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new person can go from no account to signed in, unaided, in under 60 seconds.
- **SC-002**: 100% of registration and login requests carrying invalid input are rejected before
  any account is created or any password comparison is performed.
- **SC-003**: An attacker guessing passwords against one identifier is held to at most 5 attempts
  per 15 minutes — under 500 attempts per day, versus millions if unthrottled.
- **SC-004**: An attacker cannot determine whether a given identifier is registered: failed login
  responses are indistinguishable in both wording and timing, verified across at least 100
  paired attempts.
- **SC-005**: Zero passwords, password hashes, or issued credentials appear in logs or error
  output, verified by scanning a full run of the automated test suite.
- **SC-006**: 100% of operations that change data refuse to run without a valid credential.
- **SC-007**: Under a load of 200 concurrent login attempts, 95% of responses return within one
  second and no attempt is wrongly accepted or wrongly refused.
- **SC-008**: A newcomer can register and log in using only the published API documentation,
  without reading source code.

## Assumptions

- **Backend only for this feature.** The user interface is explicitly deferred; this specification
  covers only the server-side capability and the contract it publishes. Any acceptance scenario
  written above is satisfied by exercising that contract directly.
- **Password policy defaults.** The description said "all security needed" without naming rules.
  A minimum of 8 characters with at least one letter and one digit, plus an enforced maximum
  length, is applied as an industry-standard baseline. No forced character-class beyond that and
  no forced rotation, in line with current guidance that both reduce real-world password quality.
- **Rate-limit thresholds.** 5 failed attempts per identifier per 15 minutes, and 20 requests per
  minute per network origin, are chosen as common defaults. They are configurable rather than
  fixed in code, so they can be tuned without a code change.
- **Credential validity period.** A fixed expiry is assumed rather than an idle timeout, as it is
  simpler to reason about and to test. Because there is no refresh mechanism (see below), the
  period must be long enough to avoid nagging re-logins yet short enough that a leaked credential
  expires on its own — it is configurable, and a working default of 1 hour is proposed for the
  plan to confirm.
- **Email address as identifier, validated as a string only (confirmed).** The login identifier
  is an email address. It is checked for well-formedness only; the system never sends mail, never
  performs a domain or mailbox lookup, and never depends on an outbound mail service. This keeps
  the feature free of any external delivery dependency, consistent with the constitution's rule
  that tests must not rely on external real state.
- **No verification before first login (confirmed).** A registered account is usable immediately.
  The accepted trade-off is that addresses are unproven, so any later feature that emails an
  account holder must not assume the address is reachable, and unverified accounts may accumulate.
- **No refresh mechanism (confirmed).** When a credential expires the holder re-enters their
  email and password. The accepted trade-offs: there is no way to revoke an issued credential
  before its expiry, and there is no server-side logout — signing out can only discard the
  credential on the client's side, and a copy taken before that remains valid until it expires.
  Revocation is deferred to a later feature.
- **Single role for now.** Every account created by this feature has the same level of access.
  Roles, permissions, and administrative accounts are a later feature; FR-006 exists so that
  adding them later cannot be subverted by today's registration contract.
- **No account recovery in this feature.** Forgotten-password and password-change flows are
  separate features that depend on this one.
- **Shared counter storage.** FR-024 assumes the service may run as more than one instance, so
  attempt counters live outside any single instance's memory.
- **Testing uses fixture data only.** Per the project constitution, all tests for this feature run
  against mock or fixture data and never against a live external service or shared database.

## Out of Scope

The following are deliberately excluded from this feature and, where valuable, will be specified
separately:

- Any frontend, screen, or form — explicitly deferred by the user.
- Password reset, forgotten-password, and password-change flows.
- Refresh tokens, "remember me", server-side logout, and revoking a credential before it expires.
- Email or phone verification of a newly registered address, and any outbound mail whatsoever.
- Checking that a registered address is deliverable, or that its domain exists.
- Eliminating the account-existence oracle at registration. FR-021a raises its cost but does not
  remove it; removing it entirely requires either outbound mail (excluded above) or a CAPTCHA.
- Social or single sign-on providers, and multi-factor authentication.
- Roles, permissions, and administrative user management.
- Account deletion, deactivation, and profile editing.
- CAPTCHA and bot-detection challenges on the authentication operations.
