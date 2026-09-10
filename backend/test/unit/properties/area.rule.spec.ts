import { Prisma } from '@prisma/client';
import { areasAreConsistent, unclassifiedArea } from '../../../src/properties/area.rule';
import { FLOAT_DRIFT_CASES, driftsInFloatingPoint } from '../../support/area-fixtures';

const D = (value: number | string) => new Prisma.Decimal(value);

const triple = (total: number, arable: number, vegetation: number) => ({
  totalArea: D(total),
  arableArea: D(arable),
  vegetationArea: D(vegetation),
});

describe('Area rule (FR-013, FR-016)', () => {
  it('accepts parts that fit within the total', () => {
    expect(areasAreConsistent(triple(100, 60, 30))).toBe(true);
  });

  it('rejects parts that exceed the total', () => {
    expect(areasAreConsistent(triple(100, 70, 40))).toBe(false);
  });

  // FR-013 forbids EXCEEDING, not reaching. Getting this wrong refuses a farm that is entirely
  // arable plus vegetation, which is a perfectly ordinary property (spec US2 §3).
  it('accepts parts that exactly consume the total', () => {
    expect(areasAreConsistent(triple(100, 60, 40))).toBe(true);
  });

  it('accepts zero arable and zero vegetation as unused land', () => {
    expect(areasAreConsistent(triple(100, 0, 0))).toBe(true);
  });

  it('rejects a single part larger than the whole', () => {
    expect(areasAreConsistent(triple(100, 101, 0))).toBe(false);
  });

  /**
   * The reason this rule uses Decimal rather than plain numbers.
   *
   * Each of these triples is exactly consistent in decimal, and each is WRONGLY REJECTED by a
   * naive `arable + vegetation <= total` in JavaScript. The first is an entirely ordinary farm:
   * 1000 ha arable and 500.11 ha vegetation on 1500.11 ha (research.md R-001).
   */
  describe('floating-point drift', () => {
    it.each(FLOAT_DRIFT_CASES)(
      'accepts total=$total arable=$arable vegetation=$vegetation despite JS drift',
      (c) => {
        // Guard the fixture itself: if this stops drifting, the test below proves nothing.
        expect(driftsInFloatingPoint(c)).toBe(true);
        expect(c.arable + c.vegetation > c.total).toBe(true);

        expect(areasAreConsistent(triple(c.total, c.arable, c.vegetation))).toBe(true);
      },
    );

    it('is not fooled by a genuine overflow that looks like drift', () => {
      // 0.01 over, not 1e-17 over. An epsilon tolerance would wrongly accept this, which is why
      // the rule compares exactly instead.
      expect(areasAreConsistent(triple(1500.11, 1000, 500.12))).toBe(false);
    });
  });

  describe('unclassifiedArea', () => {
    it('reports the remainder exactly', () => {
      expect(unclassifiedArea(triple(100, 60, 30)).toFixed(2)).toBe('10.00');
    });

    it('reports zero when the parts consume the total', () => {
      expect(unclassifiedArea(triple(1500.11, 1000, 500.11)).toFixed(2)).toBe('0.00');
    });
  });
});
