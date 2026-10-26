import { daysBetween } from './dates';
import type { EngineGoal, GoalState, IsoDate } from './types';

/** A goal is abandoned once it is more than this many days past its due date (§4.3). */
export const ABANDON_AFTER_DAYS = 7;

export interface GoalInfo {
  state: GoalState;
  /** Days from today to the due date (negative once overdue). */
  daysLeft: number;
  /** Days past the due date; 0 when not overdue. */
  daysOverdue: number;
  /** While overdue (days 1–7): days left before it is abandoned. Otherwise null. */
  daysToAbandonment: number | null;
}

export function describeGoal(goal: EngineGoal, today: IsoDate): GoalInfo {
  const daysLeft = daysBetween(today, goal.dueDate);
  const daysOverdue = Math.max(0, -daysLeft);
  const base = { daysLeft, daysOverdue, daysToAbandonment: null };

  if (goal.isDone) return { ...base, state: 'done' };
  if (daysBetween(today, goal.startDate) > 0) return { ...base, state: 'not_started' };
  if (daysOverdue > ABANDON_AFTER_DAYS) return { ...base, state: 'abandoned' };
  if (daysOverdue > 0) return { ...base, state: 'overdue', daysToAbandonment: ABANDON_AFTER_DAYS - daysOverdue };
  return { ...base, state: 'open' };
}

export function goalState(goal: EngineGoal, today: IsoDate): GoalState {
  return describeGoal(goal, today).state;
}
