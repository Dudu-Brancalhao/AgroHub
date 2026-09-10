import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CropForm } from './CropForm';
import { renderWithTheme } from '../../test/renderWithTheme';
import type { Harvest } from '../harvests/types';

const harvests: Harvest[] = [
  { id: 'h2', year: 2022, createdAt: '', updatedAt: '' },
  { id: 'h1', year: 2021, createdAt: '', updatedAt: '' },
];

function renderForm(overrides: Partial<Parameters<typeof CropForm>[0]> = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();

  renderWithTheme(
    <CropForm
      harvests={harvests}
      busy={false}
      serverError={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onSubmit, onCancel };
}

describe('CropForm', () => {
  /** data-model.md → Crop: the season is chosen from what exists, never typed. */
  it('offers the existing seasons as options rather than a free text field', () => {
    renderForm();

    expect(screen.getByRole('option', { name: '2021' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2022' })).toBeInTheDocument();
    expect(screen.getByLabelText('Safra').tagName).toBe('SELECT');
  });

  it('submits a season and a crop name', async () => {
    const { onSubmit } = renderForm();

    await userEvent.selectOptions(screen.getByLabelText('Safra'), 'h1');
    await userEvent.type(screen.getByLabelText('Cultura'), 'Soja');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cultura' }));

    expect(onSubmit).toHaveBeenCalledWith({ harvestId: 'h1', name: 'Soja' });
  });

  it('trims the crop name before submitting', async () => {
    const { onSubmit } = renderForm();

    await userEvent.selectOptions(screen.getByLabelText('Safra'), 'h1');
    await userEvent.type(screen.getByLabelText('Cultura'), '  Milho  ');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cultura' }));

    expect(onSubmit).toHaveBeenCalledWith({ harvestId: 'h1', name: 'Milho' });
  });

  it('requires a season', async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText('Cultura'), 'Soja');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cultura' }));

    expect(screen.getByText('Selecione uma safra.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires a crop name', async () => {
    const { onSubmit } = renderForm();

    await userEvent.selectOptions(screen.getByLabelText('Safra'), 'h1');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cultura' }));

    expect(screen.getByText('O nome da cultura é obrigatório.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /** FR-037: the server owns duplicate detection; its refusal must read as a real explanation. */
  it('shows the duplicate refusal from the server as a readable message', () => {
    renderForm({
      serverError: {
        statusCode: 409,
        message: 'Esta cultura já está registrada para esta fazenda nesta safra.',
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Esta cultura já está registrada para esta fazenda nesta safra.',
    );
  });

  it('tells the user to create a season first when none exists', () => {
    renderForm({ harvests: [] });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Cadastre uma safra antes de registrar uma cultura.',
    );
    expect(screen.queryByLabelText('Cultura')).not.toBeInTheDocument();
  });

  it('shows the submit button busy while saving', () => {
    renderForm({ busy: true });

    expect(screen.getByRole('button', { name: 'Registrar cultura' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});
