# Feature Specification: Rural Producer Registry (CRUD)

**Feature Branch**: `002-rural-producer-crud`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Perfect chat, now let's move with next feature, which is CRUD of rural producers. As a system user, I want create, edit and exclude rural producers and their properties in order to maintain a reliable record of who produces what and where. Functional requirements: System should allow CRUD of rural producers; System should validate CPF or CNPJ inputed, rejecting invalid documents; System must prevent registration where (arable area + vegetation area) exceeds total farm area; A producer could have 0, 1 or more associated rural properties; A property could have 0, 1 or more crops planted per season; System should allow multiple crops per property/season (e.g., Soybeans in the 2021 season, Corn in the 2021 season). Key Entities: Producer: Identified by CPF/CNPJ, Name; Property: Farm name, city, state, total area, arable area, vegetaion area, Belongs to a producer; Harvest: harvest year/identifier, Associated with a property; Crop: planted crop (soybeans, corn, coffee...), associated with a property-harvest combination. Do not allow CPF/CNPJ duplicated."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a Rural Producer (Priority: P1)

A signed-in user records a new producer by supplying their document (CPF for an individual, CNPJ
for a company) and their name. The system confirms the document is genuinely valid — not merely
the right length — and that nobody has registered it already, then creates the producer. From that
moment the producer exists and can have properties attached.

**Why this priority**: Nothing else in the registry can exist until producers do. On its own it
already delivers value: the business can start building the list of who it works with.

**Independent Test**: Submit a producer with a valid, unused document and confirm it is created;
submit the same document again and confirm rejection. Nothing else in this feature needs to exist.

**Acceptance Scenarios**:

1. **Given** no producer exists with CPF `529.982.247-25`, **When** a user registers a producer
   with that document and a name, **Then** the producer is created and returned with its stored
   identifier.
2. **Given** a producer already exists with that document, **When** a user submits it again — in
   any formatting, punctuated or not — **Then** the request is rejected and no second producer is
   created.
3. **Given** a document that is the right length but whose check digits do not compute (for
   example `111.111.111-11` or `123.456.789-00`), **When** it is submitted, **Then** the request
   is rejected as an invalid document and no producer is created.
4. **Given** a valid CNPJ such as `11.222.333/0001-81`, **When** it is submitted, **Then** the
   producer is created — both document types are accepted.
5. **Given** a request with a blank name or no document, **When** it is submitted, **Then** it is
   rejected as invalid input naming every failing field at once, and nothing is created.

---

### User Story 2 - Record a Producer's Rural Properties (Priority: P2)

A user attaches a farm to an existing producer: its name, the city and state it sits in, and its
total, arable and vegetation areas. The system refuses any farm whose arable and vegetation areas
together exceed the total — an impossible farm. A producer may have no properties at all, one, or
many.

**Why this priority**: The registry answers "who produces *where*", which needs properties. It
depends on P1 for a producer to attach to, but is independently testable by seeding one.

**Independent Test**: With one seeded producer, add a property with consistent areas and confirm
it is created; add one where arable + vegetation exceeds total and confirm rejection.

**Acceptance Scenarios**:

1. **Given** an existing producer, **When** a user adds a property with total 100 ha, arable 60 ha
   and vegetation 30 ha, **Then** the property is created and linked to that producer.
2. **Given** an existing producer, **When** a user adds a property with total 100 ha, arable 70 ha
   and vegetation 40 ha, **Then** the request is rejected because the parts exceed the whole, and
   no property is created.
3. **Given** an existing producer, **When** a user adds a property with total 100 ha, arable 60 ha
   and vegetation 40 ha, **Then** the property is created — the rule forbids *exceeding* the
   total, so using exactly all of it is allowed.
4. **Given** a property submitted with a negative area, or an area that is not a number, **When**
   it is submitted, **Then** it is rejected as invalid input.
5. **Given** a producer with no properties, **When** the producer is retrieved, **Then** the
   producer is returned successfully with an empty list of properties — having none is valid.
6. **Given** a request naming a producer that does not exist, **When** a property is submitted for
   it, **Then** the request is rejected and no orphan property is created.
7. **Given** a state code that is not one of Brazil's 27 federative units, **When** a property is
   submitted with it, **Then** the request is rejected as invalid input.

---

### User Story 3 - Record What Was Planted, and When (Priority: P3)

