import { Prisma } from '@prisma/client';
import { buildBreakdown } from '../../../src/dashboard/breakdown.builder';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('buildBreakdown (FR-022, SC-007, SC-011)', () => {
  describe('zero filtering', () => {
    it('drops a zero-valued category', () => {
      const result = buildBreakdown('hectares', [
        { key: 'arable', label: 'Área agricultável', value: D('60.00') },
        { key: 'unclassified', label: 'Área não classificada', value: D('0.00') },
      ]);

      expect(result.categories.map((c) => c.key)).toEqual(['arable']);
    });

    it('returns an empty array when everything is zero, not an array of zeroes', () => {
      const result = buildBreakdown('hectares', [
        { key: 'arable', label: 'A', value: D(0) },
        { key: 'vegetation', label: 'V', value: D(0) },
        { key: 'unclassified', label: 'U', value: D(0) },
      ]);

      expect(result.categories).toEqual([]);
    });

    it('drops a zero count as readily as a zero decimal', () => {
      const result = buildBreakdown('count', [
        { key: 'soja', label: 'Soja', value: 3 },
        { key: 'milho', label: 'Milho', value: 0 },
      ]);

      expect(result.categories.map((c) => c.key)).toEqual(['soja']);
    });

    it('returns an empty array for empty input', () => {
      expect(buildBreakdown('hectares', []).categories).toEqual([]);
    });
  });

  describe('ordering', () => {
    it('sorts by value descending', () => {
      const result = buildBreakdown('hectares', [
        { key: 'BA', label: 'BA', value: D('25.00') },
        { key: 'MG', label: 'MG', value: D('1200.11') },
        { key: 'SP', label: 'SP', value: D('500.36') },
      ]);

      expect(result.categories.map((c) => c.key)).toEqual(['MG', 'SP', 'BA']);
    });

    it('breaks ties by key so identical input always yields identical output', () => {
      const raw = [
        { key: 'SP', label: 'SP', value: D('100.00') },
        { key: 'BA', label: 'BA', value: D('100.00') },
        { key: 'MG', label: 'MG', value: D('100.00') },
      ];

      expect(buildBreakdown('hectares', raw).categories.map((c) => c.key)).toEqual([
        'BA',
        'MG',
        'SP',
      ]);
      // Same input, reversed: the tie-break must produce the same order regardless.
      expect(buildBreakdown('hectares', [...raw].reverse()).categories.map((c) => c.key)).toEqual([
        'BA',
        'MG',
        'SP',
      ]);
    });

    it('sorts numeric counts correctly, not as strings', () => {
      const result = buildBreakdown('count', [
        { key: 'a', label: 'A', value: 9 },
        { key: 'b', label: 'B', value: 10 },
      ]);

      // A string sort would put "10" before "9".
      expect(result.categories.map((c) => c.key)).toEqual(['b', 'a']);
    });

    it('compares large decimals exactly rather than through float conversion', () => {
      const result = buildBreakdown('hectares', [
        { key: 'a', label: 'A', value: D('1500.11') },
        { key: 'b', label: 'B', value: D('1500.12') },
      ]);

      expect(result.categories.map((c) => c.key)).toEqual(['b', 'a']);
    });
  });

  describe('serialisation', () => {
    it('renders decimal values as two-decimal strings and keeps the unit', () => {
      const result = buildBreakdown('hectares', [{ key: 'MG', label: 'MG', value: D('1200.1') }]);

      expect(result.unit).toBe('hectares');
      expect(result.categories[0].value).toBe('1200.10');
    });

    it('leaves counts as numbers', () => {
      const result = buildBreakdown('count', [{ key: 'soja', label: 'Soja', value: 3 }]);

      expect(result.unit).toBe('count');
      expect(result.categories[0].value).toBe(3);
    });

    it('preserves the label separately from the key', () => {
      const result = buildBreakdown('count', [{ key: 'soja', label: 'Soja', value: 1 }]);
      expect(result.categories[0]).toEqual({ key: 'soja', label: 'Soja', value: 1 });
    });
  });
});
