import { MAX_SLICES, selectBreakdown, selectLandUseTotal } from './selectors';
import type { RootState } from '../../app/store';
import type { Category, RegistrySummary } from './types';

function summaryWith(categories: Category[]): RegistrySummary {
  return {
    totals: { farms: 1, hectares: 150011 },
    byState: { unit: 'hectares', categories },
    byCrop: { unit: 'count', categories: [] },
    byLandUse: {
      unit: 'hectares',
      categories: [
        { key: 'arable', label: 'Agricultável', value: 100000 },
        { key: 'vegetation', label: 'Vegetação', value: 50011 },
      ],
    },
  };
}

function stateWith(categories: Category[]): RootState {
  return {
    dashboard: {
      summary: summaryWith(categories),
      request: { status: 'succeeded', error: null, requestId: null },
      stale: false,
    },
  } as RootState;
}

describe('selectBreakdown', () => {
  /** A pie answers "how much of the total", so shares are of the sum, not of the biggest. */
  it('computes each slice as a share of the whole', () => {
    const breakdown = selectBreakdown(
      stateWith([
        { key: 'mg', label: 'MG', value: 75 },
        { key: 'sp', label: 'SP', value: 25 },
      ]),
      'byState',
    );

    expect(breakdown?.total).toBe(100);
    expect(breakdown?.slices.map((s) => s.share)).toEqual([75, 25]);
  });

  it('orders slices largest first', () => {
    const breakdown = selectBreakdown(
      stateWith([
        { key: 'sp', label: 'SP', value: 10 },
        { key: 'mg', label: 'MG', value: 60 },
        { key: 'ba', label: 'BA', value: 30 },
      ]),
      'byState',
    );

    expect(breakdown?.slices.map((s) => s.key)).toEqual(['mg', 'ba', 'sp']);
  });

  it('shares always add up to the whole', () => {
    const breakdown = selectBreakdown(
      stateWith([
        { key: 'a', label: 'A', value: 1 },
        { key: 'b', label: 'B', value: 2 },
        { key: 'c', label: 'C', value: 3 },
      ]),
      'byState',
    );

    const sum = breakdown!.slices.reduce((total, slice) => total + slice.share, 0);
    expect(sum).toBeCloseTo(100, 10);
  });

  /**
   * Past six, slices are too thin to read and the validated palette runs out of safe hues —
   * so the tail folds into one neutral "Outras" rather than inventing a seventh colour.
   */
  it('folds everything past the sixth slice into a single remainder', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      key: `k${index}`,
      label: `K${index}`,
      value: 10 - index,
    }));

    const breakdown = selectBreakdown(stateWith(many), 'byState');

    expect(breakdown?.slices).toHaveLength(MAX_SLICES + 1);

    const last = breakdown!.slices.at(-1)!;
    expect(last.isOther).toBe(true);
    expect(last.label).toBe('Outras (3)');
    // Values run 10 down to 2; the six largest are kept, so the tail is 4 + 3 + 2.
    expect(last.value).toBe(9);
  });

  it('does not fold when there is nothing to fold', () => {
    const six = Array.from({ length: MAX_SLICES }, (_, index) => ({
      key: `k${index}`,
      label: `K${index}`,
      value: 10,
    }));

    const breakdown = selectBreakdown(stateWith(six), 'byState');

    expect(breakdown?.slices).toHaveLength(MAX_SLICES);
    expect(breakdown?.slices.some((slice) => slice.isOther)).toBe(false);
  });

  it('returns no slices for an all-zero breakdown rather than dividing by zero', () => {
    const breakdown = selectBreakdown(stateWith([{ key: 'a', label: 'A', value: 0 }]), 'byState');

    expect(breakdown?.slices).toEqual([]);
    expect(breakdown?.total).toBe(0);
  });

  it('carries the unit the server declared', () => {
    const state = stateWith([{ key: 'mg', label: 'MG', value: 1 }]);

    expect(selectBreakdown(state, 'byState')?.unit).toBe('hectares');
    expect(selectBreakdown(state, 'byCrop')?.unit).toBe('count');
  });
});

describe('selectLandUseTotal', () => {
  /** SC-007: exact integer equality, not a tolerance. */
  it('sums the land-use slices to the registry total exactly', () => {
    const state = stateWith([]);

    expect(selectLandUseTotal(state)).toBe(150011);
    expect(selectLandUseTotal(state)).toBe(state.dashboard.summary!.totals.hectares);
  });
});
