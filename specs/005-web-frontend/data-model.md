# Phase 1 Data Model: Web Frontend

**Feature**: 005-web-frontend | **Date**: 2026-09-10

The frontend owns no persistent data. This document defines the **client-side view** of the backend's
entities — the TypeScript types mirrored from the API's DTOs, the validation rules applied before
submitting, and the derived values screens compute. The authoritative shapes live in the backend DTOs;
this is the mirror the client must keep faithful, and `ts-jest` type-checks it at test time (R-005).

The Redux state shape that holds these entities is specified separately in
[contracts/store.md](./contracts/store.md).

---

## Cross-cutting conventions

**Dates**: every `createdAt` / `updatedAt` arrives as an ISO-8601 string. The client keeps them as
strings and formats for display; it never constructs a `Date` for comparison.

**Areas**: every area arrives as a **decimal string** (`"1500.11"`) and is submitted as a **JSON
number** (`1500.11`). Internally the client holds `Centiares` — an integer of hundredths of a hectare
(R-004). Areas are never held as fractional numbers.

```ts
/** Hundredths of a hectare, as an exact integer. "1500.11" ha -> 150011 */
type Centiares = number;
```

**Identifiers**: every `id` is a UUID v4 string. The client treats them as opaque.

---

## Session

Represents the signed-in identity and the credential authorising requests. Cleared on sign-out, on
`401`, and when a sibling tab signs out (R-007).

| Field | Type | Source | Notes |
|---|---|---|---|
| `accessToken` | `string` | `LoginResponseDto.accessToken` | Sent as `Authorization: Bearer <token>` on every protected request (FR-014). Never logged, never in a URL. |
| `tokenType` | `'Bearer'` | `LoginResponseDto.tokenType` | Constant; retained for fidelity to the contract. |
| `expiresAt` | `string` (ISO) | derived: now + `expiresIn` seconds | Stored rather than `expiresIn`, so it stays meaningful across a reload. Checked on rehydrate. |
| `user.id` | `string` | `UserResponseDto.id` | |
| `user.email` | `string` | `UserResponseDto.email` | Shown in the top bar (FR-017). |
| `user.createdAt` | `string` (ISO) | `UserResponseDto.createdAt` | |

**Persistence**: the whole object is serialised under one `localStorage` key. On start-up it is read
once; if `expiresAt` is in the past the key is discarded and the app starts signed out, so an expired
token never produces a doomed first request.

**Validation before submitting credentials** (must mirror the server exactly, so the client never
rejects what the server accepts or vice versa):

| Field | Rule | pt-BR message |
|---|---|---|
| `email` | Required, valid e-mail format, ≤ 254 chars | `Informe um e-mail válido.` |
| `password` (sign-up) | Required, ≥ 8 chars, at least one letter and one digit | `A senha deve ter no mínimo 8 caracteres.` / `A senha deve conter pelo menos uma letra e um número.` |
| `password` (sign-in) | Required only — never apply the strength rules here | Applying sign-up rules on sign-in would lock out an account created before the rules; the server decides. |

---

## Producer

A person or company that farms. Root of the registry — every farm belongs to exactly one.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `document` | `string` | Digits only, as normalised by the server (11 for CPF, 14 for CNPJ). Masked for display. |
| `documentType` | `'CPF' \| 'CNPJ'` | Server-derived from the document's length; the client never sends it. |
| `name` | `string` | ≤ 200 chars. |
| `createdAt` / `updatedAt` | `string` (ISO) | |

**`ProducerDetail`** extends the above with `properties: PropertyDetail[]` — returned in full by
`GET /api/producers/:id`. This single response backs the entire producer detail screen and all of
User Story 4 (R-009).

**Validation before submitting** (FR-027):

| Field | Rule | pt-BR message |
|---|---|---|
| `name` | Required after trimming, ≤ 200 chars | `O nome é obrigatório.` / `O nome deve ter no máximo 200 caracteres.` |
| `document` | Strip punctuation, then must be 11 digits with valid CPF check digits, or 14 with valid CNPJ check digits | `Informe um CPF ou CNPJ válido.` |

**Client rules**:

