import {
  addDays,
  bandFor,
  daysBetween,
  describeGoal,
  eachDay,
  inRange,
  type AdviceElement,
  type Band,
  type ElementStatus,
  type IsoDate,
  type PeriodPair,
} from '@/lib/engine';

export interface NamedCategory {
  id: string;
  key: string;
  name: string;
}

/** Chart 2: goals completed per category, this period vs the same stretch of the last one. */
export function completedByCategory(elements: readonly AdviceElement[], categories: readonly NamedCategory[], period: PeriodPair) {
  return categories.map((c) => {
    const dates = elements.filter((e) => e.categoryId === c.id).flatMap((e) => e.goals.map((g) => g.doneDate).filter((d): d is IsoDate => !!d));
    return {
      key: c.key,
      name: c.name,
      current: dates.filter((d) => inRange(d, period.current)).length,
      previous: dates.filter((d) => inRange(d, period.previous)).length,
    };
  });
}

/** Chart 3: running total of goals completed, day by day, for both periods (aligned on day 1). */
export function cumulativeCompletions(doneDates: readonly IsoDate[], period: PeriodPair) {
  const running = (range: { start: IsoDate; end: IsoDate }) => {
    let total = 0;
    return eachDay(range.start, range.end).map((d) => (total += doneDates.filter((x) => x === d).length));
  };
  const current = running(period.current);
  const previous = running(period.previous);
  const length = Math.max(current.length, previous.length);
  return {
    days: Array.from({ length }, (_, i) => addDays(period.current.start, i)),
    current,
    previous,
  };
}

const MIX_ORDER: ElementStatus[] = ['not_started', 'started', 'resource_delay', 'in_progress', 'restarted', 'recommissioned', 'abandoned', 'completed'];

/** Chart 4: number of elements in each status, per category (decommissioned left out). */
export function statusMix(elements: readonly AdviceElement[], categories: readonly NamedCategory[]) {
  const statuses = MIX_ORDER.filter((s) => elements.some((e) => e.status === s));
  return {
    statuses,
    rows: categories.map((c) => ({
      key: c.key,
      name: c.name,
      counts: statuses.map((s) => elements.filter((e) => e.categoryId === c.id && e.status === s).length),
    })),
  };
}

export interface HeatCell {
  date: IsoDate;
  count: number;
  band: Band;
  goals: { goalId: string; title: string; elementId: string; elementName: string }[];
}

/** Chart 5: unfinished goals due on each of the next `days` days, coloured by that day's band. */
export function deadlineCalendar(elements: readonly AdviceElement[], today: IsoDate, days = 90): HeatCell[] {
  return eachDay(today, addDays(today, days - 1)).map((date) => {
    const goals = elements.flatMap((e) =>
      e.goals.filter((g) => !g.isDone && g.dueDate === date).map((g) => ({ goalId: g.id, title: g.title, elementId: e.id, elementName: e.name })),
    );
    return { date, count: goals.length, band: bandFor(daysBetween(today, date)), goals };
  });
}

export const BAND_ORDER: Band[] = ['overdue', 'immediate', 'short', 'medium', 'long'];

/** Chart 7: how many unfinished, not-yet-abandoned goals sit in each band right now. */
export function bandDistribution(elements: readonly AdviceElement[], today: IsoDate): { band: Band; count: number }[] {
  const counts = new Map<Band, number>(BAND_ORDER.map((b) => [b, 0]));
  for (const e of elements) {
    for (const g of e.goals) {
      const info = describeGoal(g, today);
      if (info.state === 'done' || info.state === 'abandoned') continue;
      const band = bandFor(info.daysLeft);
      counts.set(band, counts.get(band)! + 1);
    }
  }
  return BAND_ORDER.map((band) => ({ band, count: counts.get(band)! }));
}

/**
 * Chart 8: goals still open on each day, against an ideal straight line from all goals at the
 * start date to none on the last due date. Actual values stop at today.
 */
export function burndown(goals: readonly { startDate: IsoDate; dueDate: IsoDate; doneDate: IsoDate | null }[], today: IsoDate) {
  if (goals.length === 0) return null;
  const start = goals.map((g) => g.startDate).sort()[0]!;
  const lastDue = goals.map((g) => g.dueDate).sort().at(-1)!;
  const end = today > lastDue ? today : lastDue;
  const span = Math.max(1, daysBetween(start, lastDue));
  const days = eachDay(start, end);
  return {
    days,
    ideal: days.map((d) => Math.max(0, +(goals.length * (1 - daysBetween(start, d) / span)).toFixed(2))),
    actual: days.map((d) => (d > today ? null : goals.filter((g) => !g.doneDate || g.doneDate > d).length)),
  };
}
