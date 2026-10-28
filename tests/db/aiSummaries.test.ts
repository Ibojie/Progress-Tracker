// @vitest-environment node
//
// Phase 6 (§7.2): what the AI is allowed to see, the daily refresh limit and the Monday schedule.
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asUserOn, createTestDb } from './harness';

const USER = '00000000-0000-0000-0000-0000000000c1';
const OTHER = '00000000-0000-0000-0000-0000000000c2';
const MONDAY = '2026-11-02';
const MONDAY_8AM = '2026-11-02T07:10:00Z'; // 08:10 Lagos

let db: PGlite;
const asUser: ReturnType<typeof asUserOn> = (userId, fn) => asUserOn(db)(userId, fn);

function day(offset: number): string {
  const d = new Date(`${MONDAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function element(name: string, goals: { start: number; due: number; title?: string; notes?: string }[], key = 'business') {
  return asUser(USER, async (q) => {
    const cat = await q<{ id: string }>(`select id from categories where key = $1`, [key]);
    const el = await q<{ id: string }>(`insert into elements (category_id, name) values ($1, $2) returning id`, [cat.rows[0]!.id, name]);
    for (const [i, g] of goals.entries()) {
      await q(`insert into goals (element_id, title, notes, start_date, due_date) values ($1, $2, $3, $4, $5)`, [
        el.rows[0]!.id,
        g.title ?? `${name} goal ${i + 1}`,
        g.notes ?? null,
        day(g.start),
        day(g.due),
      ]);
    }
    return el.rows[0]!.id;
  });
}

async function input(today = MONDAY) {
  const r = await db.query<{ d: Record<string, unknown> }>(`select public.ai_summary_input($1, $2) as d`, [USER, today]);
  return r.rows[0]!.d as {
    week: Record<string, number>;
    categories: { name: string; pct: number; elements: number }[];
    elements: { name: string; category: string; pct: number; status: string; days_left: number | null; band: string | null; pace: string }[];
  };
}

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'secret-owner@example.com'), ($2, 'b@test')`, [USER, OTHER]);
}, 60_000);

beforeEach(async () => {
  await db.exec(`delete from ai_summaries; delete from ai_usage; delete from elements;`);
  await db.query(`update profiles set ai_summary_enabled = true, timezone = 'Africa/Lagos', quiet_hours_start = null, quiet_hours_end = null`);
});

afterAll(async () => {
  await db?.close();
});

describe('what the AI sees', () => {
  it('sends names and numbers only: never goal titles, notes or the email address', async () => {
    await element('PMI 2027', [{ start: -30, due: 10, title: 'Private exam booking', notes: 'card ending 4242' }]);
    const json = JSON.stringify(await input());
    expect(json).toContain('PMI 2027');
    for (const secret of ['Private exam booking', 'card ending 4242', 'secret-owner@example.com', USER]) expect(json).not.toContain(secret);
  });

  it('gives each element its %, status, days left, band and pace, most urgent first', async () => {
    const late = await element('Late', [{ start: -40, due: -3 }, { start: -40, due: 20 }]);
    await element('Soon', [{ start: -10, due: 5 }]);
    await element('Far', [{ start: -1, due: 90 }], 'investment');
    await db.query(`update goals set is_done = true where element_id = $1 and due_date = $2`, [late, day(20)]);

    const els = (await input()).elements;
    expect(els.map((e) => e.name)).toEqual(['Late', 'Soon', 'Far']);
    expect(els[0]).toMatchObject({ category: 'Business', pct: 50, status: 'in_progress', days_left: -3, band: 'overdue' });
    expect(els[1]).toMatchObject({ pct: 0, days_left: 5, band: 'immediate', pace: 'behind' }); // 2/3 of the time gone, nothing done
    expect(els[2]).toMatchObject({ days_left: 90, band: 'long', pace: 'on track' });
  });

  it('leaves out switched-off elements and counts the week against the one before', async () => {
    const off = await element('Off', [{ start: -10, due: 5 }]);
    const live = await element('Live', [{ start: -20, due: 30 }, { start: -20, due: 40 }]);
    await db.query(`update elements set is_decommissioned = true where id = $1`, [off]);
    await db.query(`update goals set is_done = true where element_id = $1`, [live]);
    await db.query(`update goals set done_at = '2026-10-28T10:00:00Z' where element_id = $1 and due_date = $2`, [live, day(30)]);
    await db.query(`update goals set done_at = '2026-10-21T10:00:00Z' where element_id = $1 and due_date = $2`, [live, day(40)]);

    const d = await input();
    expect(d.elements.map((e) => e.name)).toEqual(['Live']);
    expect(d.week).toMatchObject({ goals_completed: 1, goals_completed_week_before: 1, overall_pct: 100 });
    expect(d.categories.find((c) => c.name === 'Business')).toMatchObject({ pct: 100, elements: 1 });
  });
});

