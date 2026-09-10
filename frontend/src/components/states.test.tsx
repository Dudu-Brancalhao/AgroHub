import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { SkeletonList } from './Skeleton';
import { Button } from './Button';
import { renderWithTheme } from '../test/renderWithTheme';

describe('SkeletonList', () => {
  it('renders the requested number of placeholder rows', () => {
    const { container } = renderWithTheme(<SkeletonList rows={3} />);

    expect(container.querySelectorAll('[data-testid="skeleton"] > *')).toHaveLength(3);
  });

  it('hides the placeholders from assistive technology, since the shape carries no meaning', () => {
    renderWithTheme(<SkeletonList rows={2} />);

    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('EmptyState', () => {
  it('explains the empty collection in plain text', () => {
    renderWithTheme(
      <EmptyState
        title="Nenhum produtor cadastrado"
        description="Cadastre o primeiro produtor para começar."
      />,
    );

    expect(screen.getByText('Nenhum produtor cadastrado')).toBeInTheDocument();
    expect(screen.getByText('Cadastre o primeiro produtor para começar.')).toBeInTheDocument();
  });

  it('offers the action that would fill it', () => {
    renderWithTheme(
      <EmptyState title="Nenhum produtor cadastrado" action={<Button>Novo produtor</Button>} />,
    );

    expect(screen.getByRole('button', { name: 'Novo produtor' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('announces the pt-BR message', () => {
    renderWithTheme(<ErrorState message="Não foi possível carregar os dados." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os dados.');
  });

  it('offers a retry when retrying is meaningful', async () => {
    const onRetry = jest.fn();
    renderWithTheme(<ErrorState message="Falhou." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry when there is nothing to retry', () => {
    renderWithTheme(<ErrorState message="Falhou." />);

    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });
});
