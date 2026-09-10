import { Prisma } from '@prisma/client';
import { BreakdownDto, BreakdownUnit, CategoryDto } from './dto/dashboard-response.dto';
import { toHectares } from './decimal.util';

export interface RawCategory {
  key: string;
  label: string;
  value: Prisma.Decimal | number;
}

function isZero(value: Prisma.Decimal | number): boolean {
  return value instanceof Prisma.Decimal ? value.isZero() : value === 0;
}

function compare(a: RawCategory, b: RawCategory): number {
  const av = a.value instanceof Prisma.Decimal ? a.value : new Prisma.Decimal(a.value);
  const bv = b.value instanceof Prisma.Decimal ? b.value : new Prisma.Decimal(b.value);
  const byValue = bv.comparedTo(av);
  return byValue !== 0 ? byValue : a.key.localeCompare(b.key);
}

/**
 * Turns raw aggregate rows into a breakdown ready to plot.
 *
 * Two rules, applied to every breakdown alike:
 *
 * 1. No zero-valued category, ever (FR-022). For state and crop this is automatic - GROUP BY
 *    cannot produce an empty group - but land use computes its categories rather than grouping
 *    them, so a registry where every property fully classifies its land yields an unclassified
 *    value of exactly zero. One shared filter keeps all three consistent.
 *
 * 2. Deterministic order: value descending, key ascending as a tie-break (SC-007). GROUP BY
 *    guarantees no ordering at all, and hash-aggregate order can change as a table grows or after
 *    a vacuum - so without this the chart legend would reshuffle between identical requests.
 */
export function buildBreakdown(unit: BreakdownUnit, raw: RawCategory[]): BreakdownDto {
  const categories: CategoryDto[] = raw
    .filter((c) => !isZero(c.value))
    .sort(compare)
    .map((c) => ({
      key: c.key,
      label: c.label,
      value: c.value instanceof Prisma.Decimal ? toHectares(c.value) : c.value,
    }));

  return { unit, categories };
}