A user records a harvest season for a property — say 2021 — and then the crops planted in it.
More than one crop may be recorded for the same property in the same season: soybeans *and* corn
in 2021. A property may have no harvests recorded, and a harvest may have no crops yet.

**Why this priority**: This is the "produces *what*" half of the registry. It depends on a
property existing, and is testable by seeding one.

**Independent Test**: With one seeded property, record a 2021 harvest, add soybeans and corn to
it, and confirm both are stored against that property and season.

**Acceptance Scenarios**:

1. **Given** an existing property, **When** a user records a harvest for the year 2021, **Then**
   the harvest is created and linked to that property.
2. **Given** a property with a 2021 harvest, **When** a user adds soybeans and then corn to that
   harvest, **Then** both crops are recorded for that property-and-season, and neither replaces
   the other.
3. **Given** a property with a 2021 harvest, **When** a user records a second harvest for 2022,
   **Then** both harvests exist independently and their crops do not mix.
4. **Given** a property with no harvests, **When** the property is retrieved, **Then** it is
   returned successfully with an empty list of harvests.
5. **Given** a harvest year that is implausible — before 1900 or more than one year in the future
   — **When** it is submitted, **Then** the request is rejected as invalid input.
6. **Given** a request naming a harvest that does not exist, **When** a crop is submitted for it,
   **Then** the request is rejected and no orphan crop is created.

---

### User Story 4 - Browse and Retrieve the Registry (Priority: P4)

A user lists the producers on record, pages through them, searches by name or document, and opens
a single producer to see their properties, harvests and crops together.

**Why this priority**: A registry nobody can read has no value, but it can only be demonstrated
once records exist. Independently testable against seeded data.

**Independent Test**: Seed several producers, list them, confirm paging works and a search by name
returns the expected subset.

**Acceptance Scenarios**:

1. **Given** several producers on record, **When** a user lists producers, **Then** they receive a
   page of results together with the total count, so they know how many exist beyond the page.
2. **Given** more producers than fit on one page, **When** a user requests the next page, **Then**
   they receive the following results with no duplicates and none skipped.
3. **Given** producers with varied names, **When** a user searches by part of a name, **Then**
   only matching producers are returned, regardless of letter casing or accents.
4. **Given** a producer with properties, harvests and crops, **When** the user opens that producer,
   **Then** they see the full picture in one response.
5. **Given** an identifier that matches no producer, **When** the user requests it, **Then** they
   receive a clear "not found" answer rather than an empty success.

---

### User Story 5 - Correct and Remove Records (Priority: P5)

A user fixes a mistyped name, corrects a farm's areas, or removes a record that should never have
existed. Corrections are held to the same rules as creation: a corrected document must still be
valid and unused, and corrected areas must still add up.

**Why this priority**: Completes the CRUD. It depends on records existing, and is the most
destructive part of the feature, so it lands last and deliberately.

**Independent Test**: Seed a producer and property, rename the producer, then attempt an update
that breaks the area rule and confirm it is refused and nothing changed.

**Acceptance Scenarios**:

1. **Given** an existing producer, **When** a user changes their name, **Then** the change is
   saved and the document is untouched.
2. **Given** two producers, **When** a user edits the first so its document matches the second's,
   **Then** the request is rejected — uniqueness holds on update exactly as on creation.
3. **Given** a property with total 100 ha, arable 60 ha and vegetation 30 ha, **When** a user
   lowers the total to 80 ha, **Then** the request is rejected, because the stored parts would
   then exceed the new whole. A partial update MUST be validated against the record as it would
   be *after* the change, not against the submitted fields alone.
4. **Given** an existing property, **When** a user deletes it, **Then** it no longer appears in
   the registry and its producer remains.
5. **Given** a producer with three properties, their harvests and crops, **When** a user deletes
   the producer, **Then** the producer and every one of those descendants are removed together,
   the response reports how many of each were removed, and the registry is never left holding a
   property with no producer.
6. **Given** a cascading delete that fails part-way through, **When** the failure occurs, **Then**
   nothing is deleted at all and the registry is exactly as it was before the attempt.
7. **Given** an update or delete for an identifier that matches nothing, **When** it is submitted,
   **Then** it is rejected as "not found" and nothing else is altered.

---

### Edge Cases

- **Document formatting**: `529.982.247-25`, `52998224725`, and ` 529.982.247-25 ` all describe the
  same person and must not produce three producers.
- **Repeated-digit documents**: `111.111.111-11` and `000.000.000-00` satisfy a naive checksum in
  some implementations. They are not valid documents and must be rejected.
