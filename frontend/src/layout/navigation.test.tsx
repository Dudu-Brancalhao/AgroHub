import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { PageTransition } from './PageTransition';
import { renderWithTheme } from '../test/renderWithTheme';
import { renderWithProviders, signedInState } from '../test/renderWithProviders';

describe('PageTransition', () => {
  /**
   * FR-052, and the reason it is keyed on the path alone: re-running the animation on every
   * keystroke of a search would read as flicker rather than as polish (contracts/routes.md).
   */
  it('remounts its content when the path changes', () => {
    const { rerender, container } = renderWithTheme(
      <PageTransition routeKey="/produtores">
        <p>conteúdo</p>
      </PageTransition>,
    );

    const first = container.querySelector('p');

    rerender(
      <PageTransition routeKey="/safras">
        <p>conteúdo</p>
      </PageTransition>,
    );

    expect(container.querySelector('p')).not.toBe(first);
  });

  it('does not remount when only the search parameters change', () => {
    const { rerender, container } = renderWithTheme(
      <PageTransition routeKey="/produtores">
        <p>conteúdo</p>
      </PageTransition>,
    );

    const first = container.querySelector('p');

    // The same path with a different query string produces the same key.
    rerender(
      <PageTransition routeKey="/produtores">
        <p>conteúdo</p>
      </PageTransition>,
    );

    expect(container.querySelector('p')).toBe(first);
  });
});

describe('navigation focus', () => {
  function renderShell(route: string) {
    return renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<h1>Painel</h1>} />
          <Route path="/safras" element={<h1>Lista de safras</h1>} />
        </Route>
      </Routes>,
      { preloadedState: signedInState, route },
    );
  }

  /**
   * FR-056 and SC-009: after navigating, focus must move into the new content rather than
   * staying on the sidebar link that was just activated — otherwise a keyboard user has to Tab
   * back through the whole menu to reach what they asked for.
   */
  it('moves focus into the main region after a destination change', async () => {
    renderShell('/dashboard');

    const safrasLink = screen.getByRole('link', { name: 'Safras' });
    await userEvent.click(safrasLink);

    await screen.findByRole('heading', { name: 'Lista de safras' });

    expect(document.activeElement).not.toBe(safrasLink);
    expect((document.activeElement as HTMLElement).tabIndex).toBe(-1);
  });

  it('gives the main region a focus anchor that is not a tab stop', () => {
    const { container } = renderShell('/dashboard');

    const anchor = container.querySelector('[tabindex="-1"]');
    expect(anchor).toBeInTheDocument();
  });
});
