import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { ThemeProfileSync } from "@/features/auth/ThemeProfileSync";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { LoginPage } from "@/pages/LoginPage";
import { SetupPage } from "@/pages/SetupPage";
import { UpdatePrompt } from "@/features/pwa/UpdatePrompt";

// The signed-in app loads screen by screen (Lighthouse, §11): the sign-in page doesn't download
// the dashboard, and each screen arrives the first time it's opened (then the service worker has it).
const named = <K extends string>(
  load: () => Promise<Record<K, React.ComponentType>>,
  name: K,
) => lazy(() => load().then((m) => ({ default: m[name] })));
const AppShell = named(
  () => import("@/components/layout/AppShell"),
  "AppShell",
);
const DashboardPage = named(
  () => import("@/pages/DashboardPage"),
  "DashboardPage",
);
const CategoriesPage = named(
  () => import("@/pages/CategoriesPage"),
  "CategoriesPage",
);
const CategoryPage = named(
  () => import("@/pages/CategoryPage"),
  "CategoryPage",
);
const ElementDetailPage = named(
  () => import("@/pages/ElementDetailPage"),
  "ElementDetailPage",
);
const TimelinePage = named(
  () => import("@/pages/TimelinePage"),
  "TimelinePage",
);
const NewElementPage = named(
  () => import("@/pages/NewElementPage"),
  "NewElementPage",
);
const SettingsPage = named(
  () => import("@/pages/SettingsPage"),
  "SettingsPage",
);
const NotFoundPage = named(
  () => import("@/pages/NotFoundPage"),
  "NotFoundPage",
);

function Loading() {
  return (
    <p role="status" className="page-shell py-6">
      Loading…
    </p>
  );
}

// Development-only layout check for the charts; the import is dropped from production builds.
const ChartsPreview = import.meta.env.DEV
  ? lazy(() => import("@/dev/ChartsPreview"))
  : null;

export function App() {
  if (!supabase) return <SetupPage />;

  return (
    <BrowserRouter>
      <ThemeProfileSync />
      <UpdatePrompt />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
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
      </Suspense>
    </BrowserRouter>
  );
}
