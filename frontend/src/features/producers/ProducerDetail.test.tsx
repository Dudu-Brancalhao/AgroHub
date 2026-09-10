import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { ProducerDetail } from './ProducerDetail';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { ApiError } from '../../lib/httpClient';
import * as producersApi from './api';
import * as propertiesApi from '../properties/api';
import * as harvestsApi from '../harvests/api';
import type { ProducerDetail as ProducerDetailModel } from './types';

jest.mock('./api');
jest.mock('../properties/api');
jest.mock('../harvests/api');

const mockedProducers = producersApi as jest.Mocked<typeof producersApi>;
const mockedProperties = propertiesApi as jest.Mocked<typeof propertiesApi>;
const mockedHarvests = harvestsApi as jest.Mocked<typeof harvestsApi>;

const producer: ProducerDetailModel = {
  id: 'p1',
  document: '52998224725',
  documentType: 'CPF',
  name: 'José Antônio de Almeida',
  createdAt: '',
  updatedAt: '',
  properties: [
    {
      id: 'f1',
      producerId: 'p1',
      farmName: 'Fazenda Santa Helena',
      city: 'Uberaba',
      state: 'MG',
      totalArea: 150011,
      arableArea: 100000,
      vegetationArea: 50011,
      createdAt: '',
      updatedAt: '',
      harvests: [
        {
          harvestId: 'h1',
          year: 2021,
          crops: [
            {
              id: 'c1',
              propertyId: 'f1',
              harvestId: 'h1',
              name: 'Soja',
              createdAt: '',
              updatedAt: '',
            },
          ],
        },
      ],
    },
  ],
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/produtores/:id" element={<ProducerDetail />} />
      <Route path="/produtores" element={<h1>Lista</h1>} />
    </Routes>,
    { preloadedState: signedInState, route: '/produtores/p1' },
  );
}

beforeEach(() => {
  mockedHarvests.listHarvests.mockResolvedValue([
    { id: 'h1', year: 2021, createdAt: '', updatedAt: '' },
  ]);
});

describe('ProducerDetail', () => {
  /** SC-013 state 1 of 4: loading. */
  it('shows placeholders while the producer loads', () => {
    mockedProducers.fetchProducer.mockReturnValue(new Promise(() => undefined));
    renderDetail();

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  /** SC-013 state 2 of 4: success — and it takes exactly one request (research.md R-009). */
  it('renders the producer, its farms and its plantings from a single request', async () => {
    mockedProducers.fetchProducer.mockResolvedValue(producer);
    renderDetail();

    expect(
      await screen.findByRole('heading', { name: 'José Antônio de Almeida' }),
    ).toBeInTheDocument();
    expect(screen.getByText('CPF: 529.982.247-25')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fazenda Santa Helena' })).toBeInTheDocument();
    expect(screen.getByText('Soja')).toBeInTheDocument();

    expect(mockedProducers.fetchProducer).toHaveBeenCalledTimes(1);
  });

  /** SC-013 state 3 of 4: empty. */
  it('explains a producer with no farms', async () => {
    mockedProducers.fetchProducer.mockResolvedValue({ ...producer, properties: [] });
    renderDetail();

    expect(await screen.findByText('Nenhuma fazenda cadastrada')).toBeInTheDocument();
  });

  /** SC-013 state 4 of 4: a missing producer reads as not found, with a way back. */
  it('shows a not-found screen for an unknown producer', async () => {
    mockedProducers.fetchProducer.mockRejectedValue(new ApiError(404, 'Produtor não encontrado.'));
    renderDetail();

    expect(await screen.findByText('Produtor não encontrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para Produtores' })).toBeInTheDocument();
  });

  /** FR-029: the cascade must be stated before anything is deleted. */
  it('warns that farms and plantings go with the producer', async () => {
    mockedProducers.fetchProducer.mockResolvedValue(producer);
    renderDetail();

    await screen.findByRole('heading', { name: 'José Antônio de Almeida' });
    await userEvent.click(screen.getByRole('button', { name: /excluir produtor/i }));

    expect(
      screen.getByText(/As fazendas deste produtor e as culturas dessas fazendas também serão removidas/),
    ).toBeInTheDocument();
    // And that seasons survive, because they belong to nobody.
    expect(screen.getByText(/As safras permanecem/)).toBeInTheDocument();
  });

  it('deletes nothing when the confirmation is cancelled', async () => {
    mockedProducers.fetchProducer.mockResolvedValue(producer);
    renderDetail();

    await screen.findByRole('heading', { name: 'José Antônio de Almeida' });
    await userEvent.click(screen.getByRole('button', { name: /excluir produtor/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(mockedProducers.deleteProducer).not.toHaveBeenCalled();
  });

  it('creates a farm and re-reads the producer so the screen is fresh', async () => {
    mockedProducers.fetchProducer.mockResolvedValue(producer);
    mockedProperties.createProperty.mockResolvedValue(producer.properties[0]!);
    renderDetail();

    await screen.findByRole('heading', { name: 'José Antônio de Almeida' });
    await userEvent.click(screen.getByRole('button', { name: /nova fazenda/i }));

    await userEvent.type(screen.getByLabelText('Nome da fazenda'), 'Fazenda Nova');
    await userEvent.type(screen.getByLabelText('Cidade'), 'Uberaba');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'MG');
    await userEvent.type(screen.getByLabelText('Área total'), '100');
    await userEvent.type(screen.getByLabelText('Área agricultável'), '60');
    await userEvent.type(screen.getByLabelText('Área de vegetação'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar fazenda' }));

    await waitFor(() => expect(mockedProperties.createProperty).toHaveBeenCalled());
    // FR-045: the owning query is re-issued rather than the nested tree being patched by hand.
    await waitFor(() => expect(mockedProducers.fetchProducer).toHaveBeenCalledTimes(2));
  });

  /** FR-037: the duplicate refusal stays visible on the form that caused it. */
  it('keeps the planting form open and shows the duplicate refusal', async () => {
    mockedProducers.fetchProducer.mockResolvedValue(producer);
    mockedProperties.createCrop.mockRejectedValue(
      new ApiError(409, 'Esta cultura já está registrada para esta fazenda nesta safra.'),
    );
    renderDetail();

    await screen.findByRole('heading', { name: 'José Antônio de Almeida' });
    await userEvent.click(screen.getByRole('button', { name: 'Nova cultura' }));

    await userEvent.selectOptions(await screen.findByLabelText('Safra'), 'h1');
    await userEvent.type(screen.getByLabelText('Cultura'), 'Soja');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cultura' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta cultura já está registrada para esta fazenda nesta safra.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('loads the shared season list so the planting form can offer it', async () => {
    mockedProducers.fetchProducer.mockResolvedValue(producer);
    renderDetail();

    await screen.findByRole('heading', { name: 'José Antônio de Almeida' });

    await waitFor(() => expect(mockedHarvests.listHarvests).toHaveBeenCalled());
  });
});
