import { dashboardReducer, fetchSummary, registryChanged } from './dashboardSlice';
import type { DashboardState } from './dashboardSlice';
import type { RegistrySummary } from './types';

const summary: RegistrySummary = {
  totals: { farms: 1, hectares: 150011 },
  byState: { unit: 'count', categories: [{ key: 'MG', label: 'MG', value: 1 }] },
  byCrop: { unit: 'hectares', categories: [{ key: 'soja', label: 'Soja', value: 150011 }] },
  byLandUse: {
    unit: 'hectares',
    categories: [
      { key: 'arable', label: 'Agricultável', value: 100000 },
      { key: 'vegetation', label: 'Vegetação', value: 50011 },
    ],
  },
};

const initial: DashboardState = {
  summary: null,
  request: { status: 'idle', error: null, requestId: null },
  stale: false,
};

const pending = (requestId: string) => ({
  type: fetchSummary.pending.type,
  meta: { requestId, arg: undefined },
});

const fulfilled = (requestId: string, payload: RegistrySummary) => ({
  type: fetchSummary.fulfilled.type,
  payload,
  meta: { requestId, arg: undefined },
});

const rejected = (requestId: string, message: string) => ({
  type: fetchSummary.rejected.type,
  payload: { statusCode: 500, message },
  meta: { requestId, arg: undefined },
});

describe('dashboardSlice', () => {
  it('moves idle -> pending -> succeeded and keeps the summary', () => {
    let state = dashboardReducer(initial, pending('r1'));
    expect(state.request.status).toBe('pending');

    state = dashboardReducer(state, fulfilled('r1', summary));

    expect(state.request.status).toBe('succeeded');
    expect(state.summary).toEqual(summary);
  });

  it('moves pending -> failed and keeps the pt-BR message', () => {
    let state = dashboardReducer(initial, pending('r1'));
    state = dashboardReducer(state, rejected('r1', 'Não foi possível carregar o painel.'));

    expect(state.request.status).toBe('failed');
    expect(state.request.error).toBe('Não foi possível carregar o painel.');
  });

  it('ignores a response whose requestId is stale', () => {
    let state = dashboardReducer(initial, pending('current'));
    state = dashboardReducer(state, fulfilled('stale', summary));

    expect(state.summary).toBeNull();
    expect(state.request.status).toBe('pending');
  });

  /** FR-045: a mutation anywhere marks the Dashboard for re-fetch, even while unmounted. */
  it('is marked stale by a mutation elsewhere', () => {
    const state = dashboardReducer({ ...initial, summary }, registryChanged());

    expect(state.stale).toBe(true);
    // The old figures stay on screen until the new ones arrive, rather than blanking.
    expect(state.summary).toEqual(summary);
  });

  it('clears stale once a re-fetch succeeds', () => {
    let state = dashboardReducer({ ...initial, summary }, registryChanged());
    state = dashboardReducer(state, pending('r2'));
    state = dashboardReducer(state, fulfilled('r2', summary));

    expect(state.stale).toBe(false);
  });
});
