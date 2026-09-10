import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
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
import { registryChanged } from '../dashboard/dashboardSlice';
import { toastShown } from '../ui/uiSlice';
import * as api from './api';
import { fetchProperty } from '../properties/api';
import type { Crop } from '../producers/types';
import type { Harvest } from './types';

export type HarvestsState = {
  items: Harvest[];
  request: RequestState;
  detail: {
    id: string | null;
    crops: Crop[];
    /** propertyId -> farm name, resolved per season (see fetchHarvestCrops). */
    farmNames: Record<string, string>;
    request: RequestState;
  };
  mutation: RequestState;
};

const initialState: HarvestsState = {
  items: [],
  request: { ...initialRequestState },
  detail: { id: null, crops: [], farmNames: {}, request: { ...initialRequestState } },
  mutation: { ...initialRequestState },
};

/** Rejections carry the whole failure so a form can bind `details` to its fields (FR-041). */
function fail(error: unknown, fallback: string): ApiFailure {
  return toFailure(error, fallback);
}

/**
 * Loaded by the Safras screen *and* by the producer detail screen, which needs it to populate
 * the planting form's season selector. Fetched once and shared — a second copy inside the
 * producers slice would violate FR-043.
 */
export const fetchHarvests = createAsyncThunk<Harvest[], void, { rejectValue: ApiFailure }>(
  'harvests/fetchList',
  async (_, { rejectWithValue }) => {
    try {
      return await api.listHarvests();
    } catch (error) {
      return rejectWithValue(fail(error, 'Não foi possível carregar as safras.'));
    }
  },
);

type HarvestCrops = { crops: Crop[]; farmNames: Record<string, string> };

/**
 * The crops of a season, plus the name of each farm that planted them.
 *
 * The crops payload carries `propertyId` but not the farm's name, so the names are resolved with
 * one read per distinct farm (operation 11). Bounded by the number of farms planting in a single
 * season, and it is the difference between a readable screen and a list of UUID fragments.
 *
 * A farm that cannot be read is simply left unnamed rather than failing the whole screen — the
 * plantings are still worth showing.
 */
export const fetchHarvestCrops = createAsyncThunk<
  HarvestCrops,
  string,
  { rejectValue: ApiFailure }
>('harvests/fetchCrops', async (harvestId, { rejectWithValue }) => {
  try {
    const crops = await api.listCropsByHarvest(harvestId);
    const propertyIds = [...new Set(crops.map((crop) => crop.propertyId))];

    const farms = await Promise.all(
      propertyIds.map((id) =>
        fetchProperty(id)
          .then((property) => [id, property.farmName] as const)
          .catch(() => null),
      ),
    );

    return {
      crops,
      farmNames: Object.fromEntries(farms.filter((entry) => entry !== null)),
    };
  } catch (error) {
    return rejectWithValue(fail(error, 'Não foi possível carregar os plantios.'));
  }
});

export const createHarvest = createAsyncThunk<Harvest, number, { rejectValue: ApiFailure }>(
  'harvests/create',
  async (year, { dispatch, rejectWithValue }) => {
    try {
      const harvest = await api.createHarvest(year);
      void dispatch(fetchHarvests());
      dispatch(registryChanged());
      dispatch(toastShown('success', `Safra ${year} cadastrada.`));
      return harvest;
    } catch (error) {
      return rejectWithValue(fail(error, 'Não foi possível cadastrar a safra.'));
    }
  },
);

export const updateHarvest = createAsyncThunk<
  Harvest,
  { id: string; year: number },
  { rejectValue: ApiFailure }
>('harvests/update', async ({ id, year }, { dispatch, rejectWithValue }) => {
  try {
    const harvest = await api.updateHarvest(id, year);
    void dispatch(fetchHarvests());
    dispatch(registryChanged());
    dispatch(toastShown('success', 'Safra atualizada.'));
    return harvest;
  } catch (error) {
    return rejectWithValue(fail(error, 'Não foi possível salvar a safra.'));
  }
});

export const deleteHarvest = createAsyncThunk<string, string, { rejectValue: ApiFailure }>(
  'harvests/delete',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      await api.deleteHarvest(id);
      void dispatch(fetchHarvests());
      dispatch(registryChanged());
      dispatch(toastShown('success', 'Safra excluída.'));
      return id;
    } catch (error) {
      // A 409 here means the season is in use. The server's own message names how many plantings
      // are blocking it, so it is passed through rather than replaced (FR-041).
      return rejectWithValue(fail(error, 'Não foi possível excluir a safra.'));
    }
  },
);

const MUTATIONS = [createHarvest, updateHarvest, deleteHarvest];

const harvestsSlice = createSlice({
  name: 'harvests',
  initialState,
  reducers: {
    mutationErrorCleared(state) {
      state.mutation = { ...initialRequestState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHarvests.pending, (state, action) => {
        requestPending(state.request, action.meta.requestId);
      })
      .addCase(fetchHarvests.fulfilled, (state, action) => {
        if (!isCurrent(state.request, action.meta.requestId)) return;
        // Newest first: a user adding this year's safra should see it at the top.
        state.items = [...action.payload].sort((a, b) => b.year - a.year);
        requestSucceeded(state.request);
      })
      .addCase(fetchHarvests.rejected, (state, action) => {
        if (!isCurrent(state.request, action.meta.requestId)) return;
        requestFailed(state.request, action.payload?.message ?? 'Não foi possível carregar as safras.');
      })

      .addCase(fetchHarvestCrops.pending, (state, action) => {
        state.detail.id = action.meta.arg;
        requestPending(state.detail.request, action.meta.requestId);
      })
      .addCase(fetchHarvestCrops.fulfilled, (state, action) => {
        if (!isCurrent(state.detail.request, action.meta.requestId)) return;
        state.detail.crops = action.payload.crops;
        state.detail.farmNames = action.payload.farmNames;
        requestSucceeded(state.detail.request);
      })
      .addCase(fetchHarvestCrops.rejected, (state, action) => {
        if (!isCurrent(state.detail.request, action.meta.requestId)) return;
        state.detail.crops = [];
        state.detail.farmNames = {};
        requestFailed(state.detail.request, action.payload?.message ?? 'Não foi possível carregar.');
      });

    for (const mutation of MUTATIONS) {
      builder
        .addCase(mutation.pending, (state, action) => {
          requestPending(state.mutation, action.meta.requestId);
        })
        .addCase(mutation.fulfilled, (state, action) => {
          if (!isCurrent(state.mutation, action.meta.requestId)) return;
          requestSucceeded(state.mutation);
        })
        .addCase(mutation.rejected, (state, action) => {
          if (!isCurrent(state.mutation, action.meta.requestId)) return;
          requestFailed(state.mutation, action.payload?.message ?? 'Não foi possível salvar.');
        });
    }
  },
});

export const { mutationErrorCleared } = harvestsSlice.actions;
export const harvestsReducer = harvestsSlice.reducer;
