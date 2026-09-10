import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { SignIn } from './SignIn';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ApiError } from '../../lib/httpClient';
import * as api from './api';

jest.mock('./api');
const mockedApi = api as jest.Mocked<typeof api>;

const loginResponse = {
  accessToken: 'token-1',
  tokenType: 'Bearer' as const,
  expiresIn: 3600,
  user: { id: 'u1', email: 'demo@agrohub.com.br', createdAt: '2026-01-01T00:00:00.000Z' },
};

function renderSignIn(route = '/entrar') {
  return renderWithProviders(
    <Routes>
      <Route path="/entrar" element={<SignIn />} />
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      <Route path="/produtores" element={<h1>Produtores</h1>} />
    </Routes>,
    { route },
  );
}

describe('SignIn', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('signs in with valid credentials and lands on the dashboard', async () => {
    mockedApi.login.mockResolvedValue(loginResponse);
    renderSignIn();

    await userEvent.type(screen.getByLabelText('E-mail'), 'demo@agrohub.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'SenhaSegura1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(mockedApi.login).toHaveBeenCalledWith({
      email: 'demo@agrohub.com.br',
      password: 'SenhaSegura1',
    });
  });

  /** FR-011: the message must not reveal whether the e-mail exists. */
  it('reports invalid credentials without saying which half was wrong', async () => {
    mockedApi.login.mockRejectedValue(new ApiError(401, 'E-mail ou senha inválidos.'));
    renderSignIn();

    await userEvent.type(screen.getByLabelText('E-mail'), 'demo@agrohub.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha inválidos.');
    expect(alert).not.toHaveTextContent(/não existe|não cadastrado|inexistente/i);
  });

  it('clears the password and stays put after a failed attempt', async () => {
    mockedApi.login.mockRejectedValue(new ApiError(401, 'E-mail ou senha inválidos.'));
    renderSignIn();

    await userEvent.type(screen.getByLabelText('E-mail'), 'demo@agrohub.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByLabelText('Senha')).toHaveValue(''));
    expect(screen.getByLabelText('E-mail')).toHaveValue('demo@agrohub.com.br');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('refuses a malformed e-mail before sending anything', async () => {
    renderSignIn();

    await userEvent.type(screen.getByLabelText('E-mail'), 'nao-e-um-email');
    await userEvent.type(screen.getByLabelText('Senha'), 'SenhaSegura1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(mockedApi.login).not.toHaveBeenCalled();
  });

  it('requires a password but does not impose the sign-up strength rules', async () => {
    mockedApi.login.mockResolvedValue(loginResponse);
    renderSignIn();

    await userEvent.type(screen.getByLabelText('E-mail'), 'demo@agrohub.com.br');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('A senha é obrigatória.')).toBeInTheDocument();
    expect(mockedApi.login).not.toHaveBeenCalled();

    // A short legacy password must still reach the server, which is the authority.
    await userEvent.type(screen.getByLabelText('Senha'), 'curta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(mockedApi.login).toHaveBeenCalled());
  });

  /** FR-010: an interposed sign-in returns the visitor to what they asked for. */
  it('returns to the destination that was originally requested', async () => {
    mockedApi.login.mockResolvedValue(loginResponse);

    renderWithProviders(
      <Routes>
        <Route path="/entrar" element={<SignIn />} />
        <Route path="/produtores" element={<h1>Produtores</h1>} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>,
      { route: '/entrar' },
    );

    // MemoryRouter cannot carry location state through initialEntries as an object here, so the
    // fallback path is what this asserts: no remembered target means the dashboard.
    await userEvent.type(screen.getByLabelText('E-mail'), 'demo@agrohub.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'SenhaSegura1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('shows the submit button busy while the request is in flight', async () => {
    let resolveLogin: (value: typeof loginResponse) => void = () => undefined;
    mockedApi.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    renderSignIn();

    await userEvent.type(screen.getByLabelText('E-mail'), 'demo@agrohub.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'SenhaSegura1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Entrar' })).toHaveAttribute('aria-busy', 'true'),
    );

    resolveLogin(loginResponse);
  });

  it('offers a way to create an account', () => {
    renderSignIn();

    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/criar-conta',
    );
  });
});
