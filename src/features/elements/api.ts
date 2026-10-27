import { useEffect, useMemo } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient, type MutationKey, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { statusChange, type ElementStatus } from '@/lib/engine';
import type { Json } from '@/lib/database.types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTodayState } from '@/features/profile/useProfile';
import { useNotice } from '@/components/Notice';
import { buildElementView, type ElementView, type ElementWithGoals } from './model';
import type { GoalInput } from './schemas';
import {
  QUEUED,
  applyElementEdit,
  applyGoalEdit,
  applySwap,
  applyToggle,
  isQueuedKey,
  type ElementPatch,
  type SwapGoalsVars,
  type ToggleGoalVars,
  type UpdateElementVars,
  type UpdateGoalVars,
} from './offlineQueue';

const ELEMENT_SELECT = '*, goals(*), category:categories(id, key, name), status_events(to_status, created_at)';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function useElementsKey() {
  const { user } = useAuth();
  return ['elements', user?.id] as const;
}

/** Every element with its goals. A personal tracker holds few enough rows to load them all once. */
export function useElementRows() {
  const key = useElementsKey();
  return useQuery({
    queryKey: key,
    enabled: !!supabase && !!key[1],
    queryFn: async (): Promise<ElementWithGoals[]> => {
      const { data, error } = await client()
        .from('elements')
        .select(ELEMENT_SELECT)
        .order('sort_order')
        .order('created_at', { referencedTable: 'status_events', ascending: false })
        .limit(1, { referencedTable: 'status_events' });
      if (error) throw error;
      return data as unknown as ElementWithGoals[];
    },
  });
}

/** Element views for today, with status changes written to the history as they happen. */
export function useElementViews() {
  const query = useElementRows();
  const { today, ready } = useTodayState();
  const views = useMemo(() => (query.data ?? []).map((row) => buildElementView(row, today)), [query.data, today]);
  // Log only what the server has confirmed (no queued change still waiting) and only in the
  // user's own timezone.
  const changesWaiting = useIsMutating({ predicate: (m) => isQueuedKey(m.options.mutationKey) });
  useStatusSync(views, ready && changesWaiting === 0 && !query.isFetching);
  return { ...query, views };
}

// Remembers the last status logged per element during this session, so a change is written once.
const loggedStatus = new Map<string, ElementStatus>();

/**
 * Writes a status_events row whenever an element's resolved status differs from the last one
 * recorded (§4.2). This also catches date-driven changes, such as Not Started → Started on the
 * start date, the next time the app is opened.
 */
function useStatusSync(views: ElementView[], enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!supabase || !enabled) return;
    const rows: { element_id: string; from_status: ElementStatus | null; to_status: ElementStatus }[] = [];
    for (const v of views) {
      const previous = loggedStatus.get(v.row.id) ?? v.lastLoggedStatus;
      const change = statusChange(previous, v.status);
      if (!change) continue;
      loggedStatus.set(v.row.id, v.status);
      rows.push({ element_id: v.row.id, from_status: change.from, to_status: change.to });
    }
    if (rows.length) {
      void supabase
        .from('status_events')
        .insert(rows)
        .then(({ error }) => {
          if (error) rows.forEach((r) => loggedStatus.delete(r.element_id)); // retry on the next render
          else refreshHistory(queryClient);
        });
    }
  }, [views, enabled, queryClient]);
}

function refreshHistory(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['element-history'] });
}

export function useElementHistory(elementId: string | undefined) {
  return useQuery({
    queryKey: ['element-history', elementId],
    enabled: !!supabase && !!elementId,
    queryFn: async () => {
      const db = client();
      const [events, resets] = await Promise.all([
        db.from('status_events').select('*').eq('element_id', elementId!).order('created_at', { ascending: false }),
        db
          .from('goal_date_resets')
          .select('*, goal:goals!inner(title, element_id)')
          .eq('goal.element_id', elementId!)
          .order('created_at', { ascending: false }),
      ]);
      if (events.error) throw events.error;
      if (resets.error) throw resets.error;
      return { events: events.data, resets: resets.data };
    },
  });
}

/** Shared mutation plumbing: refresh elements and history afterwards, report errors. */
function useAppMutation<TVars, TResult = void>(fn: (vars: TVars) => Promise<TResult>, failure: string) {
  const queryClient = useQueryClient();
  const { notify } = useNotice();
  return useMutation({
    mutationFn: fn,
    // Online-only actions: fail straight away when offline rather than wait unsaved in memory.
    networkMode: 'always',
    onError: (error: Error) => notify(`${failure} ${error.message}`),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['elements'] });
      void queryClient.invalidateQueries({ queryKey: ['element-history'] });
    },
  });
}

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

