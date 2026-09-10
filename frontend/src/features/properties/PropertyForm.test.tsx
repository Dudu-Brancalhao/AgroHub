import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyForm, validateProperty } from './PropertyForm';
import { renderWithTheme } from '../../test/renderWithTheme';

function renderForm(overrides: Partial<Parameters<typeof PropertyForm>[0]> = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();

  renderWithTheme(
    <PropertyForm
      busy={false}
      serverError={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onSubmit, onCancel };
}

async function fill(values: {
  farmName?: string;
  city?: string;
  state?: string;
  total?: string;
  arable?: string;
  vegetation?: string;
}) {
  if (values.farmName) await userEvent.type(screen.getByLabelText('Nome da fazenda'), values.farmName);
  if (values.city) await userEvent.type(screen.getByLabelText('Cidade'), values.city);
  if (values.state) await userEvent.selectOptions(screen.getByLabelText('Estado'), values.state);
  if (values.total) await userEvent.type(screen.getByLabelText('Área total'), values.total);
  if (values.arable) await userEvent.type(screen.getByLabelText('Área agricultável'), values.arable);
  if (values.vegetation) {
    await userEvent.type(screen.getByLabelText('Área de vegetação'), values.vegetation);
  }
}

describe('validateProperty', () => {
  const base = {
    farmName: 'Fazenda Santa Helena',
    city: 'Uberaba',
    state: 'MG',
    totalArea: '1500.11',
    arableArea: '1000',
    vegetationArea: '500.11',
  };

  /**
   * The float trap, in the one place it matters most.
   *
   * `1000 + 500.11` is `1500.1100000000001` in floats, so a naive check refuses a farm the
   * server accepts. Compared in integer centiares it is exactly equal (research.md R-004).
   */
  it('accepts a farm whose parts sum exactly to the total', () => {
    const { errors, input } = validateProperty(base);

    expect(errors).toEqual({});
    expect(input).toEqual({
      farmName: 'Fazenda Santa Helena',
      city: 'Uberaba',
      state: 'MG',
      totalArea: 150011,
      arableArea: 100000,
      vegetationArea: 50011,
    });
  });

  it('refuses parts that exceed the total', () => {
    const { errors, input } = validateProperty({
      ...base,
      totalArea: '100',
      arableArea: '60',
      vegetationArea: '50',
    });

    expect(errors.form).toBe(
      'A soma da área agricultável e da vegetação não pode ultrapassar a área total.',
    );
    expect(input).toBeUndefined();
  });

  it('accepts parts that leave an unclassified remainder', () => {
    const { errors } = validateProperty({
      ...base,
      totalArea: '100',
      arableArea: '60',
      vegetationArea: '20',
    });

    expect(errors).toEqual({});
  });

  it('requires the farm name, the city and a valid UF', () => {
    const { errors } = validateProperty({ ...base, farmName: ' ', city: '', state: 'XX' });

    expect(errors.farmName).toBe('O nome da fazenda é obrigatório.');
    expect(errors.city).toBe('A cidade é obrigatória.');
    expect(errors.state).toBe('Informe uma UF brasileira válida.');
  });

  it('requires a total area greater than zero', () => {
    const { errors } = validateProperty({ ...base, totalArea: '0' });

    expect(errors.totalArea).toBe('A área total deve ser maior que zero.');
  });

  it('accepts the comma the pt-BR keyboard produces', () => {
    const { errors, input } = validateProperty({
      ...base,
      totalArea: '1500,11',
      arableArea: '1000',
      vegetationArea: '500,11',
    });

    expect(errors).toEqual({});
    expect(input?.totalArea).toBe(150011);
  });
});

describe('PropertyForm', () => {
  it('submits a valid farm with areas as integers', async () => {
    const { onSubmit } = renderForm();

    await fill({
      farmName: 'Fazenda Santa Helena',
      city: 'Uberaba',
      state: 'MG',
      total: '1500,11',
      arable: '1000',
      vegetation: '500,11',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar fazenda' }));

    expect(onSubmit).toHaveBeenCalledWith({
      farmName: 'Fazenda Santa Helena',
      city: 'Uberaba',
      state: 'MG',
      totalArea: 150011,
      arableArea: 100000,
      vegetationArea: 50011,
    });
  });

  /** FR-033: the rule is explained before anything is sent. */
  it('refuses an over-allocated farm without submitting', async () => {
    const { onSubmit } = renderForm();

    await fill({
      farmName: 'Fazenda X',
      city: 'Uberaba',
      state: 'MG',
      total: '100',
      arable: '60',
      vegetation: '50',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar fazenda' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A soma da área agricultável e da vegetação não pode ultrapassar a área total.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers only the 27 Brazilian UFs', () => {
    renderForm();

    // 27 states plus the placeholder.
    expect(screen.getByLabelText('Estado').querySelectorAll('option')).toHaveLength(28);
    expect(screen.getByRole('option', { name: 'MG' })).toBeInTheDocument();
  });

  it('seeds the fields when editing an existing farm', () => {
    renderForm({
      property: {
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
        harvests: [],
      },
    });

    expect(screen.getByLabelText('Nome da fazenda')).toHaveValue('Fazenda Santa Helena');
    expect(screen.getByLabelText('Área total')).toHaveValue('1500,11');
    expect(screen.getByLabelText('Área de vegetação')).toHaveValue('500,11');
  });

  it('binds server field errors to their fields', () => {
    renderForm({
      serverError: {
        statusCode: 400,
        message: 'Os dados enviados são inválidos.',
        details: [{ field: 'city', message: 'A cidade é obrigatória.' }],
      },
    });

    expect(screen.getByLabelText('Cidade')).toHaveAccessibleDescription('A cidade é obrigatória.');
  });
});
