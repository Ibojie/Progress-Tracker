import { bandFor, type Band } from './bands';
import { daysBetween, laterOf } from './dates';
import { describeGoal } from './goals';
import { expectedPct, isBehindPace } from './pace';
import { inRange, type PeriodPair } from './periods';
import type { ElementStatus, EngineGoal, IsoDate } from './types';

export interface AdviceGoal extends EngineGoal {
  title: string;
  /** Completion date in the user's timezone, if done. */
  doneDate: IsoDate | null;
}

/** Everything the rule-based advice needs about one active element. */
export interface AdviceElement {
  id: string;
  name: string;
  categoryId: string;
  status: ElementStatus;
  pct: number;
  goals: AdviceGoal[];
  startDate: IsoDate | null;
  /** Day the current status was first recorded (from status_events), if known. */
  statusSince: IsoDate | null;
  /** Day of the most recent tick-box change, if any. */
  lastTickDate: IsoDate | null;
}

export interface CategoryProgress {
  id: string;
  name: string;
  pct: number;
  /** Same point of the previous period; null without history. */
  previousPct: number | null;
  overdue: number;
}

export interface FocusItem {
  goalId: string;
  goalTitle: string;
  elementId: string;
  elementName: string;
  daysLeft: number;
  band: Band;
  /** Days left before abandonment while overdue. */
  daysToAbandonment: number | null;
  behindPace: boolean;
  score: number;
}

export interface Stall {
  elementId: string;
  elementName: string;
  kind: 'no_ticks' | 'resource_delay' | 'started_idle';
  days: number;
}

export interface PaceFlag {
  elementId: string;
  elementName: string;
  actualPct: number;
  expectedPct: number;
}

export interface Advice {
  overall: string;
  focus: FocusItem[];
  keepTabsOn: PaceFlag[];
  behindPace: PaceFlag[];
  stalls: Stall[];
  wins: { completed: { elementId: string; elementName: string }[]; mostImproved: { name: string; points: number } | null };
}

export const STALL_NO_TICK_DAYS = 14;
export const STALL_WAITING_DAYS = 7;

/**
 * Higher = more urgent. Overdue goals score highest and climb each day; then the nearer the due
 * date, the higher. A goal's weight in its element (100 / N) and being behind pace add to it.
 */
export function urgencyScore(daysLeft: number, weightPct: number, behindPace: boolean): number {
  const time = daysLeft < 0 ? 100 + Math.min(-daysLeft, 7) * 5 : Math.max(0, 60 - 2 * daysLeft);
  return Math.round(time + weightPct * 0.3 + (behindPace ? 10 : 0));
}

function paceOf(el: AdviceElement, today: IsoDate): PaceFlag {
  return { elementId: el.id, elementName: el.name, actualPct: el.pct, expectedPct: expectedPct(el.goals, today) };
}

const bandRank = (daysLeft: number) => (daysLeft < 0 ? 0 : daysLeft <= 14 ? 1 : 2);

/** Overdue first, then 0–14 days, then 15–29 days; most urgent first inside each group (§7.1). */
export function focusItems(elements: readonly AdviceElement[], today: IsoDate, maxDays = 29): FocusItem[] {
  const items: FocusItem[] = [];
  for (const el of elements) {
    const pace = paceOf(el, today);
    const behind = isBehindPace(pace.actualPct, pace.expectedPct);
    for (const g of el.goals) {
      const info = describeGoal(g, today);
      if (info.state !== 'open' && info.state !== 'overdue') continue; // done, not started yet, or abandoned
      if (info.daysLeft > maxDays) continue;
      items.push({
        goalId: g.id,
        goalTitle: g.title,
        elementId: el.id,
        elementName: el.name,
        daysLeft: info.daysLeft,
        band: bandFor(info.daysLeft),
        daysToAbandonment: info.daysToAbandonment,
        behindPace: behind,
        score: urgencyScore(info.daysLeft, 100 / el.goals.length, behind),
      });
    }
  }
  return items.sort((a, b) => bandRank(a.daysLeft) - bandRank(b.daysLeft) || b.score - a.score || a.daysLeft - b.daysLeft);
}

