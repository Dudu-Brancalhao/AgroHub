import { Prisma } from '@prisma/client';

export interface AreaTriple {
  totalArea: Prisma.Decimal;
  arableArea: Prisma.Decimal;
  vegetationArea: Prisma.Decimal;
}

/**
 * The registry's central invariant: **arable + vegetation must not EXCEED total**.
 *
 * A standalone unit rather than a condition inside PropertiesService, because it is invoked from
 * two places with different inputs — creation, where the payload is the whole record, and update,
 * where it must run against the record as it will be after a partial change (FR-014).
 *
 * Two things it must get right, each of which is its own requirement:
 *
 * 1. `<=`, not `<`. A farm that is entirely arable plus vegetation is valid; the rule forbids
 *    exceeding the total, not reaching it (FR-013, spec US2 §3).
 *
 * 2. The arithmetic happens in Decimal, and the values arrive as Decimal — already converted
 *    per field by the DTO. Adding them as JavaScript numbers wrongly rejects a 1000 ha + 500.11 ha
 *    farm on a 1500.11 ha property, because `1000 + 500.11` is `1500.1100000000001`
 *    (FR-016, research.md R-001).
 */
export function areasAreConsistent(areas: AreaTriple): boolean {
  return areas.arableArea.plus(areas.vegetationArea).lessThanOrEqualTo(areas.totalArea);
}

/** The unused remainder — unclassified land, tracked nowhere, computed only for messages. */
export function unclassifiedArea(areas: AreaTriple): Prisma.Decimal {
  return areas.totalArea.minus(areas.arableArea).minus(areas.vegetationArea);
}

export const AREA_RULE_MESSAGE =
  'A soma da área agricultável e da área de vegetação não pode ultrapassar a área total.';
