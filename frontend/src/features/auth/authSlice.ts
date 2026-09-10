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
import { clearSession, readSession, toSession, writeSession } from './sessionStorage';
import type { Credentials, Session } from './types';

export type AuthState = {
  session: Session | null;
  /** Starts pending: the app does not yet know whether it has a session. */
  bootstrap: RequestState;
  signIn: RequestState;
  signUp: RequestState;
};

const initialState: AuthState = {
  session: null,
  bootstrap: { ...initialRequestState, status: 'pending' },
  signIn: { ...initialRequestState },
  signUp: { ...initialRequestState },
};

/**
 * Dispatched by the sign-out button, by the http client on any 401, and by the cross-tab storage
 * listener. The root reducer resets every slice on it, so no cached server data outlives a
 * session (FR-047).
 *
 * Declared with createAction rather than inside the slice because store.ts needs its type
 * without importing the slice's reducers — which would be a cycle.
 */
export const sessionCleared = createAction('auth/sessionCleared');

/** Rejections carry the whole failure so a form can bind `details` to its fields. */
function fail(error: unknown): ApiFailure {
  return toFailure(error, 'Algo deu errado. Tente novamente.');
}

/**
 * Puts a stored session into the store before it has been verified.
 *
 * This has to happen first: the http client reads the token from the store, so calling
 * /auth/me before restoring would send the request unauthenticated, get a 401, and sign the
 * visitor out on every single reload — exactly the failure FR-013 forbids.
 */
export const sessionRestored = createAction<Session>('auth/sessionRestored');

/**
 * Start-up: restore the stored token, then confirm it with the server before painting protected
 * content. A 401 here is the ordinary "your session ended" path, not an error to display.
 */
export const bootstrapSession = createAsyncThunk<Session | null, void, { state: unknown }>(
  'auth/bootstrap',
  async (_, { dispatch }) => {
    const stored = readSession();
    if (!stored) return null;

    dispatch(sessionRestored(stored));

    try {
      const user = await api.fetchCurrentUser();
      return { ...stored, user };
    } catch {
      clearSession();
      return null;
    }
  },
);

export const signIn = createAsyncThunk<Session, Credentials, { rejectValue: ApiFailure }>(
  'auth/signIn',
  async (credentials, { rejectWithValue }) => {
    try {
      const session = toSession(await api.login(credentials));
      writeSession(session);
      return session;
    } catch (error) {
      return rejectWithValue(fail(error));
    }
  },
);

/**
 * FR-012: registration returns the user but no token, so the visitor would otherwise have to
 * type the same credentials twice. They are held for exactly this one chained call and then go
 * out of scope — never stored, never logged (Principle V).
 */
export const signUp = createAsyncThunk<Session, Credentials, { rejectValue: ApiFailure }>(
  'auth/signUp',
  async (credentials, { rejectWithValue }) => {
    try {
      await api.register(credentials);
      const session = toSession(await api.login(credentials));
      writeSession(session);
      return session;
    } catch (error) {
      return rejectWithValue(fail(error));
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sessionRestored, (state, action) => {
        state.session = action.payload;
      })

      /*
       * Bootstrap is the one request that does NOT check requestId before settling.
       *
       * A 401 during bootstrap dispatches sessionCleared, which resets this slice — wiping the
       * recorded requestId. A guard here would then discard the very response that settles
       * start-up, leaving the app on its skeleton forever with no way out. Everywhere else a
       * stale response is merely wrong; here, ignoring it is fatal.
       */
      .addCase(bootstrapSession.pending, (state, action) => {
        requestPending(state.bootstrap, action.meta.requestId);
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.session = action.payload;
        requestSucceeded(state.bootstrap);
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.session = null;
        requestSucceeded(state.bootstrap);
      })

      .addCase(signIn.pending, (state, action) => {
        requestPending(state.signIn, action.meta.requestId);
      })
      .addCase(signIn.fulfilled, (state, action) => {
        if (!isCurrent(state.signIn, action.meta.requestId)) return;
        state.session = action.payload;
        requestSucceeded(state.signIn);
      })
      .addCase(signIn.rejected, (state, action) => {
        if (!isCurrent(state.signIn, action.meta.requestId)) return;
        requestFailed(state.signIn, action.payload?.message ?? 'Não foi possível entrar.');
      })

      .addCase(signUp.pending, (state, action) => {
        requestPending(state.signUp, action.meta.requestId);
      })
      .addCase(signUp.fulfilled, (state, action) => {
        if (!isCurrent(state.signUp, action.meta.requestId)) return;
        state.session = action.payload;
        requestSucceeded(state.signUp);
      })
      .addCase(signUp.rejected, (state, action) => {
        if (!isCurrent(state.signUp, action.meta.requestId)) return;
        requestFailed(state.signUp, action.payload?.message ?? 'Não foi possível criar a conta.');
      });
  },
});

export const authReducer = authSlice.reducer;

/**
 * Discards the stored token, then lets the root reducer wipe the rest of the store. Exported as
 * a thunk so callers dispatch one thing and the storage side effect cannot be forgotten.
 */
export const signOut = () => (dispatch: (action: unknown) => void) => {
  clearSession();
  dispatch(sessionCleared());
};
