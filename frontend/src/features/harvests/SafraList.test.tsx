import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { SafraList } from './SafraList';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { ApiError } from '../../lib/httpClient';
import * as api from './api';
import type { Harvest } from './types';

jest.mock('./api');
const mockedApi = api as jest.Mocked<typeof api>;

const harvests: Harvest[] = [
  { id: 'h1', year: 2021, createdAt: '', updatedAt: '' },
  { id: 'h2', year: 2022, createdAt: '', updatedAt: '' },
];

function renderSafras() {
  return renderWithProviders(
    <Routes>
      <Route path="/safras" element={<SafraList />} />
      <Route path="/safras/:id" element={<h1>Detalhe da safra</h1>} />
    </Routes>,
    { preloadedState: signedInState, route: '/safras' },
  );
}

describe('SafraList', () => {
  /** SC-013 state 1 of 4: loading. */
  it('shows placeholders while loading', () => {
    mockedApi.listHarvests.mockReturnValue(new Promise(() => undefined));
    renderSafras();

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  /** SC-013 state 2 of 4: success. */
  it('lists every season by year, newest first', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    renderSafras();

    expect(await screen.findByRole('link', { name: '2022' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2021' })).toBeInTheDocument();
  });

  /** SC-013 state 3 of 4: empty. */
  it('explains an empty list', async () => {
    mockedApi.listHarvests.mockResolvedValue([]);
    renderSafras();

    expect(await screen.findByText('Nenhuma safra cadastrada')).toBeInTheDocument();
  });

  /** SC-013 state 4 of 4: failure. */
  it('shows a pt-BR message and a retry when loading fails', async () => {
    mockedApi.listHarvests.mockRejectedValue(new ApiError(500, 'Não foi possível carregar as safras.'));
    renderSafras();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as safras.',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('creates a season', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    mockedApi.createHarvest.mockResolvedValue({ id: 'h3', year: 2024, createdAt: '', updatedAt: '' });
    renderSafras();

    await screen.findByRole('link', { name: '2022' });
    await userEvent.click(screen.getByRole('button', { name: /nova safra/i }));

    await userEvent.type(screen.getByLabelText('Ano da safra'), '2024');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar safra' }));

    await waitFor(() => expect(mockedApi.createHarvest).toHaveBeenCalledWith(2024));
  });

  /** FR-039: an implausible year is refused before any request. */
  it('refuses 1899 client-side', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    renderSafras();

    await screen.findByRole('link', { name: '2022' });
    await userEvent.click(screen.getByRole('button', { name: /nova safra/i }));

    await userEvent.type(screen.getByLabelText('Ano da safra'), '1899');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar safra' }));

    expect(screen.getByText(/Informe um ano entre 1900 e/)).toBeInTheDocument();
    expect(mockedApi.createHarvest).not.toHaveBeenCalled();
  });

  it('shows a duplicate-year conflict on the year field', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    mockedApi.createHarvest.mockRejectedValue(
      new ApiError(409, 'Esta safra já está cadastrada.'),
    );
    renderSafras();

    await screen.findByRole('link', { name: '2022' });
    await userEvent.click(screen.getByRole('button', { name: /nova safra/i }));

    await userEvent.type(screen.getByLabelText('Ano da safra'), '2021');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar safra' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Ano da safra')).toHaveAccessibleDescription(
        'Esta safra já está cadastrada.',
      ),
    );
  });

  /**
   * FR-041, and the behaviour most easily mistaken for a bug: the refusal is designed. A season
   * is shared, so cascading would erase plantings across every farm in the registry at once.
   */
  it('explains a refused deletion and leaves the season in place', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    mockedApi.deleteHarvest.mockRejectedValue(
      new ApiError(409, 'A safra tem 3 culturas registradas e não pode ser excluída.'),
    );
    renderSafras();

    await screen.findByRole('link', { name: '2021' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir safra 2021' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir safra' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A safra tem 3 culturas registradas e não pode ser excluída.',
    );
    expect(screen.getByRole('link', { name: '2021' })).toBeInTheDocument();
  });

  /**
   * The refusal is shown inside the dialog, which stays open. Dismissing it must dismiss the
   * message too — otherwise what the user just read and closed reappears behind the dialog as a
   * banner they cannot clear.
   */
  it('clears the refusal when the dialog is dismissed', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    mockedApi.deleteHarvest.mockRejectedValue(
      new ApiError(409, 'A safra tem 3 culturas registradas e não pode ser excluída.'),
    );
    renderSafras();

    await screen.findByRole('link', { name: '2021' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir safra 2021' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir safra' }));

    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2021' })).toBeInTheDocument();
  });

  it('warns before deleting that the refusal is possible', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    renderSafras();

    await screen.findByRole('link', { name: '2021' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir safra 2021' }));

    expect(
      screen.getByText(/só pode ser excluída se nenhuma fazenda tiver cultura registrada nela/),
    ).toBeInTheDocument();
  });

  it('deletes a season that nothing references', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    mockedApi.deleteHarvest.mockResolvedValue({ deleted: { harvests: 1 } });
    renderSafras();

    await screen.findByRole('link', { name: '2021' });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir safra 2021' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir safra' }));

    await waitFor(() => expect(mockedApi.deleteHarvest).toHaveBeenCalledWith('h1'));
  });

  it('links each season to its detail', async () => {
    mockedApi.listHarvests.mockResolvedValue(harvests);
    renderSafras();

    expect(await screen.findByRole('link', { name: '2021' })).toHaveAttribute(
      'href',
      '/safras/h1',
    );
  });
});
