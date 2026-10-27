import { afterEach, describe, expect, it } from 'vitest';
import { MutationObserver, QueryClient, dehydrate, hydrate, onlineManager } from '@tanstack/react-query';
import {
  QUEUED,
  QUEUE_SCOPE,
  applyElementEdit,
  applyGoalEdit,
  applySwap,
  applyToggle,
  isQueuedKey,
  registerQueuedMutations,
} from '@/features/elements/offlineQueue';
import type { ElementWithGoals } from '@/features/elements/model';
import type { GoalRow } from '@/lib/database.types';

function goal(id: string, sort: number, patch: Partial<GoalRow> = {}): GoalRow {
  return {
    id,
    user_id: 'u',
    element_id: 'e',
    title: id,
    notes: null,
    start_date: '2026-10-01',
    due_date: '2026-12-01',
    original_due_date: '2026-12-01',
    is_done: false,
    done_at: null,
    tick_changed_at: null,
    reset_count: 0,
    sort_order: sort,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...patch,
  };
}

const rows = (): ElementWithGoals[] => [
  {
    id: 'e',
    user_id: 'u',
    category_id: 'c',
    name: 'PMI 2027',
    description: null,
    zero_progress_status: 'not_started',
    is_decommissioned: false,
    decommissioned_at: null,
    recommissioned_at: null,
    restarted_at: null,
    sort_order: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    goals: [goal('a', 0), goal('b', 1)],
    category: { id: 'c', key: 'paid_job', name: 'Paid Job' },
    status_events: [],
  },
];

describe('instant on-screen updates', () => {
  it('a tick shows at once, with tick and done times', () => {
    const out = applyToggle(rows(), { goalId: 'a', isDone: true }, '2026-10-27T10:00:00Z')!;
    expect(out[0]!.goals[0]).toMatchObject({ is_done: true, done_at: '2026-10-27T10:00:00Z', tick_changed_at: '2026-10-27T10:00:00Z' });
    const undone = applyToggle(out, { goalId: 'a', isDone: false }, '2026-10-27T11:00:00Z')!;
    expect(undone[0]!.goals[0]).toMatchObject({ is_done: false, done_at: null });
    expect(applyToggle(undefined, { goalId: 'a', isDone: true }, 'x')).toBeUndefined();
  });

  it('goal and element edits show at once', () => {
    const g = applyGoalEdit(rows(), { goalId: 'b', goal: { title: 'New', notes: '', start_date: '2026-11-01', due_date: '2026-11-30' } })!;
    expect(g[0]!.goals[1]).toMatchObject({ title: 'New', notes: null, start_date: '2026-11-01', due_date: '2026-11-30' });
    const e = applyElementEdit(rows(), { id: 'e', patch: { name: 'PMI 2028', zero_progress_status: 'resource_delay' } })!;
    expect(e[0]).toMatchObject({ name: 'PMI 2028', zero_progress_status: 'resource_delay' });
  });

  it('reordering swaps positions, and separates collided ones like the database does', () => {
    expect(applySwap(rows(), { a: 'a', b: 'b' })![0]!.goals.map((x) => [x.id, x.sort_order])).toEqual([
      ['a', 1],
      ['b', 0],
    ]);
    const collided = rows();
    collided[0]!.goals[1]!.sort_order = 0;
    expect(applySwap(collided, { a: 'a', b: 'b' })![0]!.goals.map((x) => [x.id, x.sort_order])).toEqual([
      ['a', 1],
      ['b', 0],
    ]);
    expect(applySwap(rows(), { a: 'a', b: 'missing' })).toEqual(rows());
  });
});

describe('the offline queue', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('registers every queued action with a request and the shared one-at-a-time scope', () => {
    const qc = new QueryClient();
    registerQueuedMutations(qc);
    for (const key of Object.values(QUEUED)) {
      expect(isQueuedKey(key)).toBe(true);
      const defaults = qc.getMutationDefaults(key);
      expect(defaults.mutationFn).toBeTypeOf('function');
      expect(defaults.scope).toEqual(QUEUE_SCOPE);
    }
    expect(isQueuedKey(['elements'])).toBe(false);
    expect(isQueuedKey(undefined)).toBe(false);
  });

  it('keeps changes made offline, survives a restart, and sends them in order, one at a time', async () => {
    const sent: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const withDefaults = (qc: QueryClient) => {
      qc.setMutationDefaults(QUEUED.toggleGoal, {
        scope: QUEUE_SCOPE,
        mutationFn: async (v: { goalId: string }) => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await new Promise((r) => setTimeout(r, 5));
          sent.push(v.goalId);
          running--;
        },
      });
      return qc;
    };

    // 1. Offline: three ticks are made. Nothing is sent; all are paused.
    onlineManager.setOnline(false);
    const before = withDefaults(new QueryClient());
    for (const id of ['g1', 'g2', 'g3']) {
      void new MutationObserver<void, Error, { goalId: string; isDone: boolean }>(before, { mutationKey: QUEUED.toggleGoal })
        .mutate({ goalId: id, isDone: true })
        .catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 20));
    expect(sent).toEqual([]);
    expect(before.getMutationCache().getAll().every((m) => m.state.isPaused)).toBe(true);

    // 2. The app is closed: the queue is saved (as the device storage would hold it).
    const saved = JSON.parse(JSON.stringify(dehydrate(before)));
    expect(saved.mutations).toHaveLength(3);

    // 3. The app reopens with a fresh client and the saved queue, then the connection returns.
    const after = withDefaults(new QueryClient());
    hydrate(after, saved);
    onlineManager.setOnline(true);
    await after.resumePausedMutations();
    await new Promise((r) => setTimeout(r, 50));

    expect(sent).toEqual(['g1', 'g2', 'g3']); // in order
    expect(maxRunning).toBe(1); // one at a time
    // Nothing is left to send twice.
    expect(after.getMutationCache().getAll().filter((m) => m.state.status === 'pending')).toHaveLength(0);
  });
});
