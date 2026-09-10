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
import { pluralize } from '../../lib/format';
import * as api from './api';
import * as propertiesApi from '../properties/api';
import type {
  DeletionReport,
  PagedProducers,
  Producer,
  ProducerDetail,
  ProducerInput,
  PropertyInput,
  CropInput,
} from './types';

export type ProducersState = {
  list: {
    items: Producer[];
    total: number;
    page: number;
    pageSize: number;
    search: string;
    request: RequestState;
  };
  detail: {
    id: string | null;
    producer: ProducerDetail | null;
    request: RequestState;
  };
  /**
   * Shared by producer, farm and planting writes. Justified because only one dialog is open at a
   * time — the UI makes concurrent writes unreachable. If that stops being true, this is the
   * field to split (contracts/store.md).
   */
  mutation: RequestState;
};

const initialState: ProducersState = {
  list: {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    search: '',
    request: { ...initialRequestState },
  },
  detail: { id: null, producer: null, request: { ...initialRequestState } },
  mutation: { ...initialRequestState },
};

/** Rejections carry the whole failure so a form can bind `details` to its fields (FR-030). */
function fail(error: unknown, fallback: string): ApiFailure {
  return toFailure(error, fallback);
}

/** Turns a deletion report into a sentence naming what actually went (FR-051). */
function describeDeletion(report: DeletionReport): string {
  const parts: string[] = [];
  const { producers, properties, crops } = report.deleted;

  if (producers) parts.push(pluralize(producers, 'produtor', 'produtores'));
  if (properties) parts.push(pluralize(properties, 'fazenda', 'fazendas'));
  if (crops) parts.push(pluralize(crops, 'cultura', 'culturas'));

  return parts.length > 0 ? `Excluído: ${parts.join(', ')}.` : 'Registro excluído.';
}

export const fetchProducers = createAsyncThunk<
  PagedProducers & { search: string },
  api.ListParams,
  { rejectValue: ApiFailure }
>('producers/fetchList', async (params, { rejectWithValue }) => {
  try {
    const page = await api.listProducers(params);
    return { ...page, search: params.search };
  } catch (error) {
    return rejectWithValue(fail(error, 'Não foi possível carregar os produtores.'));
  }
});

export const fetchProducer = createAsyncThunk<ProducerDetail, string, { rejectValue: ApiFailure }>(
  'producers/fetchOne',
  async (id, { rejectWithValue }) => {
    try {
      return await api.fetchProducer(id);
    } catch (error) {
      return rejectWithValue(fail(error, 'Não foi possível carregar o produtor.'));
    }
  },
);

/**
 * Every mutating thunk below ends the same three ways: re-fetch the one query that owns the
 * changed data, mark the dashboard stale, and push a success toast (FR-045).
 *
 * Re-fetching rather than patching the producer -> properties -> harvests -> crops tree by hand
 * is what keeps this correct without RTK Query. One round trip on an action the user just
 * initiated, in exchange for never showing a stale screen (research.md R-009).
 */
function afterMutation(dispatch: (action: unknown) => unknown, producerId: string, message: string) {
  void dispatch(fetchProducer(producerId));
  dispatch(registryChanged());
  dispatch(toastShown('success', message));
}

export const createProducer = createAsyncThunk<Producer, ProducerInput, { rejectValue: ApiFailure }>(
  'producers/create',
  async (input, { dispatch, rejectWithValue }) => {
    try {
      const producer = await api.createProducer(input);
      dispatch(registryChanged());
      dispatch(toastShown('success', 'Produtor cadastrado.'));
      return producer;
    } catch (error) {
      return rejectWithValue(fail(error, 'Não foi possível cadastrar o produtor.'));
    }
  },
);

export const updateProducer = createAsyncThunk<
  Producer,
  { id: string; input: Partial<ProducerInput> },
  { rejectValue: ApiFailure }
>('producers/update', async ({ id, input }, { dispatch, rejectWithValue }) => {
  try {
    const producer = await api.updateProducer(id, input);
    afterMutation(dispatch, id, 'Produtor atualizado.');
    return producer;
  } catch (error) {
    return rejectWithValue(fail(error, 'Não foi possível salvar o produtor.'));
  }
});

export const deleteProducer = createAsyncThunk<string, string, { rejectValue: ApiFailure }>(
  'producers/delete',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      const report = await api.deleteProducer(id);
      dispatch(registryChanged());
      dispatch(toastShown('success', describeDeletion(report)));
      return id;
    } catch (error) {
      return rejectWithValue(fail(error, 'Não foi possível excluir o produtor.'));
    }
  },
);

