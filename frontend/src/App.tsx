import { useEffect } from 'react';
import { AppRoutes } from './app/routes';
import { useAppDispatch } from './app/hooks';
import { bootstrapSession, sessionCleared } from './features/auth/authSlice';
import { SESSION_STORAGE_KEY } from './features/auth/sessionStorage';

export function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(bootstrapSession());
  }, [dispatch]);

  useEffect(() => {
    /**
     * Cross-tab sign-out.
     *
     * The `storage` event fires in every tab except the one that wrote, so a tab that signs out
     * takes its siblings with it. Without this, another open tab keeps showing protected content
     * until its next request happens to 401 (spec.md edge case "two tabs, one session").
     */
    function handleStorage(event: StorageEvent) {
      if (event.key === SESSION_STORAGE_KEY && event.newValue === null) {
        dispatch(sessionCleared());
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [dispatch]);

  return <AppRoutes />;
}
