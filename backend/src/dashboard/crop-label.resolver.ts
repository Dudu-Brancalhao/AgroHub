export interface CropSpellingRow {
  nameNormalized: string;
  name: string;
  count: number;
}

export interface ResolvedCrop {
  key: string;
  label: string;
  count: number;
}

/**
 * Collapses spelling variants of one crop into a single category, and picks the label.
 *
 * The rule: sum the counts per normalised key, and label the category with **the spelling used
 * most often**, breaking ties alphabetically.
 *
 * Why not the obvious one-liner. Prisma offers `_min: { name: true }` on a groupBy, which would
 * give a deterministic label in a single query with no reduce at all. Measured against real rows:
 *
 *     records: "Soja" x2, "SOJA" x1
 *     _min(name) -> "SOJA"     (uppercase sorts before lowercase in ASCII)
 *     most-used  -> "Soja"
 *
 * `_min` surfaces the spelling used once out of three. It satisfies "deterministic" and fails
 * "sensible", which is why the extra group-and-reduce is worth it (research.md R-003).
 *
 * The tie-break is alphabetical, so one "Café" and one "Cafe" yields "Cafe". Not pretty, but
 * stable across requests, which is what SC-007 requires - and any prettier rule is either
 * non-deterministic or arbitrary in a different direction.
 */
export function resolveCrops(rows: CropSpellingRow[]): ResolvedCrop[] {
  const byKey = new Map<string, { total: number; spellings: CropSpellingRow[] }>();

  for (const row of rows) {
    const entry = byKey.get(row.nameNormalized) ?? { total: 0, spellings: [] };
    entry.total += row.count;
    entry.spellings.push(row);
    byKey.set(row.nameNormalized, entry);
  }

  return [...byKey.entries()].map(([key, entry]) => {
    const label = [...entry.spellings].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    )[0].name;

    return { key, label, count: entry.total };
  });
}
