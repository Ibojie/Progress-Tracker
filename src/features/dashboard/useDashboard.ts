import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCategories } from '@/features/categories/useCategories';
import { useElementViews } from '@/features/elements/api';
import type { ElementView } from '@/features/elements/model';
import { useTimezone, useToday } from '@/features/profile/useProfile';
import {
  PERIOD_LABEL,
  addDays,
  buildAdvice,
  categoryPctAt,
  computeKpis,
  daysBetween,
  dateIn,
  periodPair,
  type AdviceElement,
  type CategoryProgress,
  type DateRange,
  type DayTotals,
  type IsoDate,
  type PeriodKind,
  type Snapshot,
} from '@/lib/engine';
import type { CategoryRow } from '@/lib/database.types';

/** Snapshots from `from` to today, for KPIs, sparklines and the radar's "previous" values. */
function useSnapshots(from: IsoDate) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['snapshots', user?.id, from],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<Snapshot[]> => {
      const { data, error } = await supabase!
        .from('daily_snapshots')
        .select('snapshot_date, element_id, category_id, status, goals_total, goals_done, overdue_count, abandoned_count, due_soon_count')
        .gte('snapshot_date', from)
        .order('snapshot_date');
      if (error) throw error;
      return data.map((r) => ({
        date: r.snapshot_date,
        elementId: r.element_id,
        categoryId: r.category_id,
        status: r.status,
        goalsTotal: r.goals_total,
        goalsDone: r.goals_done,
        overdue: r.overdue_count,
        abandoned: r.abandoned_count,
        dueSoon: r.due_soon_count,
      }));
    },
  });
}

export function liveTotals(views: readonly ElementView[]): DayTotals {
  const t: DayTotals = { goalsTotal: 0, goalsDone: 0, overdue: 0, abandoned: 0, dueSoon: 0 };
  for (const v of views) {
    t.goalsTotal += v.total;
    t.goalsDone += v.done;
    for (const g of v.goals) {
      if (g.info.state === 'overdue') t.overdue++;
      if (g.info.state === 'abandoned') t.abandoned++;
      if (!g.row.is_done && g.info.daysLeft >= 0 && g.info.daysLeft <= 14) t.dueSoon++;
    }
  }
  return t;
}

function toAdviceElement(v: ElementView, tz: string): AdviceElement {
  const latest = v.row.status_events[0];
  const ticks = v.goals.map((g) => g.row.tick_changed_at).filter((t): t is string => !!t).sort();
  return {
    id: v.row.id,
    name: v.row.name,
    categoryId: v.row.category_id,
    status: v.status,
    pct: v.pct,
    startDate: v.startDate,
    // Only trust the recorded time if it belongs to the status the element has now.
    statusSince: latest && latest.to_status === v.status ? dateIn(latest.created_at, tz) : null,
    lastTickDate: ticks.length ? dateIn(ticks[ticks.length - 1]!, tz) : null,
    goals: v.goals.map((g) => ({
      id: g.row.id,
      title: g.row.title,
      isDone: g.row.is_done,
      startDate: g.row.start_date,
      dueDate: g.row.due_date,
      tickChangedAt: g.row.tick_changed_at,
      doneDate: g.row.done_at ? dateIn(g.row.done_at, tz) : null,
    })),
  };
}

export interface CategorySummary extends CategoryProgress {
  key: CategoryRow['key'];
  views: ElementView[];
  nextDue: { daysLeft: number; goalTitle: string; elementName: string } | null;
}

export function useDashboard(kind: PeriodKind, custom?: DateRange) {
  const today = useToday();
  const tz = useTimezone();
  const elements = useElementViews();
  const categories = useCategories();

  const period = useMemo(() => {
    try {
      return periodPair(kind, today, custom);
    } catch {
      return periodPair('week', today);
    }
  }, [kind, today, custom]);

  // Enough history for the previous period and the sparklines.
  const snapshots = useSnapshots(addDays(period.previous.start, -1));

  return useMemo(() => {
    const active = elements.views.filter((v) => v.status !== 'decommissioned');
    const adviceElements = active.map((v) => toAdviceElement(v, tz));
    const doneDates = adviceElements.flatMap((e) => e.goals.map((g) => g.doneDate).filter((d): d is IsoDate => !!d));
    const snaps = snapshots.data ?? [];
    const totals = liveTotals(active);
    const kpis = computeKpis({ period, today: totals, doneDates, snapshots: snaps });
    const byKey = Object.fromEntries(kpis.map((k) => [k.key, k]));

    const categorySummaries: CategorySummary[] = (categories.data ?? []).map((c) => {
      const views = active.filter((v) => v.row.category_id === c.id);
      const t = liveTotals(views);
      const next = views
        .flatMap((v) => v.goals.filter((g) => !g.row.is_done && g.info.state !== 'abandoned' && g.info.state !== 'not_started').map((g) => ({ v, g })))
        .sort((a, b) => a.g.info.daysLeft - b.g.info.daysLeft)[0];
      return {
        id: c.id,
        key: c.key,
        name: c.name,
        pct: t.goalsTotal ? Math.round((t.goalsDone / t.goalsTotal) * 100) : 0,
        previousPct: categoryPctAt(snaps, c.id, period.previous),
        overdue: t.overdue,
        views,
        nextDue: next ? { daysLeft: next.g.info.daysLeft, goalTitle: next.g.row.title, elementName: next.v.row.name } : null,
      };
    });

    const label = PERIOD_LABEL[period.kind];
    const advice = buildAdvice({
      periodLabel: label.current,
      previousLabel: label.previous,
      completedNow: byKey.completed?.value ?? 0,
      completedBefore: byKey.completed?.previous ?? 0,
      overallPct: byKey.completion?.value ?? 0,
      overallPctBefore: byKey.completion?.previous ?? null,
      categories: categorySummaries,
      elements: adviceElements,
      period,
      today,
    });

    return {
      today,
      period,
      label,
      periodDays: daysBetween(period.current.start, period.current.end) + 1,
      isLoading: elements.isLoading || categories.isLoading,
      error: elements.error ?? categories.error ?? snapshots.error,
      active,
      adviceElements,
      doneDates,
      kpis,
      advice,
      categories: categorySummaries,
      snapshots: snaps,
    };
  }, [elements.views, elements.isLoading, elements.error, categories.data, categories.isLoading, categories.error, snapshots.data, snapshots.error, period, today, tz]);
}

export type DashboardData = ReturnType<typeof useDashboard>;
