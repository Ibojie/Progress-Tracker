import { addDays, daysBetween, weekdayIndex } from './dates';
import type { IsoDate } from './types';

export type PeriodKind = 'week' | 'month' | 'quarter' | 'custom';

export interface DateRange {
  start: IsoDate;
  end: IsoDate;
}

export interface PeriodPair {
  kind: PeriodKind;
  /** From the start of this period to today (or the custom range). */
  current: DateRange;
  /**
   * The same stretch of the previous period, so the comparison is like for like:
   * on a Wednesday, Mon–Wed this week is compared with Mon–Wed last week.
   */
  previous: DateRange;
}

export const PERIOD_LABEL: Record<PeriodKind, { current: string; previous: string }> = {
  week: { current: 'This week', previous: 'last week' },
  month: { current: 'This month', previous: 'last month' },
  quarter: { current: 'This quarter', previous: 'last quarter' },
  custom: { current: 'Selected range', previous: 'the period before' },
};

function monthStart(date: IsoDate, monthsBack = 0): IsoDate {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 - monthsBack;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 10);
}

/** Last day of the month containing `date`. */
function monthEnd(date: IsoDate): IsoDate {
  return addDays(monthStart(date, -1), -1);
}

/** Same day offset inside the previous period, capped at that period's last day. */
function sameStretch(prevStart: IsoDate, prevLastDay: IsoDate, offset: number): DateRange {
  const end = addDays(prevStart, offset);
  return { start: prevStart, end: end > prevLastDay ? prevLastDay : end };
}

export function periodPair(kind: PeriodKind, today: IsoDate, custom?: DateRange): PeriodPair {
  if (kind === 'week') {
    const start = addDays(today, -weekdayIndex(today));
    const prevStart = addDays(start, -7);
    return { kind, current: { start, end: today }, previous: sameStretch(prevStart, addDays(start, -1), daysBetween(start, today)) };
  }
  if (kind === 'month') {
    const start = monthStart(today);
    const prevStart = monthStart(today, 1);
    return { kind, current: { start, end: today }, previous: sameStretch(prevStart, monthEnd(prevStart), daysBetween(start, today)) };
  }
  if (kind === 'quarter') {
    const back = (Number(today.slice(5, 7)) - 1) % 3;
    const start = monthStart(today, back);
    const prevStart = monthStart(start, 3);
    return { kind, current: { start, end: today }, previous: sameStretch(prevStart, addDays(start, -1), daysBetween(start, today)) };
  }
  if (!custom || custom.end < custom.start) throw new RangeError('A custom period needs a start date on or before its end date.');
  const length = daysBetween(custom.start, custom.end);
  const prevEnd = addDays(custom.start, -1);
  return { kind, current: custom, previous: { start: addDays(prevEnd, -length), end: prevEnd } };
}

export function inRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}
