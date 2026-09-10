import { harvestsReducer, fetchHarvestCrops, fetchHarvests } from './harvestsSlice';
import type { HarvestsState } from './harvestsSlice';
import type { Harvest } from './types';
import { validateHarvestYear } from './yearValidation';

const idle = { status: 'idle' as const, error: null, requestId: null };

const initial: HarvestsState = {
  items: [],
  request: { ...idle },
  detail: { id: null, crops: [], farmNames: {}, request: { ...idle } },
  mutation: { ...idle },
};

const harvests: Harvest[] = [
  { id: 'h1', year: 2021, createdAt: '', updatedAt: '' },
  { id: 'h2', year: 2023, createdAt: '', updatedAt: '' },
  { id: 'h3', year: 2022, createdAt: '', updatedAt: '' },
];

const listPending = (requestId: string) => ({
  type: fetchHarvests.pending.type,
  meta: { requestId, arg: undefined },
});

const listFulfilled = (requestId: string, payload: Harvest[]) => ({
  type: fetchHarvests.fulfilled.type,
  payload,
  meta: { requestId, arg: undefined },
});

describe('harvestsSlice list', () => {
  it('moves pending -> succeeded and orders seasons newest first', () => {
    let state = harvestsReducer(initial, listPending('r1'));
    state = harvestsReducer(state, listFulfilled('r1', harvests));

    expect(state.items.map((h) => h.year)).toEqual([2023, 2022, 2021]);
    expect(state.request.status).toBe('succeeded');
  });

  it('keeps the pt-BR message on failure', () => {
    let state = harvestsReducer(initial, listPending('r1'));
    state = harvestsReducer(state, {
      type: fetchHarvests.rejected.type,
      payload: { statusCode: 500, message: 'Não foi possível carregar as safras.' },
      meta: { requestId: 'r1', arg: undefined },
    });

    expect(state.request.status).toBe('failed');
    expect(state.request.error).toBe('Não foi possível carregar as safras.');
  });

  it('ignores a list whose requestId is stale', () => {
    let state = harvestsReducer(initial, listPending('current'));
    state = harvestsReducer(state, listFulfilled('stale', harvests));

    expect(state.items).toEqual([]);
  });
});

describe('harvestsSlice detail', () => {
  it('records the season being opened and stores its plantings', () => {
    let state = harvestsReducer(initial, {
      type: fetchHarvestCrops.pending.type,
      meta: { requestId: 'r1', arg: 'h1' },
    });

    expect(state.detail.id).toBe('h1');

    state = harvestsReducer(state, {
      type: fetchHarvestCrops.fulfilled.type,
      payload: {
        crops: [
          { id: 'c1', propertyId: 'f1', harvestId: 'h1', name: 'Soja', createdAt: '', updatedAt: '' },
        ],
        farmNames: { f1: 'Fazenda Santa Helena' },
      },
      meta: { requestId: 'r1', arg: 'h1' },
    });

    expect(state.detail.crops).toHaveLength(1);
    expect(state.detail.farmNames).toEqual({ f1: 'Fazenda Santa Helena' });
    expect(state.detail.request.status).toBe('succeeded');
  });

  it('keeps the list intact while a season detail loads', () => {
    let state = harvestsReducer(initial, listPending('r1'));
    state = harvestsReducer(state, listFulfilled('r1', harvests));
    state = harvestsReducer(state, {
      type: fetchHarvestCrops.pending.type,
      meta: { requestId: 'r2', arg: 'h1' },
    });

    expect(state.items).toHaveLength(3);
    expect(state.request.status).toBe('succeeded');
  });
});

describe('validateHarvestYear', () => {
  const now = new Date(2026, 8, 10);

  it('accepts a plausible year', () => {
    expect(validateHarvestYear('2021', now)).toBeNull();
  });

  /** The upper bound is current year + 1, computed rather than hard-coded. */
  it('accepts next year', () => {
    expect(validateHarvestYear('2027', now)).toBeNull();
  });

  it('refuses the year after next', () => {
    expect(validateHarvestYear('2028', now)).toBe('Informe um ano entre 1900 e 2027.');
  });

  it('refuses a year before 1900', () => {
    expect(validateHarvestYear('1899', now)).toBe('Informe um ano entre 1900 e 2027.');
  });

  it('refuses a non-integer', () => {
    expect(validateHarvestYear('2021.5', now)).toBe('O ano da safra deve ser um número inteiro.');
    expect(validateHarvestYear('abc', now)).toBe('O ano da safra deve ser um número inteiro.');
  });

  it('requires a value', () => {
    expect(validateHarvestYear('  ', now)).toBe('Informe o ano da safra.');
  });

  it('tracks the year boundary rather than hard-coding it', () => {
    // Built in local time, not from an ISO string: getFullYear() is local, so an ISO midnight
    // would land in the previous year west of UTC and make this test timezone-dependent.
    expect(validateHarvestYear('2028', new Date(2027, 0, 15))).toBeNull();
  });
});
