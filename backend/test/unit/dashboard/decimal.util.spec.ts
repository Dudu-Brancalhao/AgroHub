import { Prisma } from '@prisma/client';
import { sumOrZero, toHectares } from '../../../src/dashboard/decimal.util';

describe('sumOrZero (FR-007, FR-020)', () => {
  /**
   * The case this function exists for. Prisma returns null - not 0 - from _sum on an empty table,
   * so reading it directly makes the first request against a fresh installation throw
   * (research.md R-002).
   */
  it.each([[null], [undefined]])('turns %p into Decimal(0)', (value) => {
    const result = sumOrZero(value as null | undefined);
    expect(result).toBeInstanceOf(Prisma.Decimal);
    expect(result.isZero()).toBe(true);
  });

  it('formats the coalesced value without throwing', () => {
    expect(toHectares(sumOrZero(null))).toBe('0.00');
  });

  it('passes a real Decimal through unchanged', () => {
    const value = new Prisma.Decimal('1725.47');
    expect(sumOrZero(value)).toBe(value);
  });

  it('passes a genuine zero through rather than replacing it', () => {
    const zero = new Prisma.Decimal(0);
    expect(sumOrZero(zero)).toBe(zero);
  });
});

describe('toHectares', () => {
  it.each([
    ['1725.47', '1725.47'],
    ['1000', '1000.00'],
    ['500.1', '500.10'],
    ['0', '0.00'],
  ])('serialises %p as %p', (input, expected) => {
    expect(toHectares(new Prisma.Decimal(input))).toBe(expected);
  });

  it('keeps a sum exact where JavaScript numbers would drift', () => {
    const total = new Prisma.Decimal('1000.11')
      .plus(new Prisma.Decimal('200'))
      .plus(new Prisma.Decimal('500.36'))
      .plus(new Prisma.Decimal('25'));

    expect(toHectares(total)).toBe('1725.47');
    // The same sum in plain JavaScript, for contrast.
    expect((1000.11 + 200 + 500.36 + 25).toString()).not.toBe('1725.47');
  });
});