- **Wrong length**: a 10- or 12-digit number is neither a CPF nor a CNPJ and must be rejected
  rather than padded or guessed.
- **Areas that exactly consume the total**: allowed. The rule is "must not exceed", not "must
  leave room".
- **Zero areas**: a farm with zero arable and zero vegetation area is valid — it is unused land.
- **Total area of zero**: rejected; a farm with no area is not a farm.
- **Decimal areas**: 100.5 ha must be storable and must not be silently rounded into a value that
  changes whether the area rule passes.
- **Floating-point drift**: 33.33 + 66.67 must be treated as exactly 100.00 against a 100 ha total,
  not as 100.00000000000001 and therefore a rejection.
- **Empty children**: a producer with no properties, and a property with no harvests, are both
  valid states and must not be treated as errors.
- **Same crop twice in a season**: recording soybeans twice for the same property and year is
  almost certainly a double-submission, not two plantings.
- **Lowering a total area** so stored parts no longer fit — see US5 §3.
- **Changing a document** to one already in use — see US5 §2.
- **Concurrent creation** of the same document by two simultaneous requests must yield exactly one
  producer.
- **Accented and long names**: "José Antônio de Almeida Júnior" must be storable and searchable,
  and a search for "jose" must find it.
- **Deleting a producer twice**: the second attempt reports "not found" rather than failing
  obscurely.
- **Cascade reaching deep**: deleting a producer with 3 properties x 10 harvests x 4 crops removes
  123 records in one call. It must remove all of them or none.
- **Crop name casing**: adding "Soja" to a harvest that already holds "soja" is the same crop and
  must be refused; adding "Soya" is a different string and is accepted, which is the known cost of
  free-text naming.
- **Crop name with inner spacing**: "Milho  safrinha" and "Milho safrinha" must be treated as the
  same crop.

## Requirements *(mandatory)*

### Functional Requirements

**Access Control**

- **FR-001**: Every operation in this feature MUST require an authenticated caller. Unauthenticated
  requests MUST be refused, consistent with the protection established in feature `001-user-auth`.
- **FR-002**: The registry is **shared**: any authenticated caller MAY read, change and delete any
  producer, property, harvest or crop. Records MUST NOT be scoped to the user who created them, and
  no role or permission distinction exists in this feature.

**Producer Registration**

- **FR-003**: System MUST allow an authenticated user to create, retrieve, update and delete
  producers.
- **FR-004**: A producer MUST carry a document (CPF or CNPJ) and a name. Both are required.
- **FR-005**: System MUST validate the submitted document by computing its check digits, accepting
  a CPF of 11 digits or a CNPJ of 14 digits and rejecting anything else. Length alone MUST NOT be
  treated as validity.
- **FR-006**: System MUST reject documents consisting of a single repeated digit (such as
  `111.111.111-11`), which pass a naive check-digit calculation but are not issuable.
- **FR-007**: System MUST normalise the document to digits only before storing or comparing it, so
  that punctuation and surrounding whitespace cannot produce duplicate producers.
- **FR-008**: System MUST reject a producer whose document is already registered, and MUST
  guarantee at most one producer per document even under concurrent requests.
- **FR-009**: System MUST trim and collapse whitespace in the producer name, and MUST reject a name
  that is empty once trimmed.

**Properties**

- **FR-010**: System MUST allow an authenticated user to create, retrieve, update and delete
  properties, each belonging to exactly one existing producer.
- **FR-011**: A producer MUST be able to have zero, one, or many properties. Having none MUST NOT
  be an error at any point.
- **FR-012**: A property MUST carry a farm name, a city, a state, a total area, an arable area and
  a vegetation area.
- **FR-013**: System MUST reject any property where arable area + vegetation area **exceeds** total
  area. Equality MUST be accepted.
- **FR-014**: System MUST apply FR-013 on every create *and* every update, evaluating the record as
  it would stand after the change — including when only the total area is submitted.
- **FR-015**: System MUST reject negative areas and a total area of zero. Zero arable and zero
  vegetation areas MUST be accepted.
- **FR-016**: System MUST store areas with a fixed decimal precision and MUST compare them exactly,
  so that a comparison never fails or passes because of binary floating-point drift.
- **FR-017**: System MUST reject a state that is not one of Brazil's 27 federative units.
- **FR-018**: System MUST reject a property whose named producer does not exist, so an orphan
  property can never be created.

**Harvests and Crops**

