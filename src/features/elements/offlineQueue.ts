// The offline queue (§11): ticks and simple edits made without a connection are kept, saved on
// the device with the rest of the query cache, and sent in order when the connection returns,
// even after the app was closed. Each queued action has a fixed key and a default mutation
// function registered on the QueryClient, which is what lets a reopened app finish it.
import type { MutationKey, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GoalRow } from '@/lib/database.types';
import type { ElementWithGoals } from './model';
import type { GoalInput } from './schemas';

export const QUEUED = {
  toggleGoal: ['queued', 'goal', 'toggle'],
  updateGoal: ['queued', 'goal', 'update'],
  updateElement: ['queued', 'element', 'update'],
  swapGoals: ['queued', 'goal', 'swap'],
} as const;

/** Queued changes run one at a time, in the order they were made. */
export const QUEUE_SCOPE = { id: 'offline-queue' };

export function isQueuedKey(key: MutationKey | undefined): boolean {
  return Array.isArray(key) && key[0] === 'queued';
}

export interface ToggleGoalVars {
  goalId: string;
  isDone: boolean;
}
export interface UpdateGoalVars {
  goalId: string;
  goal: GoalInput;
}
export type ElementPatch = Partial<Pick<ElementWithGoals, 'name' | 'description' | 'zero_progress_status'>>;
export interface UpdateElementVars {
  id: string;
  patch: ElementPatch;
}
export interface SwapGoalsVars {
  a: string;
  b: string;
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

export const queuedFns = {
  toggleGoal: async ({ goalId, isDone }: ToggleGoalVars) => {
    check(await db().from('goals').update({ is_done: isDone }).eq('id', goalId));
  },
  updateGoal: async ({ goalId, goal }: UpdateGoalVars) => {
    check(
      await db()
        .from('goals')
        .update({ title: goal.title, notes: goal.notes || null, start_date: goal.start_date, due_date: goal.due_date })
        .eq('id', goalId),
    );
  },
  updateElement: async ({ id, patch }: UpdateElementVars) => {
    check(await db().from('elements').update(patch).eq('id', id));
  },
  swapGoals: async ({ a, b }: SwapGoalsVars) => {
    check(await db().rpc('swap_goal_order', { p_goal_a: a, p_goal_b: b }));
  },
};

/** Register the queued actions so paused ones can resume after a reload. */
export function registerQueuedMutations(queryClient: QueryClient): void {
  const settled = () => {
    void queryClient.invalidateQueries({ queryKey: ['elements'] });
    void queryClient.invalidateQueries({ queryKey: ['element-history'] });
  };
  for (const name of Object.keys(QUEUED) as (keyof typeof QUEUED)[]) {
    queryClient.setMutationDefaults(QUEUED[name], {
      mutationFn: queuedFns[name] as (vars: unknown) => Promise<void>,
      scope: QUEUE_SCOPE,
      onSettled: settled,
    });
  }
}

// ---- Instant on-screen updates (applied to the cached element list) ----

type Rows = ElementWithGoals[] | undefined;

const mapGoals = (rows: Rows, fn: (g: GoalRow) => GoalRow): Rows => rows?.map((el) => ({ ...el, goals: el.goals.map(fn) }));

export function applyToggle(rows: Rows, { goalId, isDone }: ToggleGoalVars, now: string): Rows {
  return mapGoals(rows, (g) => (g.id === goalId ? { ...g, is_done: isDone, done_at: isDone ? now : null, tick_changed_at: now } : g));
}

export function applyGoalEdit(rows: Rows, { goalId, goal }: UpdateGoalVars): Rows {
  return mapGoals(rows, (g) =>
    g.id === goalId ? { ...g, title: goal.title, notes: goal.notes || null, start_date: goal.start_date, due_date: goal.due_date } : g,
  );
}

export function applyElementEdit(rows: Rows, { id, patch }: UpdateElementVars): Rows {
  return rows?.map((el) => (el.id === id ? { ...el, ...patch } : el));
}

export function applySwap(rows: Rows, { a, b }: SwapGoalsVars): Rows {
  const all = rows?.flatMap((el) => el.goals) ?? [];
  const ga = all.find((g) => g.id === a);
  const gb = all.find((g) => g.id === b);
  if (!ga || !gb) return rows;
  // Same rule as swap_goal_order: give the pair distinct positions if they collided.
  const [newA, newB] = ga.sort_order === gb.sort_order ? [gb.sort_order + 1, ga.sort_order] : [gb.sort_order, ga.sort_order];
  return mapGoals(rows, (g) => (g.id === a ? { ...g, sort_order: newA } : g.id === b ? { ...g, sort_order: newB } : g));
}
