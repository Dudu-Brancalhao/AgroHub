/**
 * The one request-state pattern every slice repeats (contracts/store.md).
 *
 * Screens render from `status`, never from whether data happens to be null: "not loaded yet" and
 * "loaded and genuinely empty" are different screens — a skeleton versus an empty state — and
 * only `status` tells them apart.
 */

export type RequestStatus = 'idle' | 'pending' | 'succeeded' | 'failed';

export type RequestState = {
  status: RequestStatus;
  /** A pt-BR message, ready to render. Never a raw envelope (SC-006). */
  error: string | null;
  /** The latest dispatched request. Older ones are ignored — see `isCurrent`. */
  requestId: string | null;
};

export const initialRequestState: RequestState = {
  status: 'idle',
  error: null,
  requestId: null,
};

export function requestPending(state: RequestState, requestId: string): void {
  state.status = 'pending';
  state.error = null;
  state.requestId = requestId;
}

export function requestSucceeded(state: RequestState): void {
  state.status = 'succeeded';
  state.error = null;
  state.requestId = null;
}

export function requestFailed(state: RequestState, error: string): void {
  state.status = 'failed';
  state.error = error;
  state.requestId = null;
}

/**
 * How FR-046 is satisfied.
 *
 * A slice records the requestId of the latest in-flight request; a fulfilled or rejected action
 * whose requestId no longer matches belongs to a request the user has already navigated away
 * from, and applying it would repaint the current screen with stale data.
 */
export function isCurrent(state: RequestState, requestId: string): boolean {
  return state.requestId === requestId;
}