- **FR-019**: System MUST allow an authenticated user to record, retrieve, update and delete
  harvests, each belonging to exactly one existing property.
- **FR-020**: A property MUST be able to have zero, one, or many harvests, and a harvest zero, one,
  or many crops.
- **FR-021**: System MUST allow more than one crop to be recorded for the same property and the
  same harvest — for example soybeans and corn both in 2021. Recording a second crop MUST NOT
  replace the first.
- **FR-022**: System MUST reject a harvest year earlier than 1900 or more than one year beyond the
  current year.
- **FR-023**: System MUST reject a harvest whose named property does not exist, and a crop whose
  named harvest does not exist.
- **FR-024**: A crop name is free text supplied by the caller. System MUST trim it, collapse inner
  whitespace, and reject it if empty once trimmed. System MUST preserve the caller's capitalisation
  for display while comparing names case-insensitively and accent-insensitively.
- **FR-025**: System MUST reject recording the same crop twice within one harvest, comparing names
  under the normalisation in FR-024 — so "Soja", "soja" and "SOJA" count as the same crop, while
  "Soja" and "Soya" remain distinct.

**Retrieval**

- **FR-026**: System MUST allow listing producers with paging, returning both the page of results
  and the total number of matching records.
- **FR-027**: System MUST allow searching producers by partial name and by document, matching names
  regardless of letter casing or accents.
- **FR-028**: System MUST allow retrieving a single producer together with their properties,
  harvests and crops.
- **FR-029**: System MUST answer a request for a non-existent record with a clear "not found"
  result, distinct from an empty success.

**Deletion**

- **FR-030**: Deleting a producer MUST also delete its properties, their harvests and those
  harvests' crops. Deletion MUST NOT be refused because descendants exist.
- **FR-031**: Deleting a property MUST delete its harvests and their crops; deleting a harvest MUST
  delete its crops.
- **FR-032**: A cascading delete MUST be all-or-nothing. If any part of it fails, the whole
  deletion MUST be abandoned and the registry left exactly as it was — a partially applied cascade
  is precisely how the orphans FR-033 forbids get created.
- **FR-033**: The registry MUST NEVER be left holding a property without a producer, a harvest
  without a property, or a crop without a harvest.
- **FR-034**: A delete MUST report what it removed — how many properties, harvests and crops went
  with the producer — so the caller learns the blast radius of what they just did.

**Validation, Security and Observability**

- **FR-035**: System MUST validate every field of every request against a declared contract before
  any record is read or written, rejecting invalid input with a response that names every failing
  field at once.
- **FR-036**: System MUST reject any field in a request that is not part of the declared contract,
  so a client cannot set attributes the contract does not offer.
- **FR-037**: System MUST record a structured log entry for each producer, property, harvest and
  crop that is created, updated or deleted, carrying the outcome, the acting user, the affected
  record and the time.
- **FR-038**: Documents (CPF/CNPJ) are personal data and MUST NOT appear in logs in full; a log
  MUST reference the producer by its internal identifier instead.
- **FR-039**: All operations MUST be described in the published API documentation, including
  request shapes, success responses and every failure case above.

### Key Entities *(include if feature involves data)*

- **Producer**: A person or company that farms. Holds a unique normalised document (CPF or CNPJ), a
  name, and creation/update timestamps. Owns zero or more Properties.
- **Property**: A farm belonging to exactly one Producer. Holds a farm name, city, state, total
  area, arable area and vegetation area, where arable + vegetation never exceeds total. Has zero or
  more Harvests.
- **Harvest**: A season recorded against exactly one Property, identified by its year. Two
  properties each having a "2021" harvest are two separate records — a harvest is never shared.
  Has zero or more Crops.
- **Crop**: A single planted crop recorded against exactly one Harvest, and therefore against one
  property-and-season combination. A harvest holding both soybeans and corn is two Crop records.

The chain is strictly hierarchical: **Producer → Property → Harvest → Crop**, each child belonging
to exactly one parent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can register a producer with one property and one crop, unaided, in under
  three minutes.
- **SC-002**: 100% of documents that fail check-digit validation are rejected, verified against a
  fixture set containing valid CPFs, valid CNPJs, repeated-digit documents, wrong-length numbers
  and transposed digits.
- **SC-003**: Zero properties exist in the registry where arable + vegetation exceeds total,
  verified after a run that includes attempts to breach the rule through both creation and partial
  update.
