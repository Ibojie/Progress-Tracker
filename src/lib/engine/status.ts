import { daysBetween } from './dates';
import { goalState } from './goals';
import { completion } from './progress';
import type { ElementStatus, EngineElement, EngineGoal, IsoDate, IsoTimestamp, ZeroProgressStatus } from './types';

/** The element starts on the earliest start date of its goals (§4.6). */
export function elementStartDate(goals: readonly EngineGoal[]): IsoDate | null {
  let earliest: IsoDate | null = null;
  for (const g of goals) if (earliest === null || g.startDate < earliest) earliest = g.startDate;
  return earliest;
}

export function hasReachedStart(goals: readonly EngineGoal[], today: IsoDate): boolean {
  const start = elementStartDate(goals);
  return start === null || daysBetween(start, today) >= 0;
}

export function abandonedGoalCount(goals: readonly EngineGoal[], today: IsoDate): number {
  return goals.filter((g) => goalState(g, today) === 'abandoned').length;
}

/** All unfinished goals are abandoned (§4.3). Some abandoned goals only produce a warning. */
export function isElementAbandoned(goals: readonly EngineGoal[], today: IsoDate): boolean {
  const unfinished = goals.filter((g) => !g.isDone);
  return unfinished.length > 0 && unfinished.every((g) => goalState(g, today) === 'abandoned');
}

function tickedSince(goals: readonly EngineGoal[], since: IsoTimestamp): boolean {
  const sinceMs = Date.parse(since);
  return goals.some((g) => g.tickChangedAt !== null && Date.parse(g.tickChangedAt) > sinceMs);
}

/**
 * Resolution order (§4.2):
 * decommissioned → abandoned → recommissioned → restarted → completed → in progress
 * → (0%) not started before the start date → resource delay if chosen → started.
 */
export function resolveElementStatus(element: EngineElement, goals: readonly EngineGoal[], today: IsoDate): ElementStatus {
  if (element.isDecommissioned) return 'decommissioned';
  if (isElementAbandoned(goals, today)) return 'abandoned';
  if (element.recommissionedAt && !tickedSince(goals, element.recommissionedAt)) return 'recommissioned';
  if (element.restartedAt && !tickedSince(goals, element.restartedAt)) return 'restarted';

  const { pct } = completion(goals);
  if (pct === 100) return 'completed';
  if (pct > 0) return 'in_progress';

  if (!hasReachedStart(goals, today)) return 'not_started';
  if (element.zeroProgressStatus === 'resource_delay') return 'resource_delay';
  return 'started';
}

export interface ZeroProgressControl {
  /** Shown only while the element sits in a 0% status. */
  visible: boolean;
  /** Locked to Not Started before the start date. */
  locked: boolean;
  options: ZeroProgressStatus[];
  startDate: IsoDate | null;
}

/** What the 0% status selector on the element screen offers (§4.6, §6.3). */
export function zeroProgressControl(
  element: EngineElement,
  goals: readonly EngineGoal[],
  today: IsoDate,
): ZeroProgressControl {
  const status = resolveElementStatus(element, goals, today);
  const startDate = elementStartDate(goals);
  const visible = status === 'not_started' || status === 'started' || status === 'resource_delay';
  if (!hasReachedStart(goals, today)) return { visible, locked: true, options: ['not_started'], startDate };
  return { visible, locked: false, options: ['started', 'resource_delay'], startDate };
}

export interface StatusChange {
  from: ElementStatus | null;
  to: ElementStatus;
}

/** A row for status_events when the resolved status differs from the last one recorded. */
export function statusChange(previous: ElementStatus | null, next: ElementStatus): StatusChange | null {
  return previous === next ? null : { from: previous, to: next };
}
