import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { ThemeProfileSync } from '@/features/auth/ThemeProfileSync';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { CategoryPage } from '@/pages/CategoryPage';
import { ElementDetailPage } from '@/pages/ElementDetailPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { NewElementPage } from '@/pages/NewElementPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SetupPage } from '@/pages/SetupPage';
import { TimelinePage } from '@/pages/TimelinePage';

export function App() {
  if (!supabase) return <SetupPage />;

  return (
    <BrowserRouter>
      <ThemeProfileSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="categories/:key" element={<CategoryPage />} />
          <Route path="elements/:id" element={<ElementDetailPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="elements/new" element={<NewElementPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
