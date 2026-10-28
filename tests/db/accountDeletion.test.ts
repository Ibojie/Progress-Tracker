// @vitest-environment node
//
// Phase 7: deleting an account removes the user and every row they own, and nothing else.
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUserOn, createTestDb } from './harness';

const ME = '00000000-0000-0000-0000-0000000000d1';
const OTHER = '00000000-0000-0000-0000-0000000000d2';
const TABLES = [
  'profiles',
  'categories',
  'elements',
  'goals',
  'goal_date_resets',
  'status_events',
  'daily_snapshots',
  'push_subscriptions',
  'notification_log',
  'ai_summaries',
  'ai_usage',
];

let db: PGlite;
const asUser: ReturnType<typeof asUserOn> = (userId, fn) => asUserOn(db)(userId, fn);

async function fill(userId: string) {
  const elementId = await asUser(userId, async (q) => {
    const cat = await q<{ id: string }>(`select id from categories where key = 'business'`);
    const el = await q<{ id: string }>(`insert into elements (category_id, name) values ($1, 'Plan') returning id`, [cat.rows[0]!.id]);
    await q(`insert into goals (element_id, title, start_date, due_date) values ($1, 'First', '2026-10-01', '2026-12-01')`, [el.rows[0]!.id]);
    await q(`insert into status_events (element_id, to_status) values ($1, 'started')`, [el.rows[0]!.id]);
    return el.rows[0]!.id;
  });
  const goal = await db.query<{ id: string }>(`select id from goals where element_id = $1`, [elementId]);
  await db.query(`insert into goal_date_resets (user_id, goal_id, old_due_date, new_due_date) values ($1, $2, '2026-11-01', '2026-12-01')`, [
    userId,
    goal.rows[0]!.id,
  ]);
  await db.query(
    `insert into daily_snapshots (user_id, snapshot_date, category_id, element_id, pct_complete, goals_total, goals_done, status)
     select $1, '2026-10-27', category_id, id, 0, 1, 0, 'started' from elements where id = $2`,
    [userId, elementId],
  );
  await db.query(`insert into push_subscriptions (user_id, endpoint, keys) values ($1, $2, '{}')`, [userId, `https://fcm.googleapis.com/x/${userId}`]);
  await db.query(`insert into notification_log (user_id, kind, channel, title) values ($1, 'test', 'in_app', 'x')`, [userId]);
  await db.query(`insert into ai_summaries (user_id, period_start, period_end, content_md, model) values ($1, '2026-10-26', '2026-11-02', 'x', 'm')`, [userId]);
  await db.query(`insert into ai_usage (user_id, trigger, used_on) values ($1, 'manual', '2026-11-02')`, [userId]);
}

async function counts(userId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    const col = t === 'profiles' ? 'id' : 'user_id';
    out[t] = (await db.query<{ n: number }>(`select count(*)::int as n from ${t} where ${col} = $1`, [userId])).rows[0]!.n;
  }
  return out;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'me@test'), ($2, 'other@test')`, [ME, OTHER]);
  await fill(ME);
  await fill(OTHER);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('delete my account', () => {
  it('needs the confirmation word and a signed-in user', async () => {
    await expect(asUser(ME, (q) => q(`select delete_my_account('delete')`))).rejects.toThrow(/Type DELETE/);
    await expect(asUser(null, (q) => q(`select delete_my_account('DELETE')`))).rejects.toThrow(/permission denied/);
    expect((await db.query(`select 1 from auth.users where id = $1`, [ME])).rows).toHaveLength(1);
  });

  it('removes the user and everything they own, and leaves other users alone', async () => {
    const before = await counts(ME);
    expect(Object.entries(before).filter(([, n]) => n === 0)).toEqual([]); // every table had rows

    await asUser(ME, (q) => q(`select delete_my_account('DELETE')`));

    expect((await db.query(`select 1 from auth.users where id = $1`, [ME])).rows).toHaveLength(0);
    expect(Object.values(await counts(ME)).every((n) => n === 0)).toBe(true);
    const other = await counts(OTHER);
    expect(other.profiles).toBe(1);
    expect(other.elements).toBe(1);
    expect(other.goals).toBe(1);
    expect((await db.query(`select 1 from auth.users where id = $1`, [OTHER])).rows).toHaveLength(1);
  });
});
