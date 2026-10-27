import { daysBetween } from './dates';
import type { EngineGoal, IsoDate } from './types';

/** How far behind the expected % an element must be to count as behind pace (§7.1). */
export const BEHIND_PACE_POINTS = 15;

/** Share of a goal's time that has passed, 0–1. */
function elapsedShare(goal: EngineGoal, today: IsoDate): number {
  const span = daysBetween(goal.startDate, goal.dueDate);
  const elapsed = daysBetween(goal.startDate, today);
  if (span <= 0) return elapsed >= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, elapsed / span));
}

/** expectedPct = elapsed / (due − start), averaged across the element's goals (§7.1). */
export function expectedPct(goals: readonly EngineGoal[], today: IsoDate): number {
  if (goals.length === 0) return 0;
  return Math.round((goals.reduce((sum, g) => sum + elapsedShare(g, today), 0) / goals.length) * 100);
}

export function isBehindPace(actualPct: number, expected: number): boolean {
  return actualPct < expected - BEHIND_PACE_POINTS;
}
