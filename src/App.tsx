import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
import { LoadErrorBoundary } from '@/components/LoadErrorBoundary';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { ThemeProfileSync } from '@/features/auth/ThemeProfileSync';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { LoginPage } from '@/pages/LoginPage';
import { SetupPage } from '@/pages/SetupPage';
import { UpdatePrompt } from '@/features/pwa/UpdatePrompt';

// The signed-in screens load on demand (Lighthouse, §11): the sign-in page doesn't download
// them, and each arrives the first time it's opened (then the service worker keeps it).
// The shell (header, menus) is small and loads straight away, so it stays on screen meanwhile.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const loadDashboard = () => import('@/pages/DashboardPage');
const DashboardPage = named(loadDashboard, 'DashboardPage');
const CategoriesPage = named(() => import('@/pages/CategoriesPage'), 'CategoriesPage');
const CategoryPage = named(() => import('@/pages/CategoryPage'), 'CategoryPage');
const ElementDetailPage = named(() => import('@/pages/ElementDetailPage'), 'ElementDetailPage');
const TimelinePage = named(() => import('@/pages/TimelinePage'), 'TimelinePage');
const NewElementPage = named(() => import('@/pages/NewElementPage'), 'NewElementPage');
const SettingsPage = named(() => import('@/pages/SettingsPage'), 'SettingsPage');
const NotFoundPage = named(() => import('@/pages/NotFoundPage'), 'NotFoundPage');
const LegalPage = named(() => import('@/pages/LegalRoutes'), 'LegalRoute');
// Public legal pages (Google Play links to these): no sign-in needed.
const LEGAL_SLUGS = ['privacy', 'terms', 'fair-use', 'refunds', 'account-deletion'] as const;

// Signed in: start fetching the dashboard while the session is checked, not after.
if (typeof window !== 'undefined') void loadDashboard().catch(() => {});

// Development-only layout check for the charts; the import is dropped from production builds.
const ChartsPreview = import.meta.env.DEV ? lazy(() => import('@/dev/ChartsPreview')) : null;

export function App() {
  if (!supabase) return <SetupPage />;

  return (
    // v7_startTransition: moving to a screen that's still loading keeps the current one showing.
    <BrowserRouter future={{ v7_startTransition: true }}>
      <ThemeProfileSync />
      <UpdatePrompt />
      <LoadErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          {LEGAL_SLUGS.map((slug) => (
            <Route
              key={slug}
              path={`/${slug}`}
              element={
                <Suspense fallback={null}>
                  <LegalPage />
                </Suspense>
              }
            />
          ))}
          {ChartsPreview && (
            <Route
              path="/__dev/charts"
              element={
                <Suspense fallback={null}>
                  <ChartsPreview />
                </Suspense>
              }
            />
          )}
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
      </LoadErrorBoundary>
    </BrowserRouter>
  );
}
