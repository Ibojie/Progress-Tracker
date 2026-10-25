import { useAuth } from '@/features/auth/AuthProvider';
import { CategoryGrid } from '@/features/categories/CategoryGrid';
import { ComingSoon, PageHeader } from '@/components/PagePlaceholder';

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Dashboard" description={user?.email ? `Signed in as ${user.email}` : undefined} />
      <section aria-labelledby="areas" className="mb-8">
        <h2 id="areas" className="mb-4 text-h2 font-semibold">
          Your four areas
        </h2>
        <CategoryGrid />
      </section>
      <ComingSoon phase={3}>
        Focus Now, KPI tiles, period comparisons, charts and advice will appear here.
      </ComingSoon>
    </>
  );
}