- **SC-004**: Zero duplicate documents exist, verified under a burst of concurrent registrations of
  the same document.
- **SC-005**: Zero orphan records exist — no property without a producer, no harvest without a
  property, no crop without a harvest — verified after a run that includes deletions.
- **SC-006**: A cascading delete is all-or-nothing in 100% of runs, verified by forcing a failure
  part-way through a delete of a producer with descendants and confirming every record survives.
- **SC-007**: A list of 10,000 producers returns its first page within one second.
- **SC-008**: 100% of operations that change data refuse to run without authentication.
- **SC-009**: No document appears in full in any log, verified by scanning a full run of the
  automated test suite.
- **SC-010**: A newcomer can register a producer, a property and a crop using only the published
  API documentation, without reading source code.

## Assumptions

- **Builds on `001-user-auth`.** Authentication already exists and protects every route by default.
  This feature adds no new authentication mechanism; it consumes the one already built.
- **Brazilian context.** CPF and CNPJ are Brazilian documents and the state field is a Brazilian
  federative unit. No other country's documents or subdivisions are in scope.
- **Areas are in hectares**, stored with two decimal places. The unit is not user-selectable; the
  description gives no other unit and mixing units silently would corrupt the area rule.
- **Document is editable.** A mistyped CPF must be correctable, so the document may change on
  update — subject to the same validity and uniqueness rules as on creation. It is not treated as
  an immutable identity.
- **The area rule concerns only arable and vegetation.** Any remaining area (total minus the two)
  is simply unclassified land, not an error and not a third tracked field.
- **Harvest belongs to a property**, following the description literally. A "2021" harvest is
  recorded per property rather than as one shared season that properties join. This matters: with
  ten properties, ten harvest records exist for 2021.
- **Cities are free text.** Validating city names against an official municipality list would need
  a reference dataset that is out of scope; the state code is validated, the city is not.
- **No producer or property is shared between users** in the sense of co-ownership. A property has
  exactly one producer.
- **Shared registry, no roles (confirmed).** Any authenticated user may read, change and delete
  any record. Records are not scoped to their creator and no role distinction exists.

  The accepted consequence, recorded so it is a decision rather than a surprise: `001-user-auth`
  allows anyone to self-register an account with no verification, so under a shared registry any
  member of the public who registers can edit or delete the entire registry, and a delete now
  cascades (below). Nothing in either feature prevents this. Closing self-registration, or adding
  roles, is the mitigation whenever this is exposed beyond a trusted network — both are out of
  scope here.
- **Deleting cascades (confirmed).** Removing a producer removes its properties, harvests and
  crops in one operation. Accepted trade-off: a single call can erase years of history and there
  is no undo, since neither soft delete nor an audit trail is in scope. FR-032 (all-or-nothing)
  and FR-034 (report what was removed) exist to bound that: the registry can never be left
  half-deleted, and the caller is told the blast radius.
- **Crop names are free text (confirmed).** Trimmed, inner whitespace collapsed, compared
  case- and accent-insensitively for duplicate detection, but stored as the caller typed them.
  Accepted trade-off: "Soja" and "Soya" remain two distinct crops, so any later report that counts
  hectares by crop will need reconciliation. Deferring that is deliberate.
- **Testing uses fixture data only**, per the project constitution — including a fixture set of
  known-valid and known-invalid CPFs and CNPJs, and no calls to any external document-validation
  service.

## Out of Scope

Deliberately excluded, to be specified separately where valuable:

- Any frontend, screen or form. This feature covers the backend capability only, consistent with
  the previous feature.
- Roles and permissions. Every authenticated user has identical, unrestricted access to the whole
  registry (FR-002). An administrator tier, per-user scoping, or read-only users are all later
  features.
- Dashboards, totals, and charts over the registry (farms by state, land use, crops by area). The
  data recorded here is what such a feature would later read.
- Importing producers in bulk from a spreadsheet or an external system.
- Validating that a document actually exists at the issuing authority. Only its internal check
  digits are verified — no outbound call to any government service.
- Validating city names against an official municipality list.
- Geographic coordinates, maps, plot boundaries, and area measurement from satellite data.
- Attachments: land titles, photographs, certificates.
- Audit history showing who changed what over time. Changes are logged (FR-037), but no
  user-facing revision history is offered.
- Soft delete, archiving, an undo, and a recycle bin. Deletion is permanent and cascading.
- A controlled vocabulary of crop names, and reconciling free-text variants of the same crop.
