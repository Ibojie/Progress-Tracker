import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { AdviceCard } from '@/features/dashboard/AdviceCard';
import { BandLegend } from '@/features/dashboard/BandLegend';
import { CategoryCards } from '@/features/dashboard/CategoryCards';
import { FocusNow } from '@/features/dashboard/FocusNow';
import { KpiTiles } from '@/features/dashboard/KpiTiles';
import { PeriodSwitcher } from '@/features/dashboard/PeriodSwitcher';
import { useDashboard } from '@/features/dashboard/useDashboard';
import { InstallBanner } from '@/features/pwa/InstallPrompt';
import { useToday } from '@/features/profile/useProfile';
import { addDays, type DateRange, type PeriodKind } from '@/lib/engine';

const DashboardCharts = lazy(() => import('@/features/dashboard/charts/DashboardCharts'));
const PERIOD_KEY = 'pt-dashboard-period';

function storedKind(): PeriodKind {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    return v === 'month' || v === 'quarter' || v === 'custom' ? v : 'week';
  } catch {
    return 'week';
  }
}

export function DashboardPage() {
  const today = useToday();
  const [kind, setKind] = useState<PeriodKind>(storedKind);
  const [custom, setCustom] = useState<DateRange>(() => ({ start: addDays(today, -13), end: today }));
  const data = useDashboard(kind, kind === 'custom' && custom.end >= custom.start ? custom : undefined);

  function chooseKind(k: PeriodKind) {
    setKind(k);
    try {
      localStorage.setItem(PERIOD_KEY, k);
    } catch {
      // Storage blocked: the choice just isn't remembered.
    }
  }

  if (data.isLoading) return <p role="status">Loading your dashboard…</p>;
  if (data.error) return <p role="alert" className="text-destructive">Couldn’t load the dashboard: {data.error.message}</p>;

  return (
    <>
      <h1 className="sr-only">Dashboard</h1>
      <FocusNow data={data} />
      <InstallBanner />

      {data.active.length === 0 ? (
        <section className="glass mb-6 rounded-lg p-6">
          <h2 className="flex items-center gap-2 text-h3 font-semibold">
            <Sparkles aria-hidden className="size-6 text-primary" /> Start tracking
          </h2>
          <p className="mt-2 max-w-prose text-secondary text-muted-foreground">
            Add the first thing you want to finish: your PMI, a NEBOSH unit, a book or a business milestone. The wizard has
            quick templates to start from.
          </p>
          <Link to="/elements/new" className={`${buttonVariants()} mt-4`}>
            <Plus aria-hidden /> Add your first element
          </Link>
        </section>
      ) : (
        <>
          <PeriodSwitcher kind={kind} custom={custom} onKind={chooseKind} onCustom={setCustom} />
          <KpiTiles kpis={data.kpis} previousLabel={`same point ${data.label.previous}`} />
          <AdviceCard advice={data.advice} />
        </>
      )}

      <h2 className="mb-4 text-h2 font-semibold">Areas</h2>
      <CategoryCards categories={data.categories} />

      {data.active.length > 0 && (
        <>
          <BandLegend />
          <Suspense fallback={<p role="status">Loading charts…</p>}>
            <DashboardCharts data={data} />
          </Suspense>
        </>
      )}
    </>
  );
}
