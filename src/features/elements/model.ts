import {
  abandonedGoalCount,
  bandFor,
  completion,
  describeGoal,
  elementDaysLeft,
  elementStartDate,
  resolveElementStatus,
  type Band,
  type ElementStatus,
  type EngineElement,
  type EngineGoal,
  type GoalInfo,
  type IsoDate,
} from '@/lib/engine';
import type { CategoryKey, ElementRow, GoalRow } from '@/lib/database.types';

/** The shape returned by ELEMENT_SELECT in api.ts. */
export interface ElementWithGoals extends ElementRow {
  goals: GoalRow[];
  category: { id: string; key: CategoryKey; name: string } | null;
  status_events: { to_status: ElementStatus; created_at: string }[];
}

export interface GoalView {
  row: GoalRow;
  info: GoalInfo;
}

export interface ElementView {
  row: ElementWithGoals;
  goals: GoalView[];
  status: ElementStatus;
  pct: number;
  total: number;
  done: number;
  /** Days to the nearest unfinished goal; null when all are done. */
  daysLeft: number | null;
  /** Band of the nearest unfinished goal; null for completed or decommissioned elements (§5). */
  band: Band | null;
  startDate: IsoDate | null;
  overdueCount: number;
  abandonedCount: number;
  /** The nearest unfinished goal. */
  nextGoal: GoalView | null;
  /** Last status written to status_events, to detect changes. */
  lastLoggedStatus: ElementStatus | null;
}

export function toEngineGoal(g: GoalRow): EngineGoal {
  return { id: g.id, isDone: g.is_done, startDate: g.start_date, dueDate: g.due_date, tickChangedAt: g.tick_changed_at };
}

export function toEngineElement(e: ElementRow): EngineElement {
  return {
    isDecommissioned: e.is_decommissioned,
    zeroProgressStatus: e.zero_progress_status,
    recommissionedAt: e.recommissioned_at,
    restartedAt: e.restarted_at,
  };
}

export function sortGoals(goals: GoalRow[]): GoalRow[] {
  return [...goals].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export function buildElementView(row: ElementWithGoals, today: IsoDate): ElementView {
  const goalRows = sortGoals(row.goals);
  const engineGoals = goalRows.map(toEngineGoal);
  const status = resolveElementStatus(toEngineElement(row), engineGoals, today);
  const { pct, total, done } = completion(engineGoals);
  const goals = goalRows.map((g) => ({ row: g, info: describeGoal(toEngineGoal(g), today) }));
  const daysLeft = elementDaysLeft(engineGoals, today);
  const banded = status !== 'completed' && status !== 'decommissioned' && daysLeft !== null;
  const nextGoal = goals.filter((g) => !g.row.is_done).sort((a, b) => a.info.daysLeft - b.info.daysLeft)[0] ?? null;

  return {
    row,
    goals,
    status,
    pct,
    total,
    done,
    daysLeft,
    band: banded ? bandFor(daysLeft) : null,
    startDate: elementStartDate(engineGoals),
    overdueCount: goals.filter((g) => g.info.state === 'overdue').length,
    abandonedCount: abandonedGoalCount(engineGoals, today),
    nextGoal,
    lastLoggedStatus: row.status_events[0]?.to_status ?? null,
  };
}

/** "12 days left", "Due today", "Overdue · 4 days to abandonment", "Abandoned". */
export function dueText(info: GoalInfo, isDone: boolean): string {
  if (isDone) return 'Done';
  if (info.state === 'abandoned') return 'Abandoned';
  if (info.state === 'overdue') {
    const n = info.daysToAbandonment ?? 0;
    return `Overdue · ${n} ${n === 1 ? 'day' : 'days'} to abandonment`;
  }
  if (info.daysLeft === 0) return 'Due today';
  if (info.daysLeft === 1) return '1 day left';
  return `${info.daysLeft} days left`;
}

export function formatDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
