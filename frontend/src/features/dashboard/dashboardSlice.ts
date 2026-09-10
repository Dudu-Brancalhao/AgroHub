import { createAction, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { toFailure } from '../../lib/httpClient';
import type { ApiFailure } from '../../lib/httpClient';
import {
  initialRequestState,
  isCurrent,
  requestFailed,
  requestPending,
  requestSucceeded,
} from '../../app/requestState';
import type { RequestState } from '../../app/requestState';
import * as api from './api';
import type { RegistrySummary } from './types';

export type DashboardState = {
  summary: RegistrySummary | null;
  request: RequestState;
  /** Set by any successful mutation anywhere in the app. */
  stale: boolean;
};

const initialState: DashboardState = {
  summary: null,
  request: { ...initialRequestState },
  stale: false,
};

/**
 * How FR-045 reaches a screen that is not mounted.
 *
 * Every mutating thunk in every slice dispatches this; the Dashboard re-fetches on mount when it
 * is stale. Deliberately not a poll and not a re-fetch on every visit — flipping between
 * destinations without changing anything should not re-issue the query.
 */
export const registryChanged = createAction('dashboard/registryChanged');

export const fetchSummary = createAsyncThunk<RegistrySummary, void, { rejectValue: ApiFailure }>(
  'dashboard/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      return await api.fetchSummary();
    } catch (error) {
      return rejectWithValue(toFailure(error, 'Não foi possível carregar o painel.'));
    }
  },
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(registryChanged, (state) => {
        state.stale = true;
      })
      .addCase(fetchSummary.pending, (state, action) => {
        requestPending(state.request, action.meta.requestId);
      })
      .addCase(fetchSummary.fulfilled, (state, action) => {
        if (!isCurrent(state.request, action.meta.requestId)) return;
        state.summary = action.payload;
        state.stale = false;
        requestSucceeded(state.request);
      })
      .addCase(fetchSummary.rejected, (state, action) => {
        if (!isCurrent(state.request, action.meta.requestId)) return;
        requestFailed(state.request, action.payload?.message ?? 'Não foi possível carregar o painel.');
      });
  },
});

export const dashboardReducer = dashboardSlice.reducer;