- Punctuation is stripped before sending; the server normalises again, so both agree.
- Repeated-digit documents (`111.111.111-11`) must fail — they satisfy a naive checksum (R-010).
- Uniqueness is **not** checked client-side. The server owns it; its `409` message is displayed
  against the document field (FR-030).

**Display derivations**: `documentMask` renders `529.982.247-25` for CPF and
`11.222.333/0001-81` for CNPJ, from the digits-only stored value.

---

## Property (Farm)

A holding belonging to exactly one producer. Referred to as *fazenda* / *propriedade* in the UI.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `producerId` | `string` | Owning producer. |
| `farmName` | `string` | ≤ 200 chars. |
| `city` | `string` | ≤ 120 chars. |
| `state` | `string` | Exactly one of the 27 Brazilian UF codes. |
| `totalArea` | decimal string in → `Centiares` | Held as an integer internally. |
| `arableArea` | decimal string in → `Centiares` | |
| `vegetationArea` | decimal string in → `Centiares` | |
| `createdAt` / `updatedAt` | `string` (ISO) | |

**`PropertyDetail`** extends the above with `harvests: HarvestWithCrops[]` — the farm's plantings
already grouped by season, as returned inside `ProducerDetail`.

**Validation before submitting** (FR-033, FR-034):

| Field | Rule | pt-BR message |
|---|---|---|
| `farmName` | Required after trimming, ≤ 200 | `O nome da fazenda é obrigatório.` |
| `city` | Required after trimming, ≤ 120 | `A cidade é obrigatória.` |
| `state` | Must be one of the 27 UF codes | `Informe uma UF brasileira válida.` |
| `totalArea` | ≥ 0.01 ha, ≤ 2 decimals | `A área total deve ser maior que zero.` |
| `arableArea` | ≥ 0, ≤ 2 decimals | `A área agricultável não pode ser negativa.` |
| `vegetationArea` | ≥ 0, ≤ 2 decimals | `A área de vegetação não pode ser negativa.` |
| **composite** | `arableArea + vegetationArea ≤ totalArea` | `A soma da área agricultável e da vegetação não pode ultrapassar a área total.` |

**The composite rule is the one that must not be got wrong.** It is evaluated as
`arable + vegetation <= total` **in `Centiares` integers**. Evaluated in floats it rejects valid
input: `1000 + 500.11 === 1500.1100000000001 > 1500.11`. The backend's own schema comment records this
exact case; the client must not reintroduce it (R-004).

**Display derivations**: `unclassifiedArea = totalArea - arableArea - vegetationArea` (integer
subtraction, shown only when positive); areas render as pt-BR 2-decimal strings (`1.500,11 ha`).

---

## Harvest (Safra)

A planting year shared by the whole registry. Belongs to no producer.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `year` | `number` | Integer, unique across the system. |
| `createdAt` / `updatedAt` | `string` (ISO) | |

**Validation before submitting** (FR-039):

| Field | Rule | pt-BR message |
|---|---|---|
| `year` | Integer, ≥ 1900 and ≤ current year + 1 | `O ano da safra deve ser um número inteiro.` / `Informe um ano de safra plausível.` |

**Client rules**:

- The upper bound is computed from the current year at render time, matching the server's
  `isPlausibleHarvestYear`. Do not hard-code it.
- Uniqueness is the server's; its `409` is shown on the year field (User Story 5, scenario 2).
- **Deletion is refused while plantings reference it.** The server returns `409` with a count. The UI
  must present this as an explanation, never as a generic failure, and the season stays in the list
  (FR-041). This is the opposite of producer deletion, which cascades — the two confirmations must
  therefore read differently.

---

## Crop (Planting)

The record that a given farm planted a named crop in a given season. The junction of Property and
Harvest.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `propertyId` | `string` | The farm. Present directly on the DTO, so a planting listed under a season identifies its farm without a second lookup (FR-042). |
| `harvestId` | `string` | The season. |
| `name` | `string` | ≤ 120 chars. |
| `createdAt` / `updatedAt` | `string` (ISO) | |

**`HarvestWithCrops`** is the grouped shape nested inside `PropertyDetail`:
`{ harvestId, year, crops: Crop[] }` — the farm's plantings for one season.

**Validation before submitting** (FR-036):

