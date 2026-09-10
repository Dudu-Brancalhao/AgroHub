import { Prisma } from '@prisma/client';
import { decimalToString } from '../../../src/common/validation/decimal.transform';
import { FLOAT_DRIFT_CASES } from '../../support/area-fixtures';

const D = (v: number | string) => new Prisma.Decimal(v);

describe('Decimal handling (FR-016)', () => {
  it('converts a 2-decimal JSON number exactly', () => {
    expect(D(1500.11).toFixed(2)).toBe('1500.11');
    expect(D(500.11).toFixed(2)).toBe('500.11');
  });

  /**
   * The distinction the whole design rests on: converting PER FIELD is exact, converting the
   * SUM inherits the drift the addition already introduced (research.md R-001).
   */
  it.each(FLOAT_DRIFT_CASES)(
    'per-field conversion is exact for $arable + $vegetation = $total',
    (c) => {
      expect(c.arable + c.vegetation > c.total).toBe(true);

      const perField = D(c.arable).plus(D(c.vegetation));
      expect(perField.equals(D(c.total))).toBe(true);
      expect(perField.lessThanOrEqualTo(D(c.total))).toBe(true);
    },
  );

  it('serialises to a fixed two-decimal string for responses', () => {
    expect(decimalToString(D(1000))).toBe('1000.00');
    expect(decimalToString(D('500.1'))).toBe('500.10');
    expect(decimalToString(D(1500.11))).toBe('1500.11');
  });
});
