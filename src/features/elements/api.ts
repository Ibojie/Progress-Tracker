import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { statusChange, type ElementStatus } from '@/lib/engine';
import type { GoalRow, Json } from '@/lib/database.types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToday } from '@/features/profile/useProfile';
import { useNotice } from '@/components/Notice';
import { buildElementView, type ElementView, type ElementWithGoals } from './model';
import type { GoalInput } from './schemas';

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
  const today = useToday();
  const views = useMemo(() => (query.data ?? []).map((row) => buildElementView(row, today)), [query.data, today]);
  useStatusSync(views);
  return { ...query, views };
}

// Remembers the last status logged per element during this session, so a change is written once.
const loggedStatus = new Map<string, ElementStatus>();

/**
 * Writes a status_events row whenever an element's resolved status differs from the last one
 * recorded (§4.2). This also catches date-driven changes, such as Not Started → Started on the
 * start date, the next time the app is opened.
 */
function useStatusSync(views: ElementView[]) {
  useEffect(() => {
    if (!supabase) return;
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
        });
    }
  }, [views]);
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

/** Tick or untick a goal, updating the screen immediately (§6.3). */
export function useToggleGoal() {
  const queryClient = useQueryClient();
  const key = useElementsKey();
  const { notify } = useNotice();
  return useMutation({
    mutationFn: async ({ goalId, isDone }: { goalId: string; isDone: boolean }) => {
      check(await client().from('goals').update({ is_done: isDone }).eq('id', goalId));
    },
    onMutate: async ({ goalId, isDone }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ElementWithGoals[]>(key);
      const now = new Date().toISOString();
      queryClient.setQueryData<ElementWithGoals[]>(key, (rows) =>
        rows?.map((el) => ({
          ...el,
          goals: el.goals.map(
            (g): GoalRow =>
              g.id === goalId ? { ...g, is_done: isDone, done_at: isDone ? now : null, tick_changed_at: now } : g,
          ),
        })),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      notify(`Couldn’t save the tick. ${error.message}`);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['elements'] }),
  });
}

export function useUpdateElement() {
  return useAppMutation(
    async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<
        Pick<
          ElementWithGoals,
          'name' | 'description' | 'zero_progress_status' | 'is_decommissioned' | 'decommissioned_at' | 'recommissioned_at'
        >
      >;
    }) => {
      check(await client().from('elements').update(patch).eq('id', id));
    },
    'Couldn’t save the change.',
  );
}

/** Switch an element off (hidden everywhere) or back on (§4.5). History is kept either way. */
export function useSetDecommissioned() {
  const update = useUpdateElement();
  return {
    ...update,
    mutate: (id: string, off: boolean, opts?: { onSuccess?: () => void }) =>
      update.mutate(
        {
          id,
          patch: off
            ? { is_decommissioned: true, decommissioned_at: new Date().toISOString() }
            : { is_decommissioned: false, recommissioned_at: new Date().toISOString() },
        },
        opts,
      ),
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

export function useUpdateGoal() {
  return useAppMutation(async ({ goalId, goal }: { goalId: string; goal: GoalInput }) => {
    check(
      await client()
        .from('goals')
        .update({ title: goal.title, notes: goal.notes || null, start_date: goal.start_date, due_date: goal.due_date })
        .eq('id', goalId),
    );
  }, 'Couldn’t save the goal.');
}

export function useDeleteGoal() {
  return useAppMutation(async (goalId: string) => {
    check(await client().from('goals').delete().eq('id', goalId));
  }, 'Couldn’t delete the goal.');
}

/** Swap two goals' positions. */
export function useSwapGoals() {
  return useAppMutation(async ({ a, b }: { a: GoalRow; b: GoalRow }) => {
    const db = client();
    // Distinct positions even if both shared one before.
    const [first, second] = a.sort_order === b.sort_order ? [b.sort_order + 1, a.sort_order] : [b.sort_order, a.sort_order];
    check(await db.from('goals').update({ sort_order: first }).eq('id', a.id));
    check(await db.from('goals').update({ sort_order: second }).eq('id', b.id));
  }, 'Couldn’t reorder the goals.');
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
