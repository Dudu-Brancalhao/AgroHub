import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { renderWithProviders, signedInState } from '../test/renderWithProviders';

function renderShell(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<h1>Painel</h1>} />
        <Route path="/produtores" element={<h1>Lista de produtores</h1>} />
        <Route path="/produtores/:id" element={<h1>Detalhe do produtor</h1>} />
        <Route path="/safras" element={<h1>Lista de safras</h1>} />
      </Route>
      <Route path="/entrar" element={<h1>Entrar</h1>} />
    </Routes>,
    { preloadedState: signedInState, route },
  );
}

describe('AppShell', () => {
  it('shows the product name on the left edge of the header, linking to the dashboard', () => {
    renderShell('/dashboard');

    expect(screen.getByRole('link', { name: 'AgroHub' })).toHaveAttribute('href', '/dashboard');
  });

  it('shows the signed-in e-mail and a way to sign out', () => {
    renderShell('/dashboard');

    expect(screen.getByText('demo@agrohub.com.br')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  /** FR-003: exactly three destinations, each with a label. */
  it('offers exactly the three destinations', () => {
    renderShell('/dashboard');

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const entries = within(nav).getAllByRole('link');

    expect(entries.map((entry) => entry.textContent)).toEqual([
      'Dashboard',
      'Produtores',
      'Safras',
    ]);
  });

  it('marks the destination currently being shown', () => {
    renderShell('/safras');

    expect(screen.getByRole('link', { name: 'Safras' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  /** FR-004: the menu reflects the section, not the exact address. */
  it('keeps Produtores marked on a producer detail page', () => {
    renderShell('/produtores/abc-123');

    expect(screen.getByRole('link', { name: 'Produtores' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not mark Dashboard on a nested route, since it matches exactly', () => {
    renderShell('/produtores');

    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  /** FR-005: navigating replaces only the main area. */
  it('keeps the header and menu mounted across a destination change', async () => {
    renderShell('/dashboard');

    const header = screen.getByRole('link', { name: 'AgroHub' });
    expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Produtores' }));

    expect(await screen.findByRole('heading', { name: 'Lista de produtores' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Painel' })).not.toBeInTheDocument();
    // The same DOM node, so the shell never unmounted.
    expect(screen.getByRole('link', { name: 'AgroHub' })).toBe(header);
  });

  /**
   * FR-007: below the tablet breakpoint the menu hides behind a header control.
   *
   * jsdom has no viewport, so it always renders the desktop layout where this control is
   * correctly `display: none`. Queried by label rather than by role+name, because the accessible
   * name of a display:none element computes to "" — its absence from the accessibility tree here
   * is the desktop behaviour working, not a bug.
   */
  function menuToggle() {
    return screen.getByLabelText('Abrir menu');
  }

  it('offers a menu toggle that opens the sidebar', async () => {
    const { store } = renderShell('/dashboard');

    expect(store.getState().ui.sidebarOpen).toBe(false);

    await userEvent.click(menuToggle());
    expect(store.getState().ui.sidebarOpen).toBe(true);
  });

  it('closes the mobile menu when a destination is chosen', async () => {
    const { store } = renderShell('/dashboard');

    await userEvent.click(menuToggle());
    expect(store.getState().ui.sidebarOpen).toBe(true);

    await userEvent.click(screen.getByRole('link', { name: 'Safras' }));

    expect(await screen.findByRole('heading', { name: 'Lista de safras' })).toBeInTheDocument();
    expect(store.getState().ui.sidebarOpen).toBe(false);
  });
});

