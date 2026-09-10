import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { ProducerList } from './ProducerList';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { ApiError } from '../../lib/httpClient';
import * as api from './api';
import type { Producer } from './types';

jest.mock('./api');
const mockedApi = api as jest.Mocked<typeof api>;

const producer: Producer = {
  id: 'p1',
  document: '52998224725',
  documentType: 'CPF',
  name: 'José Antônio de Almeida',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function page(items: Producer[], total = items.length) {
  return { data: items, total, page: 1, pageSize: 20 };
}

function renderList(route = '/produtores') {
  return renderWithProviders(
    <Routes>
      <Route path="/produtores" element={<ProducerList />} />
      <Route path="/produtores/novo" element={<h1>Novo produtor</h1>} />
      <Route path="/produtores/:id" element={<h1>Detalhe</h1>} />
    </Routes>,
    { preloadedState: signedInState, route },
  );
}

describe('ProducerList', () => {
  /** SC-013 state 1 of 4: loading. */
  it('shows placeholders while loading', () => {
    mockedApi.listProducers.mockReturnValue(new Promise(() => undefined));
    renderList();

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  /** SC-013 state 2 of 4: success. */
  it('lists producers with name and masked document', async () => {
    mockedApi.listProducers.mockResolvedValue(page([producer]));
    renderList();

    expect(await screen.findByText('José Antônio de Almeida')).toBeInTheDocument();
    expect(screen.getByText('529.982.247-25')).toBeInTheDocument();
  });

  /** SC-013 state 3 of 4: empty. */
  it('explains an empty registry', async () => {
    mockedApi.listProducers.mockResolvedValue(page([]));
    renderList();

    expect(await screen.findByText('Nenhum produtor cadastrado')).toBeInTheDocument();
  });

  /** SC-013 state 4 of 4: failure. */
  it('shows a pt-BR message and a retry when loading fails', async () => {
    mockedApi.listProducers.mockRejectedValue(
      new ApiError(500, 'Não foi possível carregar os produtores.'),
    );
    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os produtores.',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  /** FR-023: one request after typing stops, not one per keystroke. */
  it('debounces the search rather than firing per keystroke', async () => {
    jest.useFakeTimers();
    mockedApi.listProducers.mockResolvedValue(page([producer]));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderList();
    await waitFor(() => expect(mockedApi.listProducers).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText('Buscar produtores'), 'jose');

    // Four keystrokes, no new request yet.
    expect(mockedApi.listProducers).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(400);
    await waitFor(() => expect(mockedApi.listProducers).toHaveBeenCalledTimes(2));

    expect(mockedApi.listProducers).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'jose' }),
    );

    jest.useRealTimers();
  });

  it('names the searched term in the empty state and offers to clear it', async () => {
    mockedApi.listProducers.mockResolvedValue(page([]));
    renderList('/produtores?busca=zzz');

    expect(await screen.findByText('Nenhum produtor encontrado para «zzz»')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver todos os produtores' })).toBeInTheDocument();
  });

  /** FR-024: the address carries the search and the page. */
  it('reads the search term and page from the address', async () => {
    mockedApi.listProducers.mockResolvedValue(page([producer]));
    renderList('/produtores?busca=jose&pagina=2');

    await waitFor(() =>
      expect(mockedApi.listProducers).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
        search: 'jose',
      }),
    );
  });

  it('falls back to page 1 when the address carries a nonsense page', async () => {
    mockedApi.listProducers.mockResolvedValue(page([producer]));
    renderList('/produtores?pagina=abc');

    await waitFor(() =>
      expect(mockedApi.listProducers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      ),
    );
  });

  it('shows pagination only when there is more than one page', async () => {
    mockedApi.listProducers.mockResolvedValue(page([producer], 45));
    renderList();

    expect(await screen.findByRole('navigation', { name: 'Paginação' })).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('hides pagination for a single page of results', async () => {
    mockedApi.listProducers.mockResolvedValue(page([producer]));
    renderList();

    await screen.findByText('José Antônio de Almeida');
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument();
  });

  it('links each row to that producer', async () => {
    mockedApi.listProducers.mockResolvedValue(page([producer]));
    renderList();

    const link = await screen.findByRole('link', { name: /José Antônio de Almeida/ });
    expect(link).toHaveAttribute('href', '/produtores/p1');
  });
});