| Field | Rule | pt-BR message |
|---|---|---|
| `harvestId` | Required, must be a UUID chosen from the existing seasons | `Selecione uma safra.` |
| `name` | Required after trimming, ≤ 120 | `O nome da cultura é obrigatório.` |

**Client rules**:

- The season is **selected**, never typed — the form offers the existing seasons, which means the
  harvests list must be loaded before the planting form is usable.
- Duplicate detection (same farm + season + crop name, case- and accent-insensitively) is the
  server's; its `409` is shown against the form (FR-037). The client may additionally grey out crops
  already present in that season as a courtesy, but must not treat its own check as authoritative.

---

## Registry summary (Dashboard)

Read-only aggregate over the whole registry. No client-side entity — a projection rendered as
received.

| Field | Type | Notes |
|---|---|---|
| `totals.farms` | `number` | Count of properties. |
| `totals.hectares` | decimal string → `Centiares` | Total area across all properties. |
| `byState` | `Breakdown` | Unit `count` — farms per UF. |
| `byCrop` | `Breakdown` | Unit `hectares` — area per crop name. |
| `byLandUse` | `Breakdown` | Unit `hectares` — arable / vegetation / unclassified. |

```ts
type Breakdown = {
  unit: 'hectares' | 'count';
  categories: Array<{ key: string; label: string; value: string | number }>;
};
```

**Client rules**:

- `value` is `string` for `hectares` breakdowns and `number` for `count` breakdowns. The renderer must
  branch on `unit`, not guess from the runtime type.
- Hectare values are parsed to `Centiares` for the proportional bar widths and re-formatted for
  display — never rounded (FR-020).
- `byLandUse` categories must sum exactly to `totals.hectares` (SC-007). Because both sides are
  integers, this is an exact equality and is worth asserting in a test.
- The `unclassified` category appears only when some area is genuinely unaccounted for; the renderer
  must not synthesise it when absent.
- Empty registry ⇒ `totals.farms === 0` ⇒ render the empty state, not zero-height bars (FR-021).

---

## Deletion report

Returned by every delete operation.

```ts
type DeletionReport = {
  deleted: { producers?: number; properties?: number; crops?: number; harvests?: number };
};
```

Used to phrase the success toast concretely — *"Produtor excluído: 1 produtor, 3 propriedades, 89
culturas."* — which is what makes the cascade visible after the fact, complementing the warning shown
before it (FR-029, FR-051). Deleting a producer never reports `harvests`: seasons are shared and
survive.

---

## Error envelope

Every failure from the API arrives in one shape, and the client depends on it.

| Field | Type | Client use |
|---|---|---|
| `statusCode` | `number` | `401` ⇒ clear session and redirect (FR-015). `409` ⇒ conflict message on the relevant field. `422`/`400` ⇒ map `details` to fields. |
| `error` | `string` (English) | **Never displayed.** Technical identifier only. |
| `message` | `string` (pt-BR) | The user-facing text (FR-050). |
| `details` | `Array<{ field, message }>` | Present on validation failures; each entry is bound to its form field by name, so all invalid fields are marked at once. |
| `path` / `timestamp` | `string` | Diagnostic only. |
| `requestId` | `string` | Attached to the client's own error reporting so a user-visible failure can be correlated to the backend log (Principle VI). Not displayed prominently, but available for a support copy action. |

**Rule**: no screen ever renders `error`, `path`, `statusCode` or a stack. SC-006 requires that raw
technical text never reaches the user; the only string shown is `message`, or a client-supplied pt-BR
fallback when the response carried no envelope at all (a network failure or a non-JSON body).

---

## Entity relationships

```text
Session ──authorises──> every protected request

Producer 1 ──owns──> N Property        (delete Producer ⇒ cascades to its Properties and Crops)
Property 1 ──has───> N Crop            (delete Property ⇒ cascades to its Crops)
Harvest  1 ──has───> N Crop            (delete Harvest ⇒ REFUSED while any Crop references it)
Crop     ──joins──>  (Property, Harvest), unique per (property, harvest, normalised name)

Registry summary ── aggregates over all Property and Crop rows
```

The asymmetry on the two delete paths is the single most important behavioural fact in this model, and
the UI must express it: a producer's confirmation warns that everything below it disappears, while a
season's refusal explains that it is in use and nothing was removed.