export function findStalls(elements: readonly AdviceElement[], today: IsoDate): Stall[] {
  const out: Stall[] = [];
  for (const el of elements) {
    if (el.status === 'in_progress' && el.lastTickDate) {
      const days = daysBetween(el.lastTickDate, today);
      if (days >= STALL_NO_TICK_DAYS) out.push({ elementId: el.id, elementName: el.name, kind: 'no_ticks', days });
    }
    if ((el.status === 'resource_delay' || el.status === 'started') && el.startDate) {
      // Count from the later of the start date and when the status began (§4.6).
      const since = el.statusSince ? laterOf(el.startDate, el.statusSince) : el.startDate;
      const days = daysBetween(since, today);
      if (days > STALL_WAITING_DAYS) {
        out.push({ elementId: el.id, elementName: el.name, kind: el.status === 'resource_delay' ? 'resource_delay' : 'started_idle', days });
      }
    }
  }
  return out.sort((a, b) => b.days - a.days);
}

function signed(n: number, unit = ''): string {
  if (n === 0) return `no change`;
  return `${n > 0 ? '▲' : '▼'}${Math.abs(n)}${unit}`;
}

export interface OverallInputs {
  periodLabel: string;
  previousLabel: string;
  completedNow: number;
  completedBefore: number;
  overallPct: number;
  overallPctBefore: number | null;
  categories: readonly CategoryProgress[];
}

/** The template-driven summary paragraph (§7.1). */
export function overallComment(i: OverallInputs): string {
  const parts: string[] = [];
  const goals = i.completedNow === 1 ? 'goal' : 'goals';
  parts.push(
    `${i.periodLabel} you completed ${i.completedNow} ${goals} (${signed(i.completedNow - i.completedBefore)} vs ${i.previousLabel}).`,
  );
  parts.push(
    i.overallPctBefore === null
      ? `Overall completion is ${i.overallPct}%.`
      : `Overall completion is ${i.overallPct}% (${signed(i.overallPct - i.overallPctBefore, ' pts')}).`,
  );
  const active = i.categories.filter((c) => c.pct > 0 || c.overdue > 0);
  if (active.length >= 2) {
    const best = [...active].sort((a, b) => b.pct - a.pct)[0]!;
    const worst = [...active].sort((a, b) => a.pct - b.pct)[0]!;
    parts.push(`${best.name} is your strongest area at ${best.pct}%.`);
    if (worst.id !== best.id) {
      const overdue = worst.overdue > 0 ? ` with ${worst.overdue} ${worst.overdue === 1 ? 'goal' : 'goals'} overdue` : '';
      parts.push(`${worst.name} is lagging at ${worst.pct}%${overdue}.`);
    }
  }
  return parts.join(' ');
}

export interface AdviceInputs extends Omit<OverallInputs, 'categories'> {
  elements: readonly AdviceElement[];
  categories: readonly CategoryProgress[];
  period: PeriodPair;
  today: IsoDate;
}

export function buildAdvice(i: AdviceInputs): Advice {
  const paces = i.elements.filter((e) => e.status !== 'completed').map((e) => paceOf(e, i.today));
  const behind = paces.filter((p) => isBehindPace(p.actualPct, p.expectedPct));
  // Keep Tabs On: elements whose nearest open goal is 30+ days away, flagged only if behind pace.
  const farAway = new Set(
    i.elements
      .filter((e) => {
        const open = e.goals.filter((g) => !g.isDone).map((g) => daysBetween(i.today, g.dueDate));
        return open.length > 0 && Math.min(...open) >= 30;
      })
      .map((e) => e.id),
  );

  const completed = i.elements
    .filter((e) => e.status === 'completed')
    .filter((e) => {
      const last = e.goals.map((g) => g.doneDate).filter((d): d is IsoDate => !!d).sort().at(-1);
      return !!last && inRange(last, i.period.current);
    })
    .map((e) => ({ elementId: e.id, elementName: e.name }));

  const improvements = i.categories
    .filter((c) => c.previousPct !== null)
    .map((c) => ({ name: c.name, points: c.pct - (c.previousPct as number) }))
    .filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points);

  return {
    overall: overallComment(i),
    focus: focusItems(i.elements, i.today),
    keepTabsOn: behind.filter((p) => farAway.has(p.elementId)),
    behindPace: behind,
    stalls: findStalls(i.elements, i.today),
    wins: { completed, mostImproved: improvements[0] ?? null },
  };
}
