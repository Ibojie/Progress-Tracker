import type { EngineGoal } from './types';

export interface Completion {
  total: number;
  done: number;
  /** round(done / total × 100). Abandoned goals stay in the denominator (§4.3). */
  pct: number;
}

export function completion(goals: readonly Pick<EngineGoal, 'isDone'>[]): Completion {
  const total = goals.length;
  const done = goals.filter((g) => g.isDone).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
