import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { SafraDetail } from './SafraDetail';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { ApiError } from '../../lib/httpClient';
import * as api from './api';
import * as propertiesApi from '../properties/api';
import type { Crop, PropertyDetail } from '../producers/types';

jest.mock('./api');
jest.mock('../properties/api');
const mockedApi = api as jest.Mocked<typeof api>;
const mockedProperties = propertiesApi as jest.Mocked<typeof propertiesApi>;

const crops: Crop[] = [
  { id: 'c1', propertyId: 'f1', harvestId: 'h1', name: 'Soja', createdAt: '', updatedAt: '' },
  { id: 'c2', propertyId: 'f1', harvestId: 'h1', name: 'Milho', createdAt: '', updatedAt: '' },
  { id: 'c3', propertyId: 'f2', harvestId: 'h1', name: 'Café', createdAt: '', updatedAt: '' },
];

function farm(id: string, farmName: string): PropertyDetail {
  return {
    id,
    producerId: 'p1',
    farmName,
    city: 'Uberaba',
    state: 'MG',
    totalArea: 150011,
    arableArea: 100000,
    vegetationArea: 50011,
    createdAt: '',
    updatedAt: '',
    harvests: [],
  };
}

const harvestsState = {
  harvests: {
    items: [{ id: 'h1', year: 2021, createdAt: '', updatedAt: '' }],
    request: { status: 'succeeded' as const, error: null, requestId: null },
    detail: {
      id: null,
      crops: [],
      farmNames: {},
      request: { status: 'idle' as const, error: null, requestId: null },
    },
    mutation: { status: 'idle' as const, error: null, requestId: null },
  },
};

function renderDetail(extraState: object = {}) {
  return renderWithProviders(
    <Routes>
      <Route path="/safras/:id" element={<SafraDetail />} />
    </Routes>,
    {
      preloadedState: { ...signedInState, ...harvestsState, ...extraState },
      route: '/safras/h1',
    },
  );
}

describe('SafraDetail', () => {
  /** SC-013 state 1 of 4: loading. */
  it('shows placeholders while the plantings load', () => {
    mockedApi.listCropsByHarvest.mockReturnValue(new Promise(() => undefined));
    renderDetail();

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  /** SC-013 state 2 of 4: success. FR-042. */
  it('lists the plantings grouped by the farm each belongs to', async () => {
    mockedApi.listCropsByHarvest.mockResolvedValue(crops);
    mockedProperties.fetchProperty.mockImplementation(async (id: string) => farm(id, `Fazenda ${id}`));
    renderDetail();

    expect(await screen.findByText('Soja')).toBeInTheDocument();
    expect(screen.getByText('Milho')).toBeInTheDocument();
    expect(screen.getByText('Café')).toBeInTheDocument();

    // Two farms, so two groups.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
  });

  /**
   * The crops payload names no farm, so each distinct farm is read once — the difference
   * between a readable screen and a list of UUID fragments.
   */
  it('resolves each farm name, reading each distinct farm exactly once', async () => {
    mockedApi.listCropsByHarvest.mockResolvedValue(crops);
    mockedProperties.fetchProperty.mockImplementation(async (id: string) =>
      farm(id, id === 'f1' ? 'Fazenda Santa Helena' : 'Fazenda Boa Vista'),
    );
    renderDetail();

    expect(await screen.findByText('Fazenda Santa Helena')).toBeInTheDocument();
    expect(screen.getByText('Fazenda Boa Vista')).toBeInTheDocument();

    // Three crops across two farms: two reads, not three.
    expect(mockedProperties.fetchProperty).toHaveBeenCalledTimes(2);
  });

  /** One unreadable farm must not cost the whole screen — the plantings still matter. */
  it('falls back to an identifier when a farm cannot be read', async () => {
    mockedApi.listCropsByHarvest.mockResolvedValue(crops);
    mockedProperties.fetchProperty.mockImplementation(async (id: string) => {
      if (id === 'f1') throw new ApiError(404, 'Não encontrada.');
      return farm(id, 'Fazenda Boa Vista');
    });
    renderDetail();

    expect(await screen.findByText(/^Fazenda f1$/)).toBeInTheDocument();
    expect(screen.getByText('Fazenda Boa Vista')).toBeInTheDocument();
    expect(screen.getByText('Soja')).toBeInTheDocument();
  });

  /** SC-013 state 3 of 4: empty. */
  it('explains a season with no plantings', async () => {
    mockedApi.listCropsByHarvest.mockResolvedValue([]);
    renderDetail();

    expect(await screen.findByText('Nenhuma cultura registrada nesta safra')).toBeInTheDocument();
  });

  /** SC-013 state 4 of 4: failure — a missing season reads as not found, not as an error. */
  it('shows a not-found screen for an unknown season', async () => {
    mockedApi.listCropsByHarvest.mockRejectedValue(new ApiError(404, 'Safra não encontrada.'));
    renderDetail();

    expect(await screen.findByText('Safra não encontrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para Safras' })).toBeInTheDocument();
  });

  it('shows the season year in its heading', async () => {
    mockedApi.listCropsByHarvest.mockResolvedValue(crops);
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Safra 2021' })).toBeInTheDocument();
  });
});
