import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { renderWithTheme } from '../test/renderWithTheme';

describe('Button', () => {
  it('calls its handler when pressed', async () => {
    const onClick = jest.fn();
    renderWithTheme(<Button onClick={onClick}>Salvar</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  /** FR-049: repeated activation while a request is in flight must not send it twice. */
  it('ignores repeated presses while busy', async () => {
    const onClick = jest.fn();
    renderWithTheme(
      <Button busy onClick={onClick}>
        Salvar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Salvar' });
    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('announces the busy state', () => {
    renderWithTheme(<Button busy>Salvar</Button>);

    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('aria-busy', 'true');
  });

  it('stays focusable while busy, so focus is not lost mid-submit', () => {
    renderWithTheme(<Button busy>Salvar</Button>);

    expect(screen.getByRole('button', { name: 'Salvar' })).not.toBeDisabled();
  });

  it('does not fire when disabled', async () => {
    const onClick = jest.fn();
    renderWithTheme(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type=button so it never submits a form by accident', () => {
    renderWithTheme(<Button>Cancelar</Button>);

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveAttribute('type', 'button');
  });

  it('submits its form when asked to, and only then', async () => {
    const onSubmit = jest.fn((event: { preventDefault: () => void }) => event.preventDefault());
    renderWithTheme(
      <form onSubmit={onSubmit}>
        <Button type="submit">Enviar</Button>
        <Button>Cancelar</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