export function useCreateElement() {
  return useAppMutation(
    async (input: { category_id: string; name: string; description: string; goals: GoalInput[] }) => {
      const { data } = check(
        await client().rpc('create_element_with_goals', {
          p_category_id: input.category_id,
          p_name: input.name,
          p_description: input.description,
          p_goals: input.goals as unknown as Json,
        }),
      );
      return data as string;
    },
    'Couldn’t save the element.',
  );
}

/**
 * A queued change: shown on screen at once, saved on the device, and sent in order when online
 * (the request itself is registered in offlineQueue.ts so it can resume after a reload).
 */
function useQueuedMutation<TVars>(
  mutationKey: MutationKey,
  apply: (rows: ElementWithGoals[] | undefined, vars: TVars) => ElementWithGoals[] | undefined,
  failure: string,
) {
  const queryClient = useQueryClient();
  const key = useElementsKey();
  const { notify } = useNotice();
  return useMutation<void, Error, TVars, { previous: ElementWithGoals[] | undefined }>({
    mutationKey,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ElementWithGoals[]>(key);
      queryClient.setQueryData<ElementWithGoals[]>(key, (rows) => apply(rows, vars));
      return { previous };
    },
    onError: (error, _vars, context) => {
      // With other changes still queued, restoring this snapshot would hide them too: reload instead.
      const othersWaiting = queryClient.isMutating({ predicate: (m) => isQueuedKey(m.options.mutationKey) }) > 1;
      if (context?.previous && !othersWaiting) queryClient.setQueryData(key, context.previous);
      else void queryClient.invalidateQueries({ queryKey: ['elements'] });
      notify(`${failure} ${error.message}`);
    },
  });
}

/** Tick or untick a goal (§6.3). Works offline, and remembers when the box was tapped. */
export function useToggleGoal() {
  const m = useQueuedMutation<ToggleGoalVars>(QUEUED.toggleGoal, (rows, v) => applyToggle(rows, v, new Date().toISOString()), 'Couldn’t save the tick.');
  return { ...m, mutate: (vars: Omit<ToggleGoalVars, 'tickedAt'>) => m.mutate({ ...vars, tickedAt: new Date().toISOString() }) };
}

/** Edit an element's name, description or 0% status. Works offline. */
export function useUpdateElement() {
  return useQueuedMutation<UpdateElementVars>(QUEUED.updateElement, applyElementEdit, 'Couldn’t save the change.');
}

export type { ElementPatch };

/**
 * Switch an element off (hidden everywhere) or back on (§4.5). History is kept either way.
 * The database stamps decommissioned_at / recommissioned_at with its own clock.
 */
export function useSetDecommissioned() {
  const update = useAppMutation(async ({ id, off }: { id: string; off: boolean }) => {
    check(await client().from('elements').update({ is_decommissioned: off }).eq('id', id));
  }, 'Couldn’t switch the element.');
  return {
    ...update,
    mutate: (id: string, off: boolean, opts?: { onSuccess?: () => void }) => update.mutate({ id, off }, opts),
  };
}

export function useDeleteElement() {
  return useAppMutation(async (id: string) => {
    check(await client().from('elements').delete().eq('id', id));
  }, 'Couldn’t delete the element.');
}

export function useAddGoal() {
  return useAppMutation(async ({ elementId, goal, sortOrder }: { elementId: string; goal: GoalInput; sortOrder: number }) => {
    const row = {
      element_id: elementId,
      title: goal.title,
      notes: goal.notes || null,
      start_date: goal.start_date,
      due_date: goal.due_date,
      sort_order: sortOrder,
    };
    // original_due_date is filled in by the goals_before_write trigger; the client may not send it.
    check(await client().from('goals').insert(row as typeof row & { original_due_date: string }));
  }, 'Couldn’t add the goal.');
}

/** Edit a goal's title, notes or dates. Works offline. */
export function useUpdateGoal() {
  return useQueuedMutation<UpdateGoalVars>(QUEUED.updateGoal, applyGoalEdit, 'Couldn’t save the goal.');
}

export function useDeleteGoal() {
  return useAppMutation(async (goalId: string) => {
    check(await client().from('goals').delete().eq('id', goalId));
  }, 'Couldn’t delete the goal.');
}

/** Swap two goals' positions (one database transaction). Works offline. */
export function useSwapGoals() {
  return useQueuedMutation<SwapGoalsVars>(QUEUED.swapGoals, applySwap, 'Couldn’t reorder the goals.');
}

export function useResetGoalDate() {
  return useAppMutation(
    async (vars: { goalId: string; newDueDate: string; reason: string; markRestarted: boolean }) => {
      check(
        await client().rpc('reset_goal_date', {
          p_goal_id: vars.goalId,
          p_new_due_date: vars.newDueDate,
          p_reason: vars.reason,
          p_mark_restarted: vars.markRestarted,
        }),
      );
    },
    'Couldn’t reset the date.',
  );
}
