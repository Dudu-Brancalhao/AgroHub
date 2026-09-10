import { producersReducer, fetchProducer, fetchProducers } from './producersSlice';
import type { ProducersState } from './producersSlice';
import type { Producer, ProducerDetail } from './types';

const producer: Producer = {
  id: 'p1',
  document: '52998224725',
  documentType: 'CPF',
  name: 'José Antônio de Almeida',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const detail: ProducerDetail = { ...producer, properties: [] };

const idle = { status: 'idle' as const, error: null, requestId: null };

const initial: ProducersState = {
  list: { items: [], total: 0, page: 1, pageSize: 20, search: '', request: { ...idle } },
  detail: { id: null, producer: null, request: { ...idle } },
  mutation: { ...idle },
};

const listPending = (requestId: string) => ({
  type: fetchProducers.pending.type,
  meta: { requestId, arg: { page: 1, pageSize: 20, search: '' } },
});

const listFulfilled = (requestId: string, items: Producer[], search = '') => ({
  type: fetchProducers.fulfilled.type,
  payload: { data: items, total: items.length, page: 1, pageSize: 20, search },
  meta: { requestId, arg: { page: 1, pageSize: 20, search } },
});

const detailPending = (requestId: string, id: string) => ({
  type: fetchProducer.pending.type,
  meta: { requestId, arg: id },
});

const detailFulfilled = (requestId: string, id: string, payload: ProducerDetail) => ({
  type: fetchProducer.fulfilled.type,
  payload,
  meta: { requestId, arg: id },
});

describe('producersSlice list', () => {
  it('moves pending -> succeeded and stores the page', () => {
    let state = producersReducer(initial, listPending('r1'));
    expect(state.list.request.status).toBe('pending');

    state = producersReducer(state, listFulfilled('r1', [producer]));

    expect(state.list.items).toEqual([producer]);
    expect(state.list.total).toBe(1);
    expect(state.list.request.status).toBe('succeeded');
  });

  it('remembers the search term the results belong to', () => {
    let state = producersReducer(initial, listPending('r1'));
    state = producersReducer(state, listFulfilled('r1', [], 'jose'));

    expect(state.list.search).toBe('jose');
  });

  /** FR-046: a slower earlier search must not overwrite the results of a later one. */
  it('ignores a page whose requestId is stale', () => {
    let state = producersReducer(initial, listPending('current'));
    state = producersReducer(state, listFulfilled('stale', [producer]));

    expect(state.list.items).toEqual([]);
    expect(state.list.request.status).toBe('pending');
  });
});

describe('producersSlice detail', () => {
  it('records the id being loaded straight away', () => {
    const state = producersReducer(initial, detailPending('r1', 'p1'));

    expect(state.detail.id).toBe('p1');
    expect(state.detail.request.status).toBe('pending');
  });

  it('stores the producer with its nested farms', () => {
    let state = producersReducer(initial, detailPending('r1', 'p1'));
    state = producersReducer(state, detailFulfilled('r1', 'p1', detail));

    expect(state.detail.producer).toEqual(detail);
    expect(state.detail.request.status).toBe('succeeded');
  });

  /**
   * The list must stay on screen behind a producer being opened. Separate request states are
   * what make that possible (contracts/store.md).
   */
  it('keeps the list intact while the detail loads', () => {
    let state = producersReducer(initial, listPending('r1'));
    state = producersReducer(state, listFulfilled('r1', [producer]));
    state = producersReducer(state, detailPending('r2', 'p1'));

    expect(state.list.items).toEqual([producer]);
    expect(state.list.request.status).toBe('succeeded');
    expect(state.detail.request.status).toBe('pending');
  });

  it('ignores a detail response whose requestId is stale', () => {
    let state = producersReducer(initial, detailPending('current', 'p1'));
    state = producersReducer(state, detailFulfilled('stale', 'p1', detail));

    expect(state.detail.producer).toBeNull();
  });

  it('clears the producer when the load fails, so no stale record is shown', () => {
    let state = producersReducer(initial, detailPending('r1', 'p1'));
    state = producersReducer(state, detailFulfilled('r1', 'p1', detail));
    state = producersReducer(state, detailPending('r2', 'p2'));
    state = producersReducer(state, {
      type: fetchProducer.rejected.type,
      payload: { statusCode: 404, message: 'Produtor não encontrado.' },
      meta: { requestId: 'r2', arg: 'p2' },
    });

    expect(state.detail.producer).toBeNull();
    expect(state.detail.request.error).toBe('Produtor não encontrado.');
  });
});
