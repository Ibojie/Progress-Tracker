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
});
