import {
  navigated,
  sidebarClosed,
  sidebarToggled,
  toastDismissed,
  toastShown,
  uiReducer,
} from './uiSlice';
import type { UiState } from './uiSlice';

const initial: UiState = { toasts: [], sidebarOpen: false };

describe('uiSlice toasts', () => {
  it('adds a toast with a generated id', () => {
    const state = uiReducer(initial, toastShown('success', 'Produtor cadastrado.'));

    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0]).toMatchObject({ kind: 'success', message: 'Produtor cadastrado.' });
    expect(state.toasts[0]!.id).toEqual(expect.any(String));
  });

  it('keeps several toasts at once', () => {
    let state = uiReducer(initial, toastShown('success', 'Um'));
    state = uiReducer(state, toastShown('error', 'Dois'));

    expect(state.toasts).toHaveLength(2);
  });

  it('dismisses only the toast named', () => {
    let state = uiReducer(initial, toastShown('success', 'Um'));
    state = uiReducer(state, toastShown('error', 'Dois'));
    const firstId = state.toasts[0]!.id;

    state = uiReducer(state, toastDismissed(firstId));

    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0]!.message).toBe('Dois');
  });
});

describe('uiSlice sidebar', () => {
  it('toggles open and closed', () => {
    const opened = uiReducer(initial, sidebarToggled());
    expect(opened.sidebarOpen).toBe(true);

    const closed = uiReducer(opened, sidebarToggled());
    expect(closed.sidebarOpen).toBe(false);
  });

  it('closes explicitly', () => {
    const state = uiReducer({ ...initial, sidebarOpen: true }, sidebarClosed());
    expect(state.sidebarOpen).toBe(false);
  });

  /** FR-007: the menu must never stay over the content after a navigation. */
  it('closes on navigation', () => {
    const state = uiReducer({ ...initial, sidebarOpen: true }, navigated());
    expect(state.sidebarOpen).toBe(false);
  });
});
