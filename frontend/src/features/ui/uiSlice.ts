import { createSlice, nanoid } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

/** The only slice holding no server data. */

export type ToastKind = 'success' | 'error';

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

export type UiState = {
  toasts: Toast[];
  /** Mobile only — the desktop sidebar is always visible (FR-007). */
  sidebarOpen: boolean;
};

const initialState: UiState = {
  toasts: [],
  sidebarOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toastShown: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload);
      },
      prepare(kind: ToastKind, message: string) {
        return { payload: { id: nanoid(), kind, message } };
      },
    },

    toastDismissed(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },

    sidebarToggled(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },

    sidebarClosed(state) {
      state.sidebarOpen = false;
    },

    /**
     * Dispatched on every navigation so the mobile menu never sits over the content the visitor
     * just asked for.
     */
    navigated(state) {
      state.sidebarOpen = false;
    },
  },
});

export const { toastShown, toastDismissed, sidebarToggled, sidebarClosed, navigated } =
  uiSlice.actions;

export const uiReducer = uiSlice.reducer;
