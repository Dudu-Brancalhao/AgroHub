import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';

/**
 * Converts ONE numeric field to Prisma.Decimal at the DTO boundary.
 *
 * The rule this exists to enforce: **areas are never added as JavaScript numbers.** Not once, not
 * "just for the check". Converting per field is what makes the arithmetic exact, because
 * Decimal's constructor goes through the number's shortest round-trip string — `500.11` in, not
 * `500.1100000000001`.
 *
 * Doing it the other way round poisons the result:
 *
 *     new Decimal(a + b)              // WRONG: the addition already happened in double precision
 *     new Decimal(a).plus(new Decimal(b))  // right
 *
 * Measured consequence (research.md R-001): a farm with 1000 ha arable and 500.11 ha vegetation on
 * a 1500.11 ha property is valid, but `1000 + 500.11` is `1500.1100000000001` in JavaScript, so
 * the naive check rejects it. The failures cluster on values ending .11, .36, .61 and .86 — common
 * enough to be reported as a bug within days of launch.
 */
export const ToDecimal = () =>
  Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    if (value instanceof Prisma.Decimal) {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'string') {
      try {
        return new Prisma.Decimal(value);
      } catch {
        // Leave it alone so @IsNumber reports a proper validation error rather than a 500.
        return value;
      }
    }
    return value;
  });

/** Serialises a Decimal for a response body, keeping the exact two-decimal representation. */
export function decimalToString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}
