import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { PageTransition } from './PageTransition';
import { ToastRegion } from '../components/ToastRegion';
import { useAppDispatch } from '../app/hooks';
import { navigated } from '../features/ui/uiSlice';

const Main = styled.main`
  margin-top: ${({ theme }) => theme.layout.headerHeight};
  margin-left: ${({ theme }) => theme.layout.sidebarWidth};
  padding: ${({ theme }) => theme.space.lg};
  min-height: calc(100vh - ${({ theme }) => theme.layout.headerHeight});

  @media (max-width: ${({ theme }) => theme.breakpoint.tablet}) {
    margin-left: 0;
    padding: ${({ theme }) => theme.space.md};
  }
`;

const Content = styled.div`
  max-width: ${({ theme }) => theme.layout.contentMaxWidth};
  margin: 0 auto;
`;

/**
 * Where focus lands after a navigation (FR-056).
 *
 * No ring: the visitor did not Tab here, the app moved focus for them, so drawing the global
 * focus-visible outline would paint a stray line across the top of every page. Keyboard users
 * still get the ring on the controls they actually reach.
 */
const FocusAnchor = styled.div`
  &:focus,
  &:focus-visible {
    outline: none;
  }
`;

/**
 * The parent layout route.
 *
 * This is what delivers FR-005 structurally: the header and sidebar are mounted by the parent
 * and never unmount on navigation — only the <Outlet/> content is replaced. Nothing else in the
 * design has to behave for the shell to stay put.
 */
export function AppShell() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const headingAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Closes the mobile menu, so it never sits over the content just asked for (FR-007).
    dispatch(navigated());

    // Reset scroll on a path change only. A search-parameter change means the visitor paged or
    // searched in place, and yanking the viewport there would be hostile (contracts/routes.md).
    window.scrollTo({ top: 0 });

    // Focus follows navigation, so keyboard and screen-reader users are not left back in the
    // sidebar after the content changed under them (FR-056).
    headingAnchor.current?.focus();
  }, [dispatch, location.pathname]);

  return (
    <>
      <Header />
      <Sidebar />
      <Main>
        <Content>
          <FocusAnchor ref={headingAnchor} tabIndex={-1} />
          <PageTransition routeKey={location.pathname}>
            <Outlet />
          </PageTransition>
        </Content>
      </Main>
      <ToastRegion />
    </>
  );
}
