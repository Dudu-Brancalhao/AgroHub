/**
 * Exact hectare arithmetic.
 *
 * Areas are held as `Centiares` — an integer of hundredths of a hectare — and never as
 * fractional JavaScript numbers. The backend stores `Decimal(12,2)` and returns strings
 * precisely so no float rounding happens in transit; doing the comparison in floats here would
 * reintroduce the bug at the last mile:
 *
 *   1000 + 500.11 === 1500.1100000000001   // > 1500.11, so a valid farm gets refused
 *
 * Fixing the scale at two decimals makes the integer form exact rather than approximate. The
 * largest area the column can hold is under 10^10 ha, so the largest integer here is under
 * 10^12 — comfortably inside Number.MAX_SAFE_INTEGER (research.md R-004).
 */

/** Hundredths of a hectare, as an exact integer. "1500.11" ha -> 150011 */
export type Centiares = number;

const DECIMAL_STRING = /^\d+(\.\d{1,2})?$/;

/** Parses a decimal string exactly as the API sends it. Returns null if it is not one. */
export function parseArea(value: string): Centiares | null {
  const trimmed = value.trim();
  if (!DECIMAL_STRING.test(trimmed)) return null;

  const [whole = '0', fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * Parses what a person typed, which in pt-BR uses a comma for the decimal separator and may
 * carry thousands dots. Anything with more than two decimal places is refused rather than
 * rounded — the scale is fixed at two, and silently dropping a digit the user typed would be
 * worse than telling them.
 */
export function parseAreaInput(value: string): Centiares | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;

  return parseArea(normalized);
}

/** Renders centiares as a pt-BR decimal with exactly two places. Never rounds (FR-020). */
export function formatArea(value: Centiares): string {
  const whole = Math.trunc(value / 100);
  const fraction = Math.abs(value % 100);
  const groupedWhole = whole.toLocaleString('pt-BR');

  return `${groupedWhole},${String(fraction).padStart(2, '0')}`;
}

/** Renders centiares back into the plain decimal string the input field shows while editing. */
export function toInputValue(value: Centiares): string {
  const whole = Math.trunc(value / 100);
  const fraction = Math.abs(value % 100);
  return `${whole},${String(fraction).padStart(2, '0')}`;
}

/**
 * The JSON number the API expects on the way out. `CreatePropertyDto` declares areas as numbers
 * while responses return strings, so this asymmetry is the contract, not an accident. A
 * two-decimal value round-trips through JSON exactly.
 */
export function toApiNumber(value: Centiares): number {
  return value / 100;
}

export function sumAreas(...values: Centiares[]): Centiares {
  return values.reduce((total, value) => total + value, 0);
}

export function subtractAreas(total: Centiares, ...values: Centiares[]): Centiares {
  return values.reduce((remaining, value) => remaining - value, total);
}

/**
 * The rule the server enforces: a farm's arable and vegetation areas together may not exceed its
 * total. Compared in integers, so it agrees with the server's decimal comparison exactly.
 */
export function isWithinTotal(
  total: Centiares,
  arable: Centiares,
  vegetation: Centiares,
): boolean {
  return arable + vegetation <= total;
}

/** Whatever area is neither arable nor vegetation. Shown only when positive. */
export function unclassifiedArea(
  total: Centiares,
  arable: Centiares,
  vegetation: Centiares,
): Centiares {
  return Math.max(0, total - arable - vegetation);
}