describe('limits and schedule', () => {
  const claim = async (trigger: string, now: string) =>
    (await db.query<{ n: number }>(`select public.ai_claim($1, $2, $3) as n`, [USER, trigger, now])).rows[0]!.n;

  it('allows 5 manual attempts a day, counted in the user’s timezone, failed ones included', async () => {
    const left = async (now: string) =>
      (await db.query<{ n: number }>(`select public.ai_manual_left($1, $2) as n`, [USER, now])).rows[0]!.n;
    expect(await left(MONDAY_8AM)).toBe(5);
    // Each claim is taken before Claude is called, so an attempt counts even if the call fails.
    const late = '2026-11-02T22:30:00Z'; // 23:30 Lagos on Monday
    expect([await claim('manual', late), await claim('manual', late), await claim('manual', late)]).toEqual([4, 3, 2]);
    expect([await claim('manual', late), await claim('manual', late)]).toEqual([1, 0]);
    expect(await claim('manual', late)).toBe(-1); // the 6th is refused
    expect(await left('2026-11-02T22:45:00Z')).toBe(0);
    expect(await left('2026-11-02T23:05:00Z')).toBe(5); // 00:05 Tuesday in Lagos: a new day
    expect(await claim('manual', '2026-11-02T23:05:00Z')).toBe(4);
  });

  it('parallel requests cannot get past the limit', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => claim('manual', MONDAY_8AM)));
    expect(results.filter((n) => n >= 0)).toHaveLength(5);
    expect(results.filter((n) => n < 0)).toHaveLength(3);
  });

  it('gives a failing Monday insight 3 tries, then leaves it', async () => {
    const due = async () => (await db.query(`select user_id from public.ai_weekly_due($1)`, [MONDAY_8AM])).rows.length;
    await element('Plan', [{ start: -5, due: 20 }]);
    expect(await due()).toBe(1);
    expect([await claim('weekly', MONDAY_8AM), await claim('weekly', MONDAY_8AM), await claim('weekly', MONDAY_8AM)]).toEqual([2, 1, 0]);
    expect(await due()).toBe(0);
    expect(await claim('weekly', MONDAY_8AM)).toBe(-1);
  });

  it('is due a Monday insight once, after the send hour, only with the switch on and something to track', async () => {
    const due = async (now: string) =>
      (await db.query<{ user_id: string }>(`select user_id from public.ai_weekly_due($1)`, [now])).rows.map((r) => r.user_id);
    expect(await due(MONDAY_8AM)).toEqual([]); // nothing tracked yet
    await element('Plan', [{ start: -5, due: 20 }]);
    expect(await due('2026-11-02T05:30:00Z')).toEqual([]); // 06:30: too early
    expect(await due(MONDAY_8AM)).toEqual([USER]);
    expect(await due('2026-11-03T07:10:00Z')).toEqual([]); // Tuesday

    await db.query(
      `insert into ai_summaries (user_id, period_start, period_end, content_md, model, trigger) values ($1, $2, $3, 'x', 'm', 'weekly')`,
      [USER, day(-7), MONDAY],
    );
    expect(await due(MONDAY_8AM)).toEqual([]); // already written

    await db.exec(`delete from ai_summaries`);
    await db.query(`update profiles set ai_summary_enabled = false where id = $1`, [USER]);
    expect(await due(MONDAY_8AM)).toEqual([]);
  });

  it('the digest picks up the insight written for its Monday', async () => {
    await db.query(
      `insert into ai_summaries (user_id, period_start, period_end, content_md, model, trigger) values ($1, $2, $3, 'This week', 'm', 'weekly')`,
      [USER, day(-7), MONDAY],
    );
    const r = await db.query<{ t: string | null }>(`select public.ai_weekly_for($1, $2) as t`, [USER, MONDAY]);
    expect(r.rows[0]!.t).toBe('This week');
    const none = await db.query<{ t: string | null }>(`select public.ai_weekly_for($1, $2) as t`, [USER, day(7)]);
    expect(none.rows[0]!.t).toBeNull();
  });
});

describe('security', () => {
  it('users read only their own insights and cannot write them', async () => {
    await db.query(
      `insert into ai_summaries (user_id, period_start, period_end, content_md, model) values ($1, $2, $2, 'mine', 'm')`,
      [USER, MONDAY],
    );
    expect((await asUser(USER, (q) => q(`select content_md from ai_summaries`))).rows).toEqual([{ content_md: 'mine' }]);
    expect((await asUser(OTHER, (q) => q(`select content_md from ai_summaries`))).rows).toEqual([]);
    await expect(
      asUser(USER, (q) => q(`insert into ai_summaries (user_id, period_start, period_end, content_md, model) values ($1, $2, $2, 'x', 'm')`, [USER, MONDAY])),
    ).rejects.toThrow(/row-level security|permission denied/);
  });

  it('only the server can read the AI input, the limits or the schedule', async () => {
    for (const sql of [
      `select public.ai_summary_input('${USER}', '${MONDAY}')`,
      `select public.ai_manual_left('${USER}')`,
      `select * from public.ai_weekly_due()`,
      `select public.ai_weekly_for('${USER}', '${MONDAY}')`,
    ]) {
      await expect(asUser(USER, (q) => q(sql))).rejects.toThrow(/permission denied/);
    }
  });
});
