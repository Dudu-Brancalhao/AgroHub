/**
 * Produces the comparison key for text that must match regardless of casing, accents or spacing.
 *
 * Used in two places, for the same reason both times:
 *   - Producer.nameSearch, so searching "jose" finds "José" (FR-027)
 *   - Crop.nameNormalized, so "Soja" and "soja" are one crop (FR-025)
 *
 * NFD decomposition splits an accented character into its base plus a combining mark, which the
 * regex then strips - so "é" becomes "e" without needing a lookup table or a dependency.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Trims and collapses inner whitespace while preserving the caller's capitalisation (FR-009, FR-024). */
export function normalizeDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
