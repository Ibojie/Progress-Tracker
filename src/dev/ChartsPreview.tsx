// Development only (see App.tsx): renders the real dashboard charts with sample data so
// layouts can be checked at any screen width without signing in. Never shipped to production.
import DashboardCharts from '@/features/dashboard/charts/DashboardCharts';
import type { DashboardData } from '@/features/dashboard/useDashboard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PERIOD_LABEL, addDays, buildAdvice, computeKpis, periodPair, type AdviceElement } from '@/lib/engine';

const TODAY = '2026-10-28';
const period = periodPair('week', TODAY);

function goal(id: string, start: number, due: number, doneOffset?: number) {
  return {
    id,
    title: `Goal ${id}`,
    isDone: doneOffset !== undefined,
    startDate: addDays(TODAY, start),
    dueDate: addDays(TODAY, due),
    tickChangedAt: null,
    doneDate: doneOffset !== undefined ? addDays(TODAY, doneOffset) : null,
  };
}

const elements: AdviceElement[] = [
  { id: 'pmi', name: 'PMI 2027', categoryId: 'c1', status: 'in_progress', pct: 75, startDate: addDays(TODAY, -20), statusSince: null, lastTickDate: null, goals: [goal('a', -20, 5, -1), goal('b', -20, 12, -2), goal('c', -20, 40, -8), goal('d', -20, 60)] },
  { id: 'naija', name: 'Naija Commerce', categoryId: 'c2', status: 'started', pct: 0, startDate: addDays(TODAY, -5), statusSince: null, lastTickDate: null, goals: [goal('e', -5, -2), goal('f', -5, 20)] },
  { id: 'land', name: 'Land/Properties', categoryId: 'c3', status: 'resource_delay', pct: 0, startDate: addDays(TODAY, -30), statusSince: null, lastTickDate: null, goals: [goal('g', -30, 0), goal('h', -30, 85)] },
  { id: 'nebosh', name: 'NEBOSH', categoryId: 'c4', status: 'completed', pct: 100, startDate: addDays(TODAY, -40), statusSince: null, lastTickDate: null, goals: [goal('i', -40, 3, 0), goal('j', -40, 9, -9)] },
];

const categories = [
  { id: 'c1', key: 'paid_job' as const, name: 'Paid Job', pct: 75, previousPct: 50, overdue: 0, views: [], nextDue: null },
  { id: 'c2', key: 'business' as const, name: 'Business', pct: 0, previousPct: 0, overdue: 1, views: [], nextDue: null },
  { id: 'c3', key: 'investment' as const, name: 'Investment', pct: 0, previousPct: null, overdue: 0, views: [], nextDue: null },
  { id: 'c4', key: 'personal_development' as const, name: 'Personal Development', pct: 100, previousPct: 60, overdue: 0, views: [], nextDue: null },
];

const doneDates = elements.flatMap((e) => e.goals.map((g) => g.doneDate).filter((d): d is string => !!d));
const kpis = computeKpis({ period, asOf: TODAY, today: { goalsTotal: 10, goalsDone: 5, overdue: 1, abandoned: 0, dueSoon: 4 }, doneDates, snapshots: [] });
const label = PERIOD_LABEL.week;

const data = {
  today: TODAY,
  period,
  label,
  periodDays: 3,
  isLoading: false,
  error: null,
  active: [],
  adviceElements: elements,
  doneDates,
  kpis,
  advice: buildAdvice({ periodLabel: label.current, previousLabel: label.previous, completedNow: 3, completedBefore: 1, overallPct: 50, overallPctBefore: 40, categories, elements, period, today: TODAY }),
  categories,
  snapshots: [],
} as unknown as DashboardData;

export default function ChartsPreview() {
  return (
    <main className="page-shell py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-h2 font-bold">Charts preview (development only)</h1>
        <ThemeToggle />
      </div>
      <DashboardCharts data={data} />
    </main>
  );
}
