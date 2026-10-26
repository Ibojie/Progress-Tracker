// @vitest-environment node
//
// Runs the real migrations in an in-memory Postgres (PGlite) with a minimal stand-in for
// Supabase's auth schema, then checks the security rules and data constraints.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const USER_A = '00000000-0000-0000-0000-00000000000a';
const USER_B = '00000000-0000-0000-0000-00000000000b';

let db: PGlite;

/** Run statements as a signed-in user inside one transaction. */
async function asUser<T>(userId: string | null, fn: (q: PGlite['query']) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    return fn(tx.query.bind(tx) as PGlite['query']);
  });
}

async function createElement(userId: string, goals: number): Promise<string> {
  return asUser(userId, async (q) => {
    const cat = await q<{ id: string }>(`select id from categories where key = 'paid_job'`);
    const el = await q<{ id: string }>(`insert into elements (category_id, name) values ($1, 'PMI 2027') returning id`, [
      cat.rows[0]!.id,
    ]);
    const elementId = el.rows[0]!.id;
    for (let i = 0; i < goals; i++) {
      await q(`insert into goals (element_id, title, start_date, due_date) values ($1, $2, '2026-10-01', '2026-12-01')`, [
        elementId,
        `Goal ${i + 1}`,
      ]);
    }
    return elementId;
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = path.resolve('supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(dir, file), 'utf8'));
  }
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'a@test', '{"full_name":"Ada"}'), ($2, 'b@test', '{}')`, [
    USER_A,
    USER_B,
  ]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('signup', () => {
  it('creates a profile with Lagos timezone and system theme', async () => {
    const rows = await asUser(USER_A, (q) => q<{ display_name: string; timezone: string; theme_preference: string }>(`select * from profiles`));
    expect(rows.rows).toEqual([expect.objectContaining({ display_name: 'Ada', timezone: 'Africa/Lagos', theme_preference: 'system' })]);
  });

  it('seeds the four fixed categories in order', async () => {
    const rows = await asUser(USER_A, (q) => q<{ name: string }>(`select name from categories order by sort_order`));
    expect(rows.rows.map((r) => r.name)).toEqual(['Paid Job', 'Business', 'Investment', 'Personal Development']);
  });

  it('categories cannot be deleted or added by the user', async () => {
    const deleted = await asUser(USER_A, (q) => q(`delete from categories`));
    expect(deleted.affectedRows).toBe(0);
    await expect(
      asUser(USER_A, (q) => q(`insert into categories (key, name) values ('business', 'Extra')`)),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('row level security', () => {
  it('one user cannot read or change another user’s rows', async () => {
    const elementId = await createElement(USER_A, 2);

    const seenByB = await asUser(USER_B, async (q) => ({
      elements: (await q(`select * from elements`)).rows.length,
      goals: (await q(`select * from goals`)).rows.length,
      categories: (await q<{ user_id: string }>(`select user_id from categories`)).rows,
      profiles: (await q<{ id: string }>(`select id from profiles`)).rows,
    }));
    expect(seenByB.elements).toBe(0);
    expect(seenByB.goals).toBe(0);
    expect(seenByB.categories.every((c) => c.user_id === USER_B)).toBe(true);
    expect(seenByB.profiles).toEqual([{ id: USER_B }]);

    const updated = await asUser(USER_B, (q) => q(`update elements set name = 'hacked' where id = $1`, [elementId]));
    expect(updated.affectedRows).toBe(0);
  });

  it('a user cannot file an element under someone else’s category', async () => {
    const bCategory = await asUser(USER_B, (q) => q<{ id: string }>(`select id from categories limit 1`));
    await expect(
      asUser(USER_A, (q) => q(`insert into elements (category_id, name) values ($1, 'sneaky')`, [bCategory.rows[0]!.id])),
    ).rejects.toThrow();
  });

  it('signed-out visitors see nothing', async () => {
    await expect(asUser(null, (q) => q(`select * from categories`))).rejects.toThrow(/permission denied/);
  });

  it('status history is append-only', async () => {
    const elementId = await createElement(USER_A, 1);
    await asUser(USER_A, (q) => q(`insert into status_events (element_id, to_status) values ($1, 'not_started')`, [elementId]));
    const changed = await asUser(USER_A, async (q) => ({
      updated: (await q(`update status_events set to_status = 'completed'`)).affectedRows,
      deleted: (await q(`delete from status_events`)).affectedRows,
    }));
    expect(changed).toEqual({ updated: 0, deleted: 0 });
  });
});

describe('goal rules', () => {
  it('allows 10 goals but blocks an 11th', async () => {
    const elementId = await createElement(USER_A, 10);
    await expect(
      asUser(USER_A, (q) =>
        q(`insert into goals (element_id, title, start_date, due_date) values ($1, 'eleventh', '2026-10-01', '2026-11-01')`, [elementId]),
      ),
    ).rejects.toThrow(/at most 10 goals/);
  });

  it('an element must be created with at least one goal', async () => {
    await expect(createElement(USER_A, 0)).rejects.toThrow(/at least 1 goal/);
  });

  it('the last goal of an element cannot be deleted', async () => {
    const elementId = await createElement(USER_A, 1);
    await expect(asUser(USER_A, (q) => q(`delete from goals where element_id = $1`, [elementId]))).rejects.toThrow(
      /at least 1 goal/,
    );
  });

  it('deleting the whole element removes its goals', async () => {
    const elementId = await createElement(USER_A, 3);
    await asUser(USER_A, (q) => q(`delete from elements where id = $1`, [elementId]));
    const left = await asUser(USER_A, (q) => q(`select 1 from goals where element_id = $1`, [elementId]));
    expect(left.rows).toHaveLength(0);
  });

  it('the due date cannot be before the start date', async () => {
    const elementId = await createElement(USER_A, 1);
    await expect(
      asUser(USER_A, (q) =>
        q(`insert into goals (element_id, title, start_date, due_date) values ($1, 'bad', '2026-10-10', '2026-10-01')`, [elementId]),
      ),
    ).rejects.toThrow(/goals_due_after_start/);
  });

  it('records original due date and tick times', async () => {
    const elementId = await createElement(USER_A, 1);
    const row = await asUser(USER_A, async (q) => {
      await q(`update goals set is_done = true where element_id = $1`, [elementId]);
      return (
        await q<{ original_due_date: Date; done_at: Date | null; tick_changed_at: Date | null }>(
          `select original_due_date, done_at, tick_changed_at from goals where element_id = $1`,
          [elementId],
        )
      ).rows[0]!;
    });
    expect(row.original_due_date).toBeInstanceOf(Date);
    expect(row.done_at).not.toBeNull();
    expect(row.tick_changed_at).not.toBeNull();
  });
});

describe('notification log', () => {
  it('never stores the same alert twice on the same day', async () => {
    const elementId = await createElement(USER_A, 1);
    const goal = await asUser(USER_A, (q) => q<{ id: string }>(`select id from goals where element_id = $1`, [elementId]));
    const insert = `insert into notification_log (user_id, goal_id, kind, channel) values ($1, $2, 'due_in_14', 'push')`;
    await db.query(insert, [USER_A, goal.rows[0]!.id]);
    await expect(db.query(insert, [USER_A, goal.rows[0]!.id])).rejects.toThrow(/notification_log_no_duplicates/);
  });

  it('a user-level alert (weekly digest) is tracked per user', async () => {
    const insert = `insert into notification_log (user_id, kind, channel) values ($1, 'weekly_digest', 'email')`;
    await db.query(insert, [USER_A]);
    await db.query(insert, [USER_B]);
    await expect(db.query(insert, [USER_A])).rejects.toThrow(/notification_log_no_duplicates/);
  });
});

describe('code review hardening', () => {
  async function goalOf(userId: string): Promise<string> {
    const elementId = await createElement(userId, 1);
    const goal = await asUser(userId, (q) => q<{ id: string }>(`select id from goals where element_id = $1`, [elementId]));
    return goal.rows[0]!.id;
  }

  it('a date reset cannot point at another user’s goal', async () => {
    const aGoal = await goalOf(USER_A);
    // Even a privileged writer can't attach B's reset row to A's goal.
    await expect(
      db.query(`insert into goal_date_resets (user_id, goal_id, old_due_date, new_due_date) values ($1, $2, '2026-12-01', '2027-01-01')`, [
        USER_B,
        aGoal,
      ]),
    ).rejects.toThrow(/goal_date_resets_goal_owner_fkey/);
    // And users can't write reset rows directly at all; only reset_goal_date can.
    await expect(
      asUser(USER_A, (q) =>
        q(`insert into goal_date_resets (goal_id, old_due_date, new_due_date) values ($1, '2026-12-01', '2027-01-01')`, [aGoal]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('the client cannot rewrite a goal’s bookkeeping columns', async () => {
    const goalId = await goalOf(USER_A);
    for (const column of [`original_due_date = '2030-01-01'`, 'reset_count = 99', `tick_changed_at = now()`, 'done_at = now()']) {
      await expect(asUser(USER_A, (q) => q(`update goals set ${column} where id = $1`, [goalId]))).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(
      asUser(USER_A, (q) =>
        q(`insert into goals (element_id, title, start_date, due_date, reset_count) select element_id, 'x', start_date, due_date, 5 from goals where id = $1`, [goalId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('the client can still edit and tick its goals', async () => {
    const goalId = await goalOf(USER_A);
    const row = await asUser(USER_A, async (q) => {
      await q(`update goals set title = 'Renamed', due_date = '2026-12-20', is_done = true where id = $1`, [goalId]);
      return (await q<{ title: string; is_done: boolean }>(`select title, is_done from goals where id = $1`, [goalId])).rows[0]!;
    });
    expect(row).toEqual({ title: 'Renamed', is_done: true });
  });

  it('signed-out visitors cannot run database functions, including ones added later', async () => {
    await db.exec(`create function public.later_fn() returns int language sql as 'select 1'; create table public.later_table (id int);`);
    const priv = await db.query<{ fn: boolean; later_fn: boolean; later_table: boolean; auth_fn: boolean }>(`
      select has_function_privilege('anon', 'public.assert_element_has_goals(uuid)', 'execute') as fn,
             has_function_privilege('anon', 'public.later_fn()', 'execute') as later_fn,
             has_table_privilege('anon', 'public.later_table', 'select') as later_table,
             has_function_privilege('authenticated', 'public.later_fn()', 'execute') as auth_fn`);
    expect(priv.rows[0]).toEqual({ fn: false, later_fn: false, later_table: false, auth_fn: true });
    await db.exec(`drop function public.later_fn(); drop table public.later_table;`);
  });
});

describe('create_element_with_goals', () => {
  const goalsJson = (n: number) =>
    JSON.stringify(Array.from({ length: n }, (_, i) => ({ title: ` Goal ${i + 1} `, start_date: '2026-10-01', due_date: '2026-12-01' })));

  async function create(userId: string, n: number) {
    return asUser(userId, async (q) => {
      const cat = await q<{ id: string }>(`select id from categories where key = 'business'`);
      const res = await q<{ id: string }>(`select create_element_with_goals($1, ' Naija Commerce ', '', $2::jsonb) as id`, [
        cat.rows[0]!.id,
        goalsJson(n),
      ]);
      return res.rows[0]!.id;
    });
  }

  it('creates the element and its goals in order, trimmed', async () => {
    const id = await create(USER_A, 3);
    const rows = await asUser(USER_A, async (q) => ({
      element: (await q<{ name: string; description: string | null }>(`select name, description from elements where id = $1`, [id])).rows[0],
      goals: (await q<{ title: string; sort_order: number }>(`select title, sort_order from goals where element_id = $1 order by sort_order`, [id])).rows,
    }));
    expect(rows.element).toEqual({ name: 'Naija Commerce', description: null });
    expect(rows.goals).toEqual([
      { title: 'Goal 1', sort_order: 0 },
      { title: 'Goal 2', sort_order: 1 },
      { title: 'Goal 3', sort_order: 2 },
    ]);
  });

  it('rejects 0 or 11 goals', async () => {
    await expect(create(USER_A, 0)).rejects.toThrow(/between 1 and 10/);
    await expect(create(USER_A, 11)).rejects.toThrow(/between 1 and 10/);
  });

  it('cannot use another user’s category', async () => {
    const bCat = await asUser(USER_B, (q) => q<{ id: string }>(`select id from categories limit 1`));
    await expect(
      asUser(USER_A, (q) => q(`select create_element_with_goals($1, 'x', null, $2::jsonb)`, [bCat.rows[0]!.id, goalsJson(1)])),
    ).rejects.toThrow();
  });

  it('signed-out visitors cannot call it', async () => {
    await expect(asUser(null, (q) => q(`select create_element_with_goals(gen_random_uuid(), 'x', null, '[]')`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('reset_goal_date', () => {
  async function abandonedGoal(userId: string) {
    const elementId = await createElement(userId, 1);
    // Old dates, as for a goal abandoned long ago (set as the table owner).
    await db.query(`update goals set start_date = '2025-01-01', due_date = '2025-02-01', original_due_date = '2025-02-01' where element_id = $1`, [elementId]);
    const goal = await db.query<{ id: string }>(`select id from goals where element_id = $1`, [elementId]);
    return { elementId, goalId: goal.rows[0]!.id };
  }

  it('moves the due date, counts the reset, logs it and marks the element Restarted', async () => {
    const { elementId, goalId } = await abandonedGoal(USER_A);
    await asUser(USER_A, (q) => q(`select reset_goal_date($1, current_date + 30, ' Was ill ', true)`, [goalId]));
    const goal = (await db.query<{ reset_count: number; original_due_date: Date }>(`select reset_count, original_due_date from goals where id = $1`, [goalId])).rows[0]!;
    const reset = (await db.query<{ reason: string; user_id: string }>(`select reason, user_id from goal_date_resets where goal_id = $1`, [goalId])).rows;
    const el = (await db.query<{ restarted_at: Date | null }>(`select restarted_at from elements where id = $1`, [elementId])).rows[0]!;
    expect(goal.reset_count).toBe(1);
    expect(goal.original_due_date.toISOString().slice(0, 10)).toBe('2025-02-01');
    expect(reset).toEqual([{ reason: 'Was ill', user_id: USER_A }]);
    expect(el.restarted_at).not.toBeNull();
  });

  it('requires a new due date after today', async () => {
    const { goalId } = await abandonedGoal(USER_A);
    await expect(asUser(USER_A, (q) => q(`select reset_goal_date($1, current_date - 1, null, false)`, [goalId]))).rejects.toThrow(
      /after today/,
    );
  });

  it('cannot touch another user’s goal', async () => {
    const { goalId } = await abandonedGoal(USER_A);
    await expect(asUser(USER_B, (q) => q(`select reset_goal_date($1, current_date + 30, null, true)`, [goalId]))).rejects.toThrow(
      /Goal not found/,
    );
  });

  it('signed-out visitors cannot call it', async () => {
    await expect(asUser(null, (q) => q(`select reset_goal_date(gen_random_uuid(), current_date + 1, null, false)`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('Phase 2 review fixes', () => {
  it('switch-off and switch-on times are set by the database clock', async () => {
    const id = await createElement(USER_A, 1);
    await asUser(USER_A, (q) => q(`update elements set is_decommissioned = true where id = $1`, [id]));
    await asUser(USER_A, (q) => q(`update elements set is_decommissioned = false where id = $1`, [id]));
    const row = (await db.query<{ decommissioned_at: Date | null; recommissioned_at: Date | null }>(
      `select decommissioned_at, recommissioned_at from elements where id = $1`,
      [id],
    )).rows[0]!;
    expect(row.decommissioned_at).not.toBeNull();
    expect(row.recommissioned_at).not.toBeNull();
    await expect(asUser(USER_A, (q) => q(`update elements set recommissioned_at = now() - interval '1 day' where id = $1`, [id]))).rejects.toThrow(
      /permission denied/,
    );
    await expect(asUser(USER_A, (q) => q(`update elements set restarted_at = now() where id = $1`, [id]))).rejects.toThrow(/permission denied/);
  });

  it('the same status is never logged twice in a row', async () => {
    const id = await createElement(USER_A, 1);
    const log = (to: string) => asUser(USER_A, (q) => q(`insert into status_events (element_id, to_status) values ($1, $2)`, [id, to]));
    await log('started');
    await log('started'); // a second tab doing the same
    await log('in_progress');
    await log('started');
    const rows = await asUser(USER_A, (q) => q<{ to_status: string }>(`select to_status from status_events where element_id = $1 order by created_at, id`, [id]));
    expect(rows.rows.map((r) => r.to_status)).toEqual(['started', 'in_progress', 'started']);
  });

  it('only real timezone names are accepted', async () => {
    await expect(asUser(USER_A, (q) => q(`update profiles set timezone = 'Mars/Base'`))).rejects.toThrow(/Unknown timezone/);
    await asUser(USER_A, (q) => q(`update profiles set timezone = 'Europe/London'`));
    await asUser(USER_A, (q) => q(`update profiles set timezone = 'Africa/Lagos'`));
  });

  it('swap_goal_order swaps two goals of one element in one go', async () => {
    const id = await createElement(USER_A, 2);
    const order = () =>
      asUser(USER_A, (q) => q<{ title: string }>(`select title from goals where element_id = $1 order by sort_order, title`, [id]));
    const ids = (await asUser(USER_A, (q) => q<{ id: string }>(`select id from goals where element_id = $1 order by title`, [id]))).rows;
    await asUser(USER_A, (q) => q(`update goals set sort_order = 0 where element_id = $1`, [id])); // collided positions
    await asUser(USER_A, (q) => q(`select swap_goal_order($1, $2)`, [ids[0]!.id, ids[1]!.id]));
    expect((await order()).rows.map((r) => r.title)).toEqual(['Goal 2', 'Goal 1']);
    await asUser(USER_A, (q) => q(`select swap_goal_order($1, $2)`, [ids[0]!.id, ids[1]!.id]));
    expect((await order()).rows.map((r) => r.title)).toEqual(['Goal 1', 'Goal 2']);
  });

  it('swap_goal_order refuses another user’s goals', async () => {
    const id = await createElement(USER_A, 2);
    const ids = (await db.query<{ id: string }>(`select id from goals where element_id = $1`, [id])).rows;
    await expect(asUser(USER_B, (q) => q(`select swap_goal_order($1, $2)`, [ids[0]!.id, ids[1]!.id]))).rejects.toThrow(/not found/);
  });
});
