import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { selectLandUseTotal } from './selectors';
import { ApiError } from '../../lib/httpClient';
import * as api from './api';
import type { RegistrySummary } from './types';

jest.mock('./api');
const mockedApi = api as jest.Mocked<typeof api>;

const summary: RegistrySummary = {
  totals: { farms: 1, hectares: 150011 },
  byState: { unit: 'count', categories: [{ key: 'MG', label: 'MG', value: 1 }] },
  byCrop: { unit: 'hectares', categories: [{ key: 'soja', label: 'Soja', value: 150011 }] },
  byLandUse: {
    unit: 'hectares',
    categories: [
      { key: 'arable', label: 'Agricultável', value: 100000 },
      { key: 'vegetation', label: 'Vegetação', value: 50011 },
    ],
  },
};

const emptySummary: RegistrySummary = {
  totals: { farms: 0, hectares: 0 },
  byState: { unit: 'count', categories: [] },
  byCrop: { unit: 'hectares', categories: [] },
  byLandUse: { unit: 'hectares', categories: [] },
};

function renderDashboard() {
  return renderWithProviders(<Dashboard />, {
    preloadedState: signedInState,
    route: '/dashboard',
  });
}

describe('Dashboard', () => {
  /** SC-013 state 1 of 4: loading. */
  it('shows placeholders shaped like the content while loading', () => {
    mockedApi.fetchSummary.mockReturnValue(new Promise(() => undefined));
    renderDashboard();

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Fazendas cadastradas')).not.toBeInTheDocument();
  });

  /** SC-013 state 2 of 4: success. */
  it('shows the totals and all three breakdowns', async () => {
    mockedApi.fetchSummary.mockResolvedValue(summary);
    renderDashboard();

    // Both totals are scoped to their own card: with one farm growing one crop, "1" and
    // "1.500,11 ha" legitimately appear again in the breakdowns below.
    const farmsCard = (await screen.findByText('Fazendas cadastradas')).closest('section')!;
    expect(within(farmsCard).getByText('1')).toBeInTheDocument();

    const hectaresCard = screen.getByText('Hectares cadastrados').closest('section')!;
    expect(within(hectaresCard).getByText('1.500,11 ha')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Por estado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por cultura' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por uso do solo' })).toBeInTheDocument();

    // The unit is read from the response, never assumed: this fixture counts farms by state
    // and measures hectares by crop, and the live API does the opposite.
    expect(screen.getByText('em número de registros')).toBeInTheDocument();
    expect(screen.getAllByText('em hectares')).toHaveLength(2);

    expect(screen.getByText('MG')).toBeInTheDocument();
    expect(screen.getByText('Soja')).toBeInTheDocument();
    expect(screen.getByText('Agricultável')).toBeInTheDocument();
  });

  /**
   * Three of the six palette hues sit below 3:1 contrast on white, so the chart guidance
   * obligates visible labels. Every value must be readable as text, never inferable only from
   * a slice's colour.
   */
  it('renders every value as real text in the legend', async () => {
    mockedApi.fetchSummary.mockResolvedValue(summary);
    renderDashboard();

    // The share stays on the slice; the legend carries the label and the value.
    expect(await screen.findByText('1.000,00 ha')).toBeInTheDocument();
    expect(screen.getByText('500,11 ha')).toBeInTheDocument();
    expect(screen.queryByText('1.000,00 ha · 67%')).not.toBeInTheDocument();
  });

  it('describes each pie to assistive technology', async () => {
    mockedApi.fetchSummary.mockResolvedValue(summary);
    renderDashboard();

    const charts = await screen.findAllByRole('img');
    expect(charts).toHaveLength(3);
    expect(charts[2]).toHaveAccessibleName(
      expect.stringContaining('Agricultável 1.000,00 ha, 67%'),
    );
  });

  /** SC-013 state 3 of 4: empty. */
  it('explains an empty registry instead of drawing zero-height bars', async () => {
    mockedApi.fetchSummary.mockResolvedValue(emptySummary);
    renderDashboard();

    expect(await screen.findByText('Nenhuma fazenda cadastrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar produtor' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Por estado' })).not.toBeInTheDocument();
  });

  /** SC-013 state 4 of 4: failure. */
  it('shows a pt-BR message and a retry when the figures fail to load', async () => {
    mockedApi.fetchSummary.mockRejectedValue(new ApiError(500, 'Não foi possível carregar o painel.'));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o painel.',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('re-fetches when retry is pressed, without a page reload', async () => {
    mockedApi.fetchSummary.mockRejectedValueOnce(new ApiError(500, 'Falhou.'));
    renderDashboard();

    await screen.findByRole('button', { name: 'Tentar novamente' });

    mockedApi.fetchSummary.mockResolvedValue(summary);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Fazendas cadastradas')).toBeInTheDocument();
  });

  it('re-fetches when a mutation elsewhere marked the figures stale', async () => {
    mockedApi.fetchSummary.mockResolvedValue(summary);

    renderWithProviders(<Dashboard />, {
      preloadedState: {
        ...signedInState,
        dashboard: {
          summary,
          request: { status: 'succeeded', error: null, requestId: null },
          stale: true,
        },
      },
      route: '/dashboard',
    });

    await waitFor(() => expect(mockedApi.fetchSummary).toHaveBeenCalled());
  });

  it('does not re-fetch on a revisit when nothing changed', async () => {
    mockedApi.fetchSummary.mockResolvedValue(summary);

    renderWithProviders(<Dashboard />, {
      preloadedState: {
        ...signedInState,
        dashboard: {
          summary,
          request: { status: 'succeeded', error: null, requestId: null },
          stale: false,
        },
      },
      route: '/dashboard',
    });

    expect(await screen.findByText('Fazendas cadastradas')).toBeInTheDocument();
    expect(mockedApi.fetchSummary).not.toHaveBeenCalled();
  });
});

describe('land-use total', () => {
  /**
   * SC-007. Both sides are integers, so this is an exact equality rather than a tolerance —
   * which is the whole point of holding areas as centiares (research.md R-004).
   */
  it('sums exactly to the registry total', () => {
    const state = {
      dashboard: { summary, request: { status: 'succeeded' as const, error: null, requestId: null }, stale: false },
    };

    expect(selectLandUseTotal(state as never)).toBe(summary.totals.hectares);
    expect(selectLandUseTotal(state as never)).toBe(150011);
  });
});
