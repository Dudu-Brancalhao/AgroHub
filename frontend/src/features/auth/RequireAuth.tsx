import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectIsBootstrapping } from './selectors';
import { ShellSkeleton } from '../../layout/ShellSkeleton';

/**
 * The single enforcement point for FR-009 and FR-010.
 *
 * Three states, and the middle one is the reason this component exists: while the stored token
 * is still being verified the app does not yet know whether it has a session, and redirecting
 * then would flash the sign-in screen at every reload for an already-signed-in user.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isBootstrapping = useAppSelector(selectIsBootstrapping);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();

  if (isBootstrapping) return <ShellSkeleton />;

  if (!isAuthenticated) {
    // `replace` matters: without it, Back lands on the protected URL again and bounces.
    return <Navigate to="/entrar" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/** The mirror image: a signed-in visitor has no business on the sign-in screen. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const isBootstrapping = useAppSelector(selectIsBootstrapping);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  if (isBootstrapping) return <ShellSkeleton />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
