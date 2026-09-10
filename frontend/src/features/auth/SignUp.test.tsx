import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { SignUp } from './SignUp';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ApiError } from '../../lib/httpClient';
import * as api from './api';

jest.mock('./api');
const mockedApi = api as jest.Mocked<typeof api>;

const user = { id: 'u1', email: 'novo@agrohub.com.br', createdAt: '2026-01-01T00:00:00.000Z' };
const loginResponse = {
  accessToken: 'token-1',
  tokenType: 'Bearer' as const,
  expiresIn: 3600,
  user,
};

function renderSignUp() {
  return renderWithProviders(
    <Routes>
      <Route path="/criar-conta" element={<SignUp />} />
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
    </Routes>,
    { route: '/criar-conta' },
  );
}

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText('E-mail'), 'novo@agrohub.com.br');
  await userEvent.type(screen.getByLabelText('Senha'), 'SenhaSegura1');
}

describe('SignUp', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  /** FR-012: registration returns no token, so the thunk chains straight into login. */
  it('creates the account and signs in without asking for the credentials again', async () => {
    mockedApi.register.mockResolvedValue(user);
    mockedApi.login.mockResolvedValue(loginResponse);
    renderSignUp();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(mockedApi.register).toHaveBeenCalledWith({
      email: 'novo@agrohub.com.br',
      password: 'SenhaSegura1',
    });
    expect(mockedApi.login).toHaveBeenCalledWith({
      email: 'novo@agrohub.com.br',
      password: 'SenhaSegura1',
    });
  });

  it('refuses a password under eight characters before sending anything', async () => {
    renderSignUp();

    await userEvent.type(screen.getByLabelText('E-mail'), 'novo@agrohub.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'Curta1');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('A senha deve ter no mínimo 8 caracteres.')).toBeInTheDocument();
    expect(mockedApi.register).not.toHaveBeenCalled();
  });

  it('refuses a password with no digit, mirroring the server rule', async () => {
    renderSignUp();

    await userEvent.type(screen.getByLabelText('E-mail'), 'novo@agrohub.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'SenhaSegura');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(
      await screen.findByText('A senha deve conter pelo menos uma letra e um número.'),
    ).toBeInTheDocument();
    expect(mockedApi.register).not.toHaveBeenCalled();
  });

  it('surfaces an e-mail already registered', async () => {
    mockedApi.register.mockRejectedValue(new ApiError(409, 'Este e-mail já está cadastrado.'));
    renderSignUp();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este e-mail já está cadastrado.');
  });

  /** The rate limiter's refusal must read as a reason to wait, not as a generic failure. */
  it('explains a rate-limited registration', async () => {
    mockedApi.register.mockRejectedValue(
      new ApiError(429, 'Muitas contas criadas. Aguarde alguns minutos e tente novamente.'),
    );
    renderSignUp();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas contas criadas. Aguarde alguns minutos e tente novamente.',
    );
  });

  it('does not sign in when registration fails', async () => {
    mockedApi.register.mockRejectedValue(new ApiError(409, 'Este e-mail já está cadastrado.'));
    renderSignUp();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await screen.findByRole('alert');
    expect(mockedApi.login).not.toHaveBeenCalled();
  });

  it('shows the button busy while the request is in flight', async () => {
    mockedApi.register.mockReturnValue(new Promise(() => undefined));
    renderSignUp();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveAttribute(
        'aria-busy',
        'true',
      ),
    );
  });

  it('offers a way back to signing in', () => {
    renderSignUp();

    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  });
});
