import { makeTestStore } from '../test/renderWithProviders';
import { sessionCleared } from '../features/auth/authSlice';
import { toastShown } from '../features/ui/uiSlice';

/**
 * FR-047: signing out must clear all cached server data, so a subsequent sign-in as another
 * account shows no trace of the previous one.
 *
 * Asserted at the root rather than per slice, because that is where the reset lives — and
 * because the point of putting it there is that a slice added later cannot forget to
 * participate. This test would catch a slice registered outside the wrapped root reducer.
 */
describe('root reducer on sessionCleared', () => {
  it('returns every slice to its initial state', () => {
    const store = makeTestStore({
      auth: {
        session: {
          accessToken: 'token',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          user: { id: 'u1', email: 'demo@agrohub.com.br', createdAt: '2026-01-01T00:00:00.000Z' },
        },
        bootstrap: { status: 'succeeded', error: null, requestId: null },
        signIn: { status: 'succeeded', error: null, requestId: null },
        signUp: { status: 'idle', error: null, requestId: null },
      },
      dashboard: {
        summary: {
          totals: { farms: 4, hectares: 150011 },
          byState: { unit: 'count', categories: [{ key: 'MG', label: 'MG', value: 4 }] },
          byCrop: { unit: 'hectares', categories: [] },
          byLandUse: { unit: 'hectares', categories: [] },
        },
        request: { status: 'succeeded', error: null, requestId: null },
        stale: true,
      },
      harvests: {
        items: [{ id: 'h1', year: 2021, createdAt: '', updatedAt: '' }],
        request: { status: 'succeeded', error: null, requestId: null },
        detail: {
          id: 'h1',
          crops: [],
          farmNames: {},
          request: { status: 'idle', error: null, requestId: null },
        },
        mutation: { status: 'idle', error: null, requestId: null },
      },
    });

    // Something in the UI slice too, so the reset is not only about server data.
    store.dispatch(toastShown('success', 'Produtor cadastrado.'));

    store.dispatch(sessionCleared());
    const state = store.getState();

    expect(state.auth.session).toBeNull();
    expect(state.dashboard.summary).toBeNull();
    expect(state.dashboard.stale).toBe(false);
    expect(state.harvests.items).toEqual([]);
    expect(state.harvests.detail.id).toBeNull();
    expect(state.producers.list.items).toEqual([]);
    expect(state.producers.detail.producer).toBeNull();
    expect(state.ui.toasts).toEqual([]);
  });

  it('leaves the store usable afterwards', () => {
    const store = makeTestStore();

    store.dispatch(sessionCleared());
    store.dispatch(toastShown('success', 'Tudo certo.'));

    expect(store.getState().ui.toasts).toHaveLength(1);
  });
});
