import { Prisma } from '@prisma/client';

/**
 * Coalesces a Prisma aggregate sum to zero.
 *
 * Measured behaviour, not an assumption: on an empty table Prisma returns
 *
 *     _count        -> 0      (fine)
 *     _sum.totalArea -> null  (NOT 0)
 *     groupBy       -> []     (fine)
 *
 * Three of the four aggregate shapes are safe, which is exactly what makes the fourth easy to
 * miss. Reading the sum directly and calling .toFixed(2) throws, so the naive implementation does
 * not return a wrong number - it makes the very first request against a fresh installation return
 * 500 (research.md R-002).
 */
export function sumOrZero(value: Prisma.Decimal | null | undefined): Prisma.Decimal {
  return value ?? new Prisma.Decimal(0);
}

/** Serialises hectares for a response: exactly two decimal places, as a string. */
export function toHectares(value: Prisma.Decimal): string {
  return value.toFixed(2);
}
