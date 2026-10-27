// @vitest-environment node
//
// Phase 5 alert rules (§9), run against the real migrations (see harness.ts).
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asUserOn, createTestDb } from './harness';

const USER = '00000000-0000-0000-0000-0000000000a1';
const OTHER = '00000000-0000-0000-0000-0000000000b2';
// Monday 2 Nov 2026, 07:10 in Lagos (UTC+1).
const MONDAY_7AM = '2026-11-02T06:10:00Z';
const TODAY = '2026-11-02';

let db: PGlite;
const asUser: ReturnType<typeof asUserOn> = (userId, fn) => asUserOn(db)(userId, fn);

function day(offset: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** An element with one goal per due-date offset (days from TODAY). Returns the element id. */
async function element(name: string, dueOffsets: number[], userId = USER): Promise<string> {
  return asUser(userId, async (q) => {
    const cat = await q<{ id: string }>(`select id from categories where key = 'business'`);
    const el = await q<{ id: string }>(`insert into elements (category_id, name) values ($1, $2) returning id`, [cat.rows[0]!.id, name]);
    const id = el.rows[0]!.id;
    for (const [i, off] of dueOffsets.entries()) {
      await q(`insert into goals (element_id, title, start_date, due_date) values ($1, $2, $3, $4)`, [
        id,
        `${name} goal ${i + 1}`,
        day(Math.min(off, 0) - 30),
        day(off),
      ]);
    }
    return id;
  });
}

async function queue(now = MONDAY_7AM, sendHourOnly = true): Promise<number> {
  const r = await db.query<{ n: number }>(`select public.queue_notifications($1, $2) as n`, [now, sendHourOnly]);
  return r.rows[0]!.n;
}

async function log(where = 'true') {
  const r = await db.query<{ kind: string; channel: string; title: string; goal_title: string | null; element_name: string | null }>(
    `select nl.kind, nl.channel::text as channel, nl.title, g.title as goal_title, e.name as element_name
       from notification_log nl
       left join goals g on g.id = nl.goal_id
       left join elements e on e.id = nl.element_id
      where ${where}
      order by nl.kind, g.title, nl.channel::text`,
  );
  return r.rows;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'a@test'), ($2, 'b@test')`, [USER, OTHER]);
}, 60_000);

beforeEach(async () => {
  await db.exec(`delete from notification_log; delete from elements; delete from push_subscriptions; delete from status_events;`);
  await db.query(
    `update profiles set push_enabled = true, email_digest_enabled = true, in_app_enabled = true,
       quiet_hours_start = null, quiet_hours_end = null, timezone = 'Africa/Lagos'`,
  );
  await db.query(`update profiles set push_enabled = false, email_digest_enabled = false, in_app_enabled = false where id = $1`, [OTHER]);
  await db.query(`insert into push_subscriptions (user_id, endpoint, keys) values ($1, 'https://push.example/1', '{}')`, [USER]);
});

afterAll(async () => {
  await db?.close();
});

describe('goal reminders', () => {
  it('sends due-soon on 21/14/7/3/1 days, due today, overdue days 1–7 and abandoned on day 8', async () => {
    await element('Soon', [21, 14, 7, 3, 1, 0, 2, 5, 22]); // an element holds at most 10 goals
    await element('Late', [-1, -6, -7, -8, -9]);
    await queue();
    const rows = await log(`nl.goal_id is not null`);
    const of = (title: string) => rows.filter((r) => r.goal_title === title).map((r) => `${r.kind}/${r.channel}`);

    for (const n of [1, 2, 3, 4, 5]) expect(of(`Soon goal ${n}`)).toEqual(['due_soon/in_app', 'due_soon/push']); // email: digest only
    expect(of('Soon goal 6')).toEqual(['due_today/email', 'due_today/in_app', 'due_today/push']);
    for (const n of [7, 8, 9]) expect(of(`Soon goal ${n}`)).toEqual([]); // 2, 5 and 22 days: no reminder
    expect(of('Late goal 1')).toEqual(['overdue/email', 'overdue/in_app', 'overdue/push']); // day 1: email
    expect(of('Late goal 2')).toEqual(['overdue/email', 'overdue/in_app', 'overdue/push']); // day 6: email
    expect(of('Late goal 3')).toEqual(['overdue/in_app', 'overdue/push']); // day 7: no email
    expect(of('Late goal 4')).toEqual(['abandoned/email', 'abandoned/in_app', 'abandoned/push']); // day 8
    expect(of('Late goal 5')).toEqual([]); // day 9: already told

    const titles = rows.map((r) => r.title);
    expect(titles).toContain('Due in 1 day: Soon goal 5');
    expect(titles).toContain('6 days left before this goal is abandoned: Late goal 1');
    expect(titles).toContain('1 day left before this goal is abandoned: Late goal 2');
    expect(titles).toContain("Last day before it's abandoned: Late goal 3");
  });

  it('never sends the same alert twice in a day', async () => {
    await element('Plan', [0, 3]);
    const first = await queue();
    expect(first).toBeGreaterThan(0);
    expect(await queue()).toBe(0);
    expect(await queue('2026-11-02T06:50:00Z')).toBe(0);
  });

  it('starts at the send hour (07:00 local), and a later run catches up if that one failed', async () => {
    await element('Plan', [0]);
    expect(await queue('2026-11-02T05:30:00Z')).toBe(0); // 06:30 Lagos: too early
    expect(await queue('2026-11-02T05:30:00Z', false)).toBeGreaterThan(0); // unless asked to run now
    await db.exec(`delete from notification_log`);
    expect(await queue('2026-11-02T09:00:00Z')).toBeGreaterThan(0); // 10:00 Lagos: missed 07:00, catches up
  });

  it('uses each user\'s own timezone', async () => {
    await db.query(`update profiles set timezone = 'Asia/Tokyo' where id = $1`, [USER]);
    await element('Plan', [0]);
    expect(await queue('2026-11-01T20:30:00Z')).toBe(0); // 05:30 on 2 Nov in Tokyo: too early
    // 07:05 in Tokyo on 2 Nov is 22:05 UTC on 1 Nov.
    expect(await queue('2026-11-01T22:05:00Z')).toBeGreaterThan(0);
  });

  it('waits for quiet hours to end when they cover 07:00', async () => {
    await db.query(`update profiles set quiet_hours_start = '22:00', quiet_hours_end = '08:30' where id = $1`, [USER]);
    await element('Plan', [0]);
    expect(await queue(MONDAY_7AM)).toBe(0);
    expect(await queue('2026-11-02T07:45:00Z')).toBe(0); // 08:45: quiet hours are over, but it's not yet 09:00
    expect(await queue('2026-11-02T08:05:00Z')).toBeGreaterThan(0); // 09:05 Lagos: first hour after 08:30
  });

  it('never sends during evening quiet hours, even to catch up', async () => {
    await db.query(`update profiles set quiet_hours_start = '21:00', quiet_hours_end = '06:00' where id = $1`, [USER]);
    await element('Plan', [0]);
    expect(await queue('2026-11-02T21:30:00Z')).toBe(0); // 22:30 Lagos
    expect(await queue('2026-11-02T18:00:00Z')).toBeGreaterThan(0); // 19:00 Lagos
  });

  it('respects each channel switch, and needs a device for push', async () => {
    await db.query(`update profiles set email_digest_enabled = false, in_app_enabled = false where id = $1`, [USER]);
    await db.exec(`delete from push_subscriptions`);
    await element('Plan', [0]);
    await queue();
    expect(await log()).toEqual([]);
  });

  it('never alerts for switched-off elements or finished goals', async () => {
    const off = await element('Off', [0]);
    await element('Done', [0]);
    await asUser(USER, async (q) => {
      await q(`update elements set is_decommissioned = true where id = $1`, [off]);
      await q(`update goals set is_done = true where title = 'Done goal 1'`);
    });
    await queue();
    expect((await log()).filter((r) => r.kind !== 'weekly_digest')).toEqual([]);
  });

  it('sends another user nothing when their channels are off', async () => {
    await element('Theirs', [0], OTHER);
    await queue();
    expect(await log(`nl.user_id = '${OTHER}'`)).toEqual([]);
  });
});

describe('element alerts', () => {
  it('tells once when a whole element becomes abandoned', async () => {
    await element('Lost', [-10, -12]);
    await queue();
    expect((await log(`nl.goal_id is null and nl.kind = 'element_abandoned'`)).map((r) => r.channel)).toEqual(['email', 'in_app', 'push']);
    // The next day: not again.
    expect(await queue('2026-11-03T06:10:00Z')).toBe(0);
  });

  it('nudges weekly about Resource Delay over 7 days', async () => {
    const id = await asUser(USER, async (q) => {
      const cat = await q<{ id: string }>(`select id from categories where key = 'business'`);
      const el = await q<{ id: string }>(
        `insert into elements (category_id, name, zero_progress_status) values ($1, 'Waiting', 'resource_delay') returning id`,
        [cat.rows[0]!.id],
      );
      await q(`insert into goals (element_id, title, start_date, due_date) values ($1, 'Later', $2, $3)`, [el.rows[0]!.id, day(-20), day(40)]);
      return el.rows[0]!.id;
    });
    await db.query(`update elements set created_at = $2 where id = $1`, [id, '2026-10-20T00:00:00Z']);
    await db.query(
      `insert into status_events (user_id, element_id, to_status, created_at) values ($1, $2, 'resource_delay', '2026-10-20T00:00:00Z')`,
      [USER, id],
    );
    await queue();
    expect((await log(`nl.kind = 'resource_delay'`)).map((r) => r.channel)).toEqual(['in_app', 'push']);
    expect(await queue('2026-11-05T06:10:00Z')).toBe(0); // within the week
    expect(await queue('2026-11-09T06:10:00Z')).toBeGreaterThan(0); // a week later
  });

  it('does not call an element stalled the day its first goal starts', async () => {
    const waiting = await asUser(USER, async (q) => {
      const cat = await q<{ id: string }>(`select id from categories where key = 'business'`);
      const el = await q<{ id: string }>(`insert into elements (category_id, name) values ($1, 'Starts today') returning id`, [cat.rows[0]!.id]);
      await q(`insert into goals (element_id, title, start_date, due_date) values ($1, 'First', $2, $3)`, [el.rows[0]!.id, TODAY, day(40)]);
      return el.rows[0]!.id;
    });
    await db.query(`update elements set created_at = '2026-10-01T00:00:00Z' where id = $1`, [waiting]);
    await queue();
    expect(await log(`nl.kind = 'stalled'`)).toEqual([]);
  });

  it('nudges about an element with no ticks for 14 days, but not a fresh one', async () => {
    const stale = await element('Stale', [40]);
    await element('Fresh', [40]);
    await db.query(`update elements set created_at = '2026-10-01T00:00:00Z' where id = $1`, [stale]);
    await queue();
    expect((await log(`nl.kind = 'stalled'`)).map((r) => `${r.element_name}/${r.channel}`)).toEqual(['Stale/in_app', 'Stale/push']);
  });
});

describe('weekly digest', () => {
  it('queues one digest email on Mondays only', async () => {
    await queue();
    expect(await log(`nl.kind = 'weekly_digest'`)).toEqual([expect.objectContaining({ channel: 'email' })]);
    await db.exec(`delete from notification_log`);
    await queue('2026-11-03T06:10:00Z'); // Tuesday
    expect(await log(`nl.kind = 'weekly_digest'`)).toEqual([]);
  });

  it('summarises last week against the week before, without switched-off elements', async () => {
    const live = await element('Live', [1, -2, 30]);
    const off = await element('Off', [1]);
    // Tick it, then move the tick time into last week (the trigger stamps "now" on the tick).
    await db.query(`update goals set is_done = true where element_id = $1 and due_date = $2`, [live, day(30)]);
    await db.query(`update goals set done_at = '2026-10-28T10:00:00Z' where element_id = $1 and due_date = $2`, [live, day(30)]);
    await db.query(`update elements set is_decommissioned = true where id = $1`, [off]);
    const r = await db.query<{ d: Record<string, unknown> }>(`select public.weekly_digest_data($1, $2) as d`, [USER, TODAY]);
    expect(r.rows[0]!.d).toMatchObject({
      week_start: '2026-10-26',
      week_end: '2026-11-01',
      goals_total: 3,
      goals_done: 1,
      done_last_week: 1,
      done_week_before: 0,
      overdue: 1,
      due_soon: 1,
    });
    expect((r.rows[0]!.d.focus as { title: string }[]).map((f) => f.title)).toEqual(['Live goal 2', 'Live goal 1']);
  });
});

describe('delivery bookkeeping', () => {
  it('claims each waiting push/email once, retries failures, and stops after 5 tries', async () => {
    await element('Plan', [0]);
    await queue();
    const claimed = await db.query<{ id: string; channel: string }>(`select * from public.claim_deliveries(100)`);
    expect(claimed.rows.map((r) => r.channel).sort()).toEqual(['email', 'email', 'push']); // due today + digest
    expect((await db.query(`select * from public.claim_deliveries(100)`)).rows).toEqual([]); // claimed: not handed out again

    const push = claimed.rows.find((r) => r.channel === 'push')!;
    await db.query(`select public.finish_delivery($1, false, 'push 500')`, [push.id]);
    expect((await db.query(`select * from public.claim_deliveries(100)`)).rows).toHaveLength(1); // retried
    await db.query(`select public.finish_delivery($1, true)`, [push.id]);
    expect((await db.query(`select * from public.claim_deliveries(100)`)).rows).toEqual([]);
  });
});

describe('stale deliveries', () => {
  it('drops a waiting alert once its goal is ticked or its element switched off', async () => {
    const id = await element('Plan', [0]);
    await queue();
    await db.query(`update goals set is_done = true where element_id = $1`, [id]);
    const claimed = await db.query<{ kind: string }>(`select kind from public.claim_deliveries(100)`);
    expect(claimed.rows.map((r) => r.kind)).toEqual(['weekly_digest']); // the due-today push and email are dropped
    const dropped = await db.query<{ last_error: string }>(
      `select last_error from notification_log where kind = 'due_today' and channel <> 'in_app'`,
    );
    expect(dropped.rows.map((r) => r.last_error)).toEqual(['No longer needed', 'No longer needed']);
  });
});

describe('push devices', () => {
  const FCM = 'https://fcm.googleapis.com/fcm/send/abc';

  it('saves a device only for a real push service, through the server function', async () => {
    await asUser(USER, (q) => q(`select register_push_subscription($1, 'p', 'a', 'Android · Chrome')`, [FCM]));
    for (const bad of ['https://evil.example/x', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.example/x']) {
      await expect(asUser(USER, (q) => q(`select register_push_subscription($1, 'p', 'a', 'x')`, [bad]))).rejects.toThrow(/supported/);
    }
    await expect(
      asUser(USER, (q) => q(`insert into push_subscriptions (endpoint, keys) values ('https://fcm.googleapis.com/fcm/send/z', '{}')`)),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(null, (q) => q(`select register_push_subscription($1, 'p', 'a', 'x')`, [FCM]))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('moves a device to whoever signs in on it next, so the last user stops getting reminders there', async () => {
    await asUser(USER, (q) => q(`select register_push_subscription($1, 'p', 'a', 'Phone')`, [FCM]));
    await asUser(OTHER, (q) => q(`select register_push_subscription($1, 'p2', 'a2', 'Phone')`, [FCM]));
    const rows = await db.query<{ user_id: string }>(`select user_id from push_subscriptions where endpoint = $1`, [FCM]);
    expect(rows.rows).toEqual([{ user_id: OTHER }]);
    // Each user can still remove their own devices.
    await asUser(OTHER, (q) => q(`delete from push_subscriptions where endpoint = $1`, [FCM]));
    expect((await db.query(`select 1 from push_subscriptions where endpoint = $1`, [FCM])).rows).toEqual([]);
  });
});

describe('security', () => {
  it('users can read their own in-app alerts and mark them read, nothing more', async () => {
    await element('Plan', [0]);
    await queue();
    const mine = await asUser(USER, (q) => q<{ id: string }>(`select id from notification_log where channel = 'in_app'`));
    expect(mine.rows).toHaveLength(1);
    expect((await asUser(OTHER, (q) => q(`select id from notification_log`))).rows).toEqual([]);

    await asUser(USER, (q) => q(`update notification_log set read_at = now() where id = $1`, [mine.rows[0]!.id]));
    await expect(asUser(USER, (q) => q(`update notification_log set title = 'x'`))).rejects.toThrow(/permission denied/);
    await expect(
      asUser(USER, (q) => q(`insert into notification_log (user_id, kind, channel) values ($1, 'x', 'in_app')`, [USER])),
    ).rejects.toThrow(/row-level security|permission denied/);
  });

  it('only the server can queue, claim or read digests', async () => {
    for (const sql of [
      `select public.queue_notifications()`,
      `select * from public.claim_deliveries(1)`,
      `select public.weekly_digest_data('${USER}', '${TODAY}')`,
      `select public.notify_token_ok('x')`,
    ]) {
      await expect(asUser(USER, (q) => q(sql))).rejects.toThrow(/permission denied/);
    }
  });
});
