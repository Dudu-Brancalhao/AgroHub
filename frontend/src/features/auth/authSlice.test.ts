import { authReducer, bootstrapSession, sessionRestored, signIn, signUp } from './authSlice';
import type { AuthState } from './authSlice';
import type { Session } from './types';

const session: Session = {
  accessToken: 'token-1',
  tokenType: 'Bearer',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  user: { id: 'u1', email: 'demo@agrohub.com.br', createdAt: '2026-01-01T00:00:00.000Z' },
};

const idle = { status: 'idle' as const, error: null, requestId: null };

function stateWith(overrides: Partial<AuthState> = {}): AuthState {
  return {
    session: null,
    bootstrap: { ...idle },
    signIn: { ...idle },
    signUp: { ...idle },
    ...overrides,
  };
}

function pendingAction(thunk: { pending: { type: string } }, requestId: string) {
  return { type: thunk.pending.type, meta: { requestId, arg: undefined } };
}

function fulfilledAction(
  thunk: { fulfilled: { type: string } },
  requestId: string,
  payload: unknown,
) {
  return { type: thunk.fulfilled.type, payload, meta: { requestId, arg: undefined } };
}

/** Rejections carry an ApiFailure, not a bare string, so a form can bind details to fields. */
function rejectedAction(
  thunk: { rejected: { type: string } },
  requestId: string,
  message?: string,
) {
  const payload = message === undefined ? undefined : { statusCode: 401, message };
  return { type: thunk.rejected.type, payload, meta: { requestId, arg: undefined } };
}

describe('authSlice bootstrap', () => {
  /**
   * Not `idle`: at start-up the app genuinely does not know whether it has a session, and the
   * guard must render a skeleton rather than flashing the sign-in screen (contracts/store.md).
   */
  it('starts pending rather than idle', () => {
    const state = authReducer(undefined, { type: '@@INIT' });

    expect(state.bootstrap.status).toBe('pending');
    expect(state.session).toBeNull();
  });

  it('stores the session it recovers', () => {
    let state = authReducer(stateWith(), pendingAction(bootstrapSession, 'r1'));
    state = authReducer(state, fulfilledAction(bootstrapSession, 'r1', session));

    expect(state.session).toEqual(session);
    expect(state.bootstrap.status).toBe('succeeded');
  });

  it('settles signed-out when there is nothing to recover', () => {
    let state = authReducer(stateWith(), pendingAction(bootstrapSession, 'r1'));
    state = authReducer(state, fulfilledAction(bootstrapSession, 'r1', null));

    expect(state.session).toBeNull();
    expect(state.bootstrap.status).toBe('succeeded');
  });

  it('treats a rejection as signed out, not as an error to display', () => {
    let state = authReducer(stateWith(), pendingAction(bootstrapSession, 'r1'));
    state = authReducer(state, rejectedAction(bootstrapSession, 'r1'));

    expect(state.session).toBeNull();
    expect(state.bootstrap.status).toBe('succeeded');
    expect(state.bootstrap.error).toBeNull();
  });

  /**
   * Restoring before verifying is what lets /auth/me carry the token: the http client reads it
   * from the store, so verifying first would send an unauthenticated request and sign the
   * visitor out on every reload (FR-013).
   */
  it('places the stored session in the store before it is verified', () => {
    let state = authReducer(undefined, { type: '@@INIT' });
    expect(state.session).toBeNull();

    state = authReducer(state, sessionRestored(session));

    expect(state.session).toEqual(session);
    // Still verifying: restoring the token is not the same as confirming it.
    expect(state.bootstrap.status).toBe('pending');
  });

  /**
   * The deadlock this guards against: a 401 during bootstrap resets the slice, wiping the
   * recorded requestId. If bootstrap checked it before settling, the response that ends
   * start-up would be discarded and the app would sit on its skeleton forever.
   */
  it('still settles after the slice was reset mid-flight', () => {
    let state = authReducer(stateWith(), pendingAction(bootstrapSession, 'r1'));

    // What sessionCleared does to this slice, via the root reducer.
    state = authReducer(undefined, { type: '@@reset' });
    expect(state.bootstrap.requestId).toBeNull();

    state = authReducer(state, fulfilledAction(bootstrapSession, 'r1', null));

    expect(state.bootstrap.status).toBe('succeeded');
  });
});

describe('authSlice signIn', () => {
  it('moves pending -> succeeded and keeps the session', () => {
    let state = authReducer(stateWith(), pendingAction(signIn, 'r1'));
    expect(state.signIn.status).toBe('pending');

    state = authReducer(state, fulfilledAction(signIn, 'r1', session));

    expect(state.signIn.status).toBe('succeeded');
    expect(state.session).toEqual(session);
  });

  it('moves pending -> failed and keeps the pt-BR message', () => {
    let state = authReducer(stateWith(), pendingAction(signIn, 'r1'));
    state = authReducer(state, rejectedAction(signIn, 'r1', 'E-mail ou senha inválidos.'));

    expect(state.signIn.status).toBe('failed');
    expect(state.signIn.error).toBe('E-mail ou senha inválidos.');
    expect(state.session).toBeNull();
  });

  /**
   * FR-046, and the rule most likely to regress silently: a response belonging to a request the
   * user has already moved on from must not repaint the current screen.
   */
  it('ignores a fulfilled action whose requestId is stale', () => {
    let state = authReducer(stateWith(), pendingAction(signIn, 'current'));
    state = authReducer(state, fulfilledAction(signIn, 'stale', session));

    expect(state.session).toBeNull();
    expect(state.signIn.status).toBe('pending');
  });

  it('ignores a rejected action whose requestId is stale', () => {
    let state = authReducer(stateWith(), pendingAction(signIn, 'current'));
    state = authReducer(state, rejectedAction(signIn, 'stale', 'Falhou.'));

    expect(state.signIn.status).toBe('pending');
    expect(state.signIn.error).toBeNull();
  });
});

describe('authSlice signUp', () => {
  it('keeps its own request state, separate from signIn', () => {
    let state = authReducer(stateWith(), rejectedAction(signIn, 'r0', 'Erro no login.'));
    state = authReducer(
      { ...state, signIn: { status: 'failed', error: 'Erro no login.', requestId: null } },
      pendingAction(signUp, 'r1'),
    );

    expect(state.signUp.status).toBe('pending');
    expect(state.signIn.error).toBe('Erro no login.');
  });

  it('signs the visitor in on success, without a second step', () => {
    let state = authReducer(stateWith(), pendingAction(signUp, 'r1'));
    state = authReducer(state, fulfilledAction(signUp, 'r1', session));

    expect(state.session).toEqual(session);
  });
});

/**
 * `sessionCleared` is deliberately NOT handled here. The root reducer hands every slice
 * `undefined` state on it, so all cached server data goes at once and no future slice can forget
 * to participate (FR-047). That behaviour is asserted in `app/store.test.ts`.
 */
