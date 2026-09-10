import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProducerForm, validateProducer } from './ProducerForm';
import { renderWithTheme } from '../../test/renderWithTheme';

function renderForm(overrides: Partial<Parameters<typeof ProducerForm>[0]> = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();

  renderWithTheme(
    <ProducerForm
      submitLabel="Cadastrar"
      busy={false}
      serverError={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onSubmit, onCancel };
}

describe('validateProducer', () => {
  it('accepts a valid CPF and name', () => {
    expect(validateProducer({ name: 'José', document: '52998224725' })).toEqual({});
  });

  it('requires a name', () => {
    expect(validateProducer({ name: '   ', document: '52998224725' })).toEqual({
      name: 'O nome é obrigatório.',
    });
  });

  it('caps the name at 200 characters', () => {
    expect(validateProducer({ name: 'a'.repeat(201), document: '52998224725' })).toEqual({
      name: 'O nome deve ter no máximo 200 caracteres.',
    });
  });

  /** research.md R-010: repeated digits pass a naive checksum, so they need their own guard. */
  it('refuses a repeated-digit document', () => {
    expect(validateProducer({ name: 'José', document: '11111111111' })).toEqual({
      document: 'Informe um CPF ou CNPJ válido.',
    });
  });
});

describe('ProducerForm', () => {
  it('submits a valid producer with the document stripped of punctuation', async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText('Nome'), 'José Antônio de Almeida');
    await userEvent.type(screen.getByLabelText('CPF ou CNPJ'), '52998224725');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'José Antônio de Almeida',
      document: '52998224725',
    });
  });

  it('masks the document as it is typed', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('CPF ou CNPJ'), '52998224725');

    expect(screen.getByLabelText('CPF ou CNPJ')).toHaveValue('529.982.247-25');
  });

  /** FR-027: an invalid document is refused before any request. */
  it('refuses a repeated-digit document without submitting', async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText('Nome'), 'José');
    await userEvent.type(screen.getByLabelText('CPF ou CNPJ'), '11111111111');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(screen.getByText('Informe um CPF ou CNPJ válido.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses an empty name without submitting', async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText('CPF ou CNPJ'), '52998224725');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(screen.getByText('O nome é obrigatório.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /** FR-030: the server's conflict lands on the document field, not as a generic banner. */
  it('binds a 409 to the document field', () => {
    renderForm({
      serverError: { statusCode: 409, message: 'Documento já cadastrado para outro produtor.' },
    });

    expect(screen.getByLabelText('CPF ou CNPJ')).toHaveAccessibleDescription(
      'Documento já cadastrado para outro produtor.',
    );
  });

  it('binds validation details to the fields they name', () => {
    renderForm({
      serverError: {
        statusCode: 400,
        message: 'Os dados enviados são inválidos.',
        details: [{ field: 'name', message: 'O nome é obrigatório.' }],
      },
    });

    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('O nome é obrigatório.');
  });

  it('still shows an unattributed failure somewhere readable', () => {
    renderForm({ serverError: { statusCode: 500, message: 'Algo deu errado.' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado.');
  });

  it('seeds the fields when editing', () => {
    renderForm({
      initialValues: { name: 'José', document: '52998224725' },
      submitLabel: 'Salvar',
    });

    expect(screen.getByLabelText('Nome')).toHaveValue('José');
    expect(screen.getByLabelText('CPF ou CNPJ')).toHaveValue('529.982.247-25');
  });

  it('shows the submit button busy while saving', () => {
    renderForm({ busy: true });

    expect(screen.getByRole('button', { name: 'Cadastrar' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});
