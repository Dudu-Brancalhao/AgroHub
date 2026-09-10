import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import type { Action, Reducer } from '@reduxjs/toolkit';
import type { ReactElement, ReactNode } from 'react';
import { theme } from '../styles/theme';
import { uiReducer } from '../features/ui/uiSlice';
import { authReducer, sessionCleared } from '../features/auth/authSlice';
import { dashboardReducer } from '../features/dashboard/dashboardSlice';
import { producersReducer } from '../features/producers/producersSlice';
import { harvestsReducer } from '../features/harvests/harvestsSlice';
import type { RootState } from '../app/store';

const combined = combineReducers({
  auth: authReducer,
  dashboard: dashboardReducer,
  producers: producersReducer,
  harvests: harvestsReducer,
  ui: uiReducer,
});

const rootReducer: Reducer<RootState> = (state, action: Action) =>
  action.type === sessionCleared.type ? combined(undefined, action) : combined(state, action);

/**
 * A fresh store per test — never a shared one. Principle IV requires tests to be independently
 * runnable in any order, and a module-level store would leak state between them.
 */
export function makeTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
  });
}

export type TestStore = ReturnType<typeof makeTestStore>;

type Options = Omit<RenderOptions, 'wrapper'> & {
  preloadedState?: Partial<RootState>;
  store?: TestStore;
  route?: string;
};

export function renderWithProviders(
  ui: ReactElement,
  { preloadedState, store = makeTestStore(preloadedState), route = '/', ...options }: Options = {},
): RenderResult & { store: TestStore } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </ThemeProvider>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** A signed-in session, for the many tests that need one but are not testing auth. */
export const signedInState = {
  auth: {
    session: {
      accessToken: 'test-token',
      tokenType: 'Bearer' as const,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 'user-1', email: 'demo@agrohub.com.br', createdAt: '2026-01-01T00:00:00.000Z' },
    },
    bootstrap: { status: 'succeeded' as const, error: null, requestId: null },
    signIn: { status: 'idle' as const, error: null, requestId: null },
    signUp: { status: 'idle' as const, error: null, requestId: null },
  },
};
