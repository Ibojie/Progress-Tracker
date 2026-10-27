import { eachDay } from './dates';
import { inRange, type DateRange, type PeriodPair } from './periods';
import type { IsoDate } from './types';

/**
 * Snapshot totals for one category on one day (from the snapshot_totals database function,
 * which already leaves out elements that are switched off now).
 */
export interface Snapshot {
  date: IsoDate;
  categoryId: string;
  goalsTotal: number;
  goalsDone: number;
  overdue: number;
  abandoned: number;
  dueSoon: number;
}

/** Totals across all active elements for one day. */
export interface DayTotals {
  goalsTotal: number;
  goalsDone: number;
  overdue: number;
  abandoned: number;
  dueSoon: number;
}

export type KpiKey = 'completion' | 'completed' | 'dueSoon' | 'overdue' | 'abandoned';

export interface Kpi {
  key: KpiKey;
  label: string;
  value: number;
  /** Value at the same point of the previous period; null when there is no history yet. */
  previous: number | null;
  delta: number | null;
  /** Whether a rise is good news (completion) or bad (overdue). */
  goodWhenUp: boolean;
  /** Daily values across the current period, ending with today. */
  series: number[];
  unit?: '%';
}

const EMPTY: DayTotals = { goalsTotal: 0, goalsDone: 0, overdue: 0, abandoned: 0, dueSoon: 0 };

/** Sum the category rows per day. */
export function totalsByDay(snapshots: readonly Snapshot[]): Map<IsoDate, DayTotals> {
  const out = new Map<IsoDate, DayTotals>();
  for (const s of snapshots) {
    const t = out.get(s.date) ?? { ...EMPTY };
    t.goalsTotal += s.goalsTotal;
    t.goalsDone += s.goalsDone;
    t.overdue += s.overdue;
    t.abandoned += s.abandoned;
    t.dueSoon += s.dueSoon;
    out.set(s.date, t);
  }
  return out;
}

export function pctOf(t: DayTotals): number {
  return t.goalsTotal === 0 ? 0 : Math.round((t.goalsDone / t.goalsTotal) * 100);
}

/** The latest snapshot day on or before `date` within `range`, if any. */
function totalsAt(byDay: Map<IsoDate, DayTotals>, range: DateRange): DayTotals | null {
  for (const day of eachDay(range.start, range.end).reverse()) {
    const t = byDay.get(day);
    if (t) return t;
  }
  return null;
}

export interface KpiInputs {
  period: PeriodPair;
  /** Today's date (user's timezone). */
  asOf: IsoDate;
  /** Live figures for today (active elements only). */
  today: DayTotals;
  /** Completion dates (user's timezone) of goals in active elements. */
  doneDates: readonly IsoDate[];
  snapshots: readonly Snapshot[];
}

/** The five KPI tiles with deltas against the same point of the previous period (§6.1). */
export function computeKpis({ period, asOf, today, doneDates, snapshots }: KpiInputs): Kpi[] {
  const byDay = totalsByDay(snapshots);
  const prev = totalsAt(byDay, period.previous);
  // A custom range that ended in the past is shown as it stood on its last day, not as of today.
  const live = period.current.end >= asOf;
  const current = live ? today : (totalsAt(byDay, period.current) ?? EMPTY);
  const days = eachDay(period.current.start, live && period.current.end > asOf ? asOf : period.current.end);
  // History from snapshots; while the range is live, today's figure is the last point.
  const seriesOf = (pick: (t: DayTotals) => number) =>
    days
      .map((d, i) => (live && i === days.length - 1 ? pick(today) : byDay.has(d) ? pick(byDay.get(d)!) : null))
      .filter((v): v is number => v !== null);

  const countDone = (range: DateRange) => doneDates.filter((d) => inRange(d, range)).length;
  let running = 0;
  const completedSeries = days.map((d) => (running += doneDates.filter((x) => x === d).length));

  const level = (key: KpiKey, label: string, pick: (t: DayTotals) => number, goodWhenUp: boolean, unit?: '%'): Kpi => {
    const value = pick(current);
    const previous = prev ? pick(prev) : null;
    return { key, label, value, previous, delta: previous === null ? null : value - previous, goodWhenUp, series: seriesOf(pick), unit };
  };

  const completedNow = countDone(period.current);
  const completedBefore = countDone(period.previous);

  return [
    level('completion', 'Overall completion', pctOf, true, '%'),
    {
      key: 'completed',
      label: 'Goals completed',
      value: completedNow,
      previous: completedBefore,
      delta: completedNow - completedBefore,
      goodWhenUp: true,
      series: completedSeries,
    },
    level('dueSoon', 'Due in the next 14 days', (t) => t.dueSoon, false),
    level('overdue', 'Overdue', (t) => t.overdue, false),
    level('abandoned', 'Abandoned', (t) => t.abandoned, false),
  ];
}

/** Category % at the same point of the previous period, from snapshots (null without history). */
export function categoryPctAt(snapshots: readonly Snapshot[], categoryId: string, range: DateRange): number | null {
  const t = totalsAt(totalsByDay(snapshots.filter((s) => s.categoryId === categoryId)), range);
  return t ? pctOf(t) : null;
}
