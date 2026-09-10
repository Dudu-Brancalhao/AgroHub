import { combineReducers, configureStore } from '@reduxjs/toolkit';
import type { Action, Reducer } from '@reduxjs/toolkit';
import { uiReducer } from '../features/ui/uiSlice';
import { authReducer, sessionCleared } from '../features/auth/authSlice';
import { dashboardReducer } from '../features/dashboard/dashboardSlice';
import { producersReducer } from '../features/producers/producersSlice';
import { harvestsReducer } from '../features/harvests/harvestsSlice';

const combined = combineReducers({
  auth: authReducer,
  dashboard: dashboardReducer,
  producers: producersReducer,
  harvests: harvestsReducer,
  ui: uiReducer,
});

export type RootState = ReturnType<typeof combined>;

/**
 * FR-047 in one place.
 *
 * Handing `undefined` state back to `combineReducers` makes every slice return its own initial
 * state, so signing out clears all cached server data at once. Done here rather than in each
 * slice so no future slice can forget to participate — the failure mode being a new account
 * seeing traces of the previous one.
 */
const rootReducer: Reducer<RootState> = (state, action: Action) => {
  if (action.type === sessionCleared.type) {
    return combined(undefined, action);
  }
  return combined(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  // Default middleware kept on purpose: the serializability and immutability checks are what
  // catch a Date or a class instance entering the store, which this state shape must not
  // tolerate (contracts/store.md).
});

export type AppStore = typeof store;
export type AppDispatch = typeof store.dispatch;
