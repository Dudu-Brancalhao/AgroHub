import { Navigate, Route, Routes } from 'react-router-dom';
import { SignIn } from '../features/auth/SignIn';
import { SignUp } from '../features/auth/SignUp';
import { RedirectIfAuthenticated, RequireAuth } from '../features/auth/RequireAuth';
import { AppShell } from '../layout/AppShell';
import { NotFound } from '../components/NotFound';
import { Dashboard } from '../features/dashboard/Dashboard';
import { ProducerList } from '../features/producers/ProducerList';
import { ProducerDetail } from '../features/producers/ProducerDetail';
import { ProducerFormPage } from '../features/producers/ProducerFormPage';
import { SafraList } from '../features/harvests/SafraList';
import { SafraDetail } from '../features/harvests/SafraDetail';

/**
 * The URL surface (contracts/routes.md).
 *
 * Every protected destination nests under RequireAuth -> AppShell, which is what keeps the shell
 * mounted across navigation (FR-005) and gives each destination its own address (FR-006).
 *
 * Farm and planting forms are deliberately absent: they are modals over the producer detail,
 * because they always edit a child of the record already on screen and carry no state worth
 * bookmarking.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/entrar"
        element={
          <RedirectIfAuthenticated>
            <SignIn />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/criar-conta"
        element={
          <RedirectIfAuthenticated>
            <SignUp />
          </RedirectIfAuthenticated>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/produtores" element={<ProducerList />} />
        <Route path="/produtores/novo" element={<ProducerFormPage mode="create" />} />
        <Route path="/produtores/:id" element={<ProducerDetail />} />
        <Route path="/produtores/:id/editar" element={<ProducerFormPage mode="edit" />} />

        <Route path="/safras" element={<SafraList />} />
        <Route path="/safras/:id" element={<SafraDetail />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
