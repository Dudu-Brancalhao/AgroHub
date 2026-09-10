import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { renderWithTheme } from '../test/renderWithTheme';

describe('Modal', () => {
  it('renders as a labelled dialog', () => {
    renderWithTheme(
      <Modal title="Nova fazenda" onClose={jest.fn()}>
        <button type="button">Salvar</button>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Nova fazenda' })).toBeInTheDocument();
  });

  it('moves focus into the dialog when it opens', () => {
    renderWithTheme(
      <Modal title="Nova fazenda" onClose={jest.fn()}>
        <button type="button">Primeiro</button>
      </Modal>,
    );

    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Modal title="Nova fazenda" onClose={onClose}>
        <button type="button">Salvar</button>
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the overlay behind it is clicked', async () => {
    const onClose = jest.fn();
    const { container } = renderWithTheme(
      <Modal title="Nova fazenda" onClose={onClose}>
        <button type="button">Salvar</button>
      </Modal>,
    );

    await userEvent.click(container.firstElementChild as Element);

    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when the panel itself is clicked', async () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Modal title="Nova fazenda" onClose={onClose}>
        <button type="button">Salvar</button>
      </Modal>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  /** FR-056: focus must not escape the dialog while it is open. */
  it('traps Tab inside the dialog', async () => {
    renderWithTheme(
      <Modal title="Nova fazenda" onClose={jest.fn()}>
        <button type="button">Salvar</button>
      </Modal>,
    );

    const close = screen.getByRole('button', { name: 'Fechar' });
    const save = screen.getByRole('button', { name: 'Salvar' });

    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(save).toHaveFocus();

    // Past the last element, focus wraps to the first rather than leaving the dialog.
    await userEvent.tab();
    expect(close).toHaveFocus();
  });

  it('returns focus to the element that opened it', async () => {
    function Harness() {
      return (
        <>
          <button type="button">Abrir</button>
          <Modal title="Nova fazenda" onClose={jest.fn()}>
            <button type="button">Salvar</button>
          </Modal>
        </>
      );
    }

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = renderWithTheme(<Harness />);
    unmount();

    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});

describe('ConfirmDialog', () => {
  it('lets the caller phrase the cascade warning', () => {
    renderWithTheme(
      <ConfirmDialog
        title="Excluir produtor"
        message="As fazendas e os plantios deste produtor também serão removidos."
        confirmLabel="Excluir produtor"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      screen.getByText('As fazendas e os plantios deste produtor também serão removidos.'),
    ).toBeInTheDocument();
  });

  it('confirms only when the confirm button is pressed', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderWithTheme(
      <ConfirmDialog
        title="Excluir produtor"
        message="Tem certeza?"
        confirmLabel="Excluir"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