/**
 * Farm and planting thunks live in this slice because their result invalidates the producer
 * detail, which this slice owns. Putting them elsewhere would mean reaching across slices to
 * invalidate — a dependency pointing the wrong way (Principle II).
 */
export const createProperty = createAsyncThunk<
  void,
  { producerId: string; input: PropertyInput },
  { rejectValue: ApiFailure }
>('producers/createProperty', async ({ producerId, input }, { dispatch, rejectWithValue }) => {
  try {
    await propertiesApi.createProperty(producerId, input);
    afterMutation(dispatch, producerId, 'Fazenda cadastrada.');
  } catch (error) {
    return rejectWithValue(fail(error, 'Não foi possível cadastrar a fazenda.'));
  }
});

export const updateProperty = createAsyncThunk<
  void,
  { producerId: string; id: string; input: Partial<PropertyInput> },
  { rejectValue: ApiFailure }
>('producers/updateProperty', async ({ producerId, id, input }, { dispatch, rejectWithValue }) => {
  try {
    await propertiesApi.updateProperty(id, input);
    afterMutation(dispatch, producerId, 'Fazenda atualizada.');
  } catch (error) {
    return rejectWithValue(fail(error, 'Não foi possível salvar a fazenda.'));
  }
});

export const deleteProperty = createAsyncThunk<
  void,
  { producerId: string; id: string },
  { rejectValue: ApiFailure }
>('producers/deleteProperty', async ({ producerId, id }, { dispatch, rejectWithValue }) => {
  try {
    const report = await propertiesApi.deleteProperty(id);
    afterMutation(dispatch, producerId, describeDeletion(report));
  } catch (error) {
    return rejectWithValue(fail(error, 'Não foi possível excluir a fazenda.'));
  }
});

export const createCrop = createAsyncThunk<
  void,
  { producerId: string; propertyId: string; input: CropInput },
  { rejectValue: ApiFailure }
>(
  'producers/createCrop',
  async ({ producerId, propertyId, input }, { dispatch, rejectWithValue }) => {
    try {
      await propertiesApi.createCrop(propertyId, input);
      afterMutation(dispatch, producerId, 'Cultura registrada.');
    } catch (error) {
      return rejectWithValue(fail(error, 'Não foi possível registrar a cultura.'));
    }
  },
);

export const deleteCrop = createAsyncThunk<
  void,
  { producerId: string; id: string },
  { rejectValue: ApiFailure }
>('producers/deleteCrop', async ({ producerId, id }, { dispatch, rejectWithValue }) => {
  try {
    await propertiesApi.deleteCrop(id);
    afterMutation(dispatch, producerId, 'Cultura removida.');
  } catch (error) {
    return rejectWithValue(fail(error, 'Não foi possível remover a cultura.'));
  }
});

const MUTATIONS = [
  createProducer,
  updateProducer,
  deleteProducer,
  createProperty,
  updateProperty,
  deleteProperty,
  createCrop,
  deleteCrop,
];

const producersSlice = createSlice({
  name: 'producers',
  initialState,
  reducers: {
    mutationErrorCleared(state) {
      state.mutation = { ...initialRequestState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducers.pending, (state, action) => {
        requestPending(state.list.request, action.meta.requestId);
      })
      .addCase(fetchProducers.fulfilled, (state, action) => {
        if (!isCurrent(state.list.request, action.meta.requestId)) return;
        state.list.items = action.payload.data;
        state.list.total = action.payload.total;
        state.list.page = action.payload.page;
        state.list.pageSize = action.payload.pageSize;
        state.list.search = action.payload.search;
        requestSucceeded(state.list.request);
      })
      .addCase(fetchProducers.rejected, (state, action) => {
        if (!isCurrent(state.list.request, action.meta.requestId)) return;
        requestFailed(state.list.request, action.payload?.message ?? 'Não foi possível carregar.');
      })

      .addCase(fetchProducer.pending, (state, action) => {
        // The id is recorded immediately so the screen can tell "loading a different producer"
        // from "showing the one already loaded" and render a skeleton rather than stale data.
        state.detail.id = action.meta.arg;
        requestPending(state.detail.request, action.meta.requestId);
      })
      .addCase(fetchProducer.fulfilled, (state, action) => {
        if (!isCurrent(state.detail.request, action.meta.requestId)) return;
        state.detail.producer = action.payload;
        requestSucceeded(state.detail.request);
      })
      .addCase(fetchProducer.rejected, (state, action) => {
        if (!isCurrent(state.detail.request, action.meta.requestId)) return;
        state.detail.producer = null;
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

export const { mutationErrorCleared } = producersSlice.actions;
export const producersReducer = producersSlice.reducer;
