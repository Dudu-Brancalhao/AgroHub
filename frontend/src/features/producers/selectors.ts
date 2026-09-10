import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

export const selectProducerList = (state: RootState) => state.producers.list;
export const selectProducerListRequest = (state: RootState) => state.producers.list.request;
export const selectProducerDetail = (state: RootState) => state.producers.detail;
export const selectProducerMutation = (state: RootState) => state.producers.mutation;

export const selectProducerFarms = (state: RootState) =>
  state.producers.detail.producer?.properties ?? [];

/**
 * Memoised because it computes; the plain field reads above are not, since memoising a property
 * access costs more than it saves.
 */
export const selectPageCount = createSelector([selectProducerList], ({ total, pageSize }) =>
  pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
);

/** A map of producer id -> name, for resolving farm ownership on the safra detail screen. */
export const selectFarmNamesById = createSelector([selectProducerFarms], (farms) =>
  Object.fromEntries(farms.map((farm) => [farm.id, farm.farmName])),
);
