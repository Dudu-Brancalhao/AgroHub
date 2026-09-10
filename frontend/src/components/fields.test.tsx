import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from './TextField';
import { Select } from './Select';
import { renderWithTheme } from '../test/renderWithTheme';

describe('TextField', () => {
  it('associates its label with the input', () => {
    renderWithTheme(<TextField label="Nome" />);

    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });

  it('marks the field invalid and announces the error', () => {
    renderWithTheme(<TextField label="Documento" error="Informe um CPF ou CNPJ válido." />);

    const input = screen.getByLabelText('Documento');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Informe um CPF ou CNPJ válido.');
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um CPF ou CNPJ válido.');
  });

  it('describes the field with its hint when there is no error', () => {
    renderWithTheme(<TextField label="Área total" hint="Em hectares, com até duas casas." />);

    expect(screen.getByLabelText('Área total')).toHaveAccessibleDescription(
      'Em hectares, com até duas casas.',
    );
  });

  it('prefers the error over the hint, so the actionable message is not buried', () => {
    renderWithTheme(<TextField label="Área total" hint="Em hectares." error="Valor inválido." />);

    expect(screen.getByLabelText('Área total')).toHaveAccessibleDescription('Valor inválido.');
  });

  it('accepts typing', async () => {
    renderWithTheme(<TextField label="Nome" />);

    await userEvent.type(screen.getByLabelText('Nome'), 'José');

    expect(screen.getByLabelText('Nome')).toHaveValue('José');
  });
});

describe('Select', () => {
  const options = [
    { value: 'MG', label: 'MG' },
    { value: 'SP', label: 'SP' },
  ];

  it('renders its options behind an associated label', () => {
    renderWithTheme(<Select label="Estado" options={options} />);

    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MG' })).toBeInTheDocument();
  });

  it('offers a placeholder option when given one', () => {
    renderWithTheme(<Select label="Safra" options={options} placeholder="Selecione uma safra" />);

    expect(screen.getByRole('option', { name: 'Selecione uma safra' })).toBeInTheDocument();
  });

  it('announces its error', () => {
    renderWithTheme(<Select label="Safra" options={options} error="Selecione uma safra." />);

    expect(screen.getByLabelText('Safra')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Selecione uma safra.');
  });
});
