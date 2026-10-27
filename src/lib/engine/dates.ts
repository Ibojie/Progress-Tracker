import { formatInTimeZone } from 'date-fns-tz';
import type { IsoDate } from './types';

export const DEFAULT_TIMEZONE = 'Africa/Lagos';
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Today's calendar date in the given timezone. */
export function todayIn(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): IsoDate {
  return formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
}

function utcDay(date: IsoDate): number {
  const m = ISO_DATE.exec(date);
  if (!m) throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utcDay(to) - utcDay(from)) / MS_PER_DAY);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(utcDay(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The calendar date of an instant in the given timezone. */
export function dateIn(timestamp: string, timeZone: string = DEFAULT_TIMEZONE): IsoDate {
  return formatInTimeZone(new Date(timestamp), timeZone, 'yyyy-MM-dd');
}

/** Monday = 0 … Sunday = 6 (weeks start on Monday, §2). */
export function weekdayIndex(date: IsoDate): number {
  return (new Date(utcDay(date)).getUTCDay() + 6) % 7;
}

/** Every date from start to end inclusive. */
export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const n = daysBetween(start, end);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(start, i));
}

export function laterOf(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}
