import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { RedirectIfAuthenticated, RequireAuth } from './RequireAuth';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';

const signedOut = {
  auth: {
    session: null,
    bootstrap: { status: 'succeeded' as const, error: null, requestId: null },
    signIn: { status: 'idle' as const, error: null, requestId: null },
    signUp: { status: 'idle' as const, error: null, requestId: null },
  },
};

const bootstrapping = {
  auth: {
    ...signedOut.auth,
    bootstrap: { status: 'pending' as const, error: null, requestId: null },
  },
};

function renderGuarded(preloadedState: object, route: string) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/produtores"
        element={
          <RequireAuth>
            <h1>Produtores</h1>
          </RequireAuth>
        }
      />
      <Route
        path="/entrar"
        element={
          <RedirectIfAuthenticated>
            <h1>Entrar</h1>
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
    </Routes>,
    { preloadedState, route },
  );
}

describe('RequireAuth', () => {
  it('lets a signed-in visitor through', () => {
    renderGuarded(signedInState, '/produtores');

    expect(screen.getByRole('heading', { name: 'Produtores' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to the sign-in screen', () => {
    renderGuarded(signedOut, '/produtores');

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Produtores' })).not.toBeInTheDocument();
  });

  /**
   * The state that makes this component necessary: redirecting while the stored token is still
   * being verified would flash the sign-in screen at every reload for a signed-in user.
   */
  it('renders the shell skeleton while the session is still being verified', () => {
    renderGuarded(bootstrapping, '/produtores');

    expect(screen.getByTestId('shell-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Produtores' })).not.toBeInTheDocument();
  });
});

describe('RedirectIfAuthenticated', () => {
  it('keeps a signed-out visitor on the sign-in screen', () => {
    renderGuarded(signedOut, '/entrar');

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('sends a signed-in visitor to the dashboard', () => {
    renderGuarded(signedInState, '/entrar');

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('waits rather than redirecting while the session is being verified', () => {
    renderGuarded(bootstrapping, '/entrar');

    expect(screen.getByTestId('shell-skeleton')).toBeInTheDocument();
  });
});
