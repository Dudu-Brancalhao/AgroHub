import { resolveCrops } from '../../../src/dashboard/crop-label.resolver';

const row = (nameNormalized: string, name: string, count: number) => ({
  nameNormalized,
  name,
  count,
});

describe('resolveCrops (FR-015, FR-016)', () => {
  it('collapses spelling variants into one category and sums their counts', () => {
    const result = resolveCrops([row('soja', 'Soja', 2), row('soja', 'SOJA', 1)]);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('soja');
    expect(result[0].count).toBe(3);
  });

  /**
   * The case that catches the tempting one-line implementation.
   *
   * Prisma's _min: { name: true } returns "SOJA" here, because uppercase sorts before lowercase
   * in ASCII - surfacing the spelling used once out of three as the label (research.md R-003).
   */
  it('labels the category with the most-used spelling, not the alphabetically first', () => {
    const result = resolveCrops([row('soja', 'Soja', 2), row('soja', 'SOJA', 1)]);

    expect(result[0].label).toBe('Soja');
    expect(result[0].label).not.toBe('SOJA');
  });

  it('still prefers the most-used spelling when it sorts last', () => {
    const result = resolveCrops([row('soja', 'SOJA', 1), row('soja', 'soja', 5)]);
    expect(result[0].label).toBe('soja');
  });

  it('breaks an exact tie alphabetically, so the label is stable across requests', () => {
    const first = resolveCrops([row('cafe', 'Café', 1), row('cafe', 'Cafe', 1)]);
    const reversed = resolveCrops([row('cafe', 'Cafe', 1), row('cafe', 'Café', 1)]);

    expect(first[0].label).toBe('Cafe');
    expect(reversed[0].label).toBe(first[0].label);
  });

  it('groups accent variants under one key', () => {
    const result = resolveCrops([row('cafe', 'Café', 3), row('cafe', 'Cafe', 1)]);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(4);
    expect(result[0].label).toBe('Café');
  });

  it('keeps genuinely different words apart', () => {
    const result = resolveCrops([row('soja', 'Soja', 2), row('soya', 'Soya', 1)]);

    expect(result.map((r) => r.key).sort()).toEqual(['soja', 'soya']);
  });

  it('handles several crops at once', () => {
    const result = resolveCrops([
      row('soja', 'Soja', 2),
      row('soja', 'SOJA', 1),
      row('milho', 'Milho', 2),
    ]);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.key === 'milho')).toEqual({
      key: 'milho',
      label: 'Milho',
      count: 2,
    });
  });

  it('returns an empty array for empty input', () => {
    expect(resolveCrops([])).toEqual([]);
  });

  it('handles a single spelling with a single record', () => {
    expect(resolveCrops([row('trigo', 'Trigo', 1)])).toEqual([
      { key: 'trigo', label: 'Trigo', count: 1 },
    ]);
  });

  it('does not mutate its input', () => {
    const rows = [row('soja', 'SOJA', 1), row('soja', 'Soja', 2)];
    const snapshot = JSON.parse(JSON.stringify(rows));
    resolveCrops(rows);
    expect(rows).toEqual(snapshot);
  });
});
