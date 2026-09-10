/**
 * Area triples where arable + vegetation EXACTLY equals total in decimal, but where the naive
 * JavaScript check `arable + vegetation <= total` returns false.
 *
 * Measured, not invented (research.md R-001). Any implementation that adds areas as numbers fails
 * these and wrongly rejects perfectly ordinary farms.
 */
export const FLOAT_DRIFT_CASES = [
  { total: 1500.11, arable: 1000, vegetation: 500.11 },
  { total: 1500.36, arable: 1000, vegetation: 500.36 },
  { total: 0.06, arable: 0.01, vegetation: 0.05 },
  { total: 0.15, arable: 0.01, vegetation: 0.14 },
] as const;

/** Sanity check the fixtures still drift on this platform; if not, they prove nothing. */
export function driftsInFloatingPoint(c: { total: number; arable: number; vegetation: number }): boolean {
  return c.arable + c.vegetation > c.total;
}
