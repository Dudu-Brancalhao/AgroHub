import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FarmCard } from './FarmCard';
import { renderWithTheme } from '../../test/renderWithTheme';
import type { PropertyDetail } from '../producers/types';

const farm: PropertyDetail = {
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
        { id: 'c1', propertyId: 'f1', harvestId: 'h1', name: 'Soja', createdAt: '', updatedAt: '' },
        { id: 'c2', propertyId: 'f1', harvestId: 'h1', name: 'Milho', createdAt: '', updatedAt: '' },
      ],
    },
    {
      harvestId: 'h2',
      year: 2022,
      crops: [
        { id: 'c3', propertyId: 'f1', harvestId: 'h2', name: 'Café', createdAt: '', updatedAt: '' },
      ],
    },
  ],
};

function renderCard(overrides: Partial<PropertyDetail> = {}) {
  const handlers = {
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onAddCrop: jest.fn(),
    onDeleteCrop: jest.fn(),
  };

  renderWithTheme(<FarmCard farm={{ ...farm, ...overrides }} {...handlers} />);
  return handlers;
}

describe('FarmCard', () => {
  it('shows the farm name, place and all three areas', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Fazenda Santa Helena' })).toBeInTheDocument();
    expect(screen.getByText('Uberaba — MG')).toBeInTheDocument();
    expect(screen.getByText('1.500,11 ha')).toBeInTheDocument();
    expect(screen.getByText('1.000,00 ha')).toBeInTheDocument();
    expect(screen.getByText('500,11 ha')).toBeInTheDocument();
  });

  it('hides the unclassified area when the parts account for the whole total', () => {
    renderCard();

    expect(screen.queryByText('Não classificada')).not.toBeInTheDocument();
  });

  it('shows an unclassified remainder when there genuinely is one', () => {
    renderCard({ totalArea: 200000, arableArea: 100000, vegetationArea: 50011 });

    expect(screen.getByText('Não classificada')).toBeInTheDocument();
    expect(screen.getByText('499,89 ha')).toBeInTheDocument();
  });

  /** FR-035: plantings grouped by season, most recent first. */
  it('groups plantings by season with the newest first', () => {
    renderCard();

    const years = screen.getAllByText(/^20\d\d$/).map((node) => node.textContent);
    expect(years).toEqual(['2022', '2021']);

    expect(screen.getByText('Soja')).toBeInTheDocument();
    expect(screen.getByText('Milho')).toBeInTheDocument();
    expect(screen.getByText('Café')).toBeInTheDocument();
  });

  it('explains a farm with no plantings', () => {
    renderCard({ harvests: [] });

    expect(screen.getByText('Nenhuma cultura registrada nesta fazenda.')).toBeInTheDocument();
  });

  it('offers edit, delete and add-crop actions naming the farm', async () => {
    const handlers = renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Editar Fazenda Santa Helena' }));
    expect(handlers.onEdit).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Excluir Fazenda Santa Helena' }));
    expect(handlers.onDelete).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Nova cultura' }));
    expect(handlers.onAddCrop).toHaveBeenCalled();
  });

  it('removes a planting by its own labelled control', async () => {
    const handlers = renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Remover Soja da safra 2021' }));

    expect(handlers.onDeleteCrop).toHaveBeenCalledWith('c1', 'Soja');
  });
});
