// @vitest-environment node
//
// The nightly job uses an SQL copy of the status engine. These tests prove the copy and the
// TypeScript engine agree, on hundreds of random elements and dates, and test the job itself.
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addDays,
  completion,
  daysBetween,
  describeGoal,
  resolveElementStatus,
  type EngineElement,
  type EngineGoal,
} from '@/lib/engine';
import { createTestDb } from './harness';

const USER = '00000000-0000-0000-0000-0000000000c1';
const BASE = '2026-10-15';
let db: PGlite;

/** Small deterministic random generator, so failures can be replayed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface Scenario {
  element: EngineElement;
  goals: EngineGoal[];
}

function randomScenario(r: () => number): Scenario {
  const int = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  const ts = (dayOffset: number) => new Date(Date.parse(`${BASE}T12:00:00Z`) + dayOffset * 86_400_000 + int(0, 3600) * 1000).toISOString();
  const goals: EngineGoal[] = Array.from({ length: int(1, 10) }, (_, i) => {
    const start = addDays(BASE, int(-60, 30));
    const isDone = r() < 0.4;
    return {
      id: `g${i}`,
      isDone,
      startDate: start,
      dueDate: addDays(start, int(0, 90)),
      tickChangedAt: r() < 0.6 ? ts(int(-30, 5)) : null,
    };
  });
  return {
    goals,
    element: {
      isDecommissioned: r() < 0.08,
      zeroProgressStatus: r() < 0.3 ? 'resource_delay' : r() < 0.5 ? 'started' : 'not_started',
      recommissionedAt: r() < 0.15 ? ts(int(-30, 5)) : null,
      restartedAt: r() < 0.15 ? ts(int(-30, 5)) : null,
    },
  };
}

async function insertScenario(sc: Scenario, categoryId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const el = await tx.query<{ id: string }>(
      `insert into elements (user_id, category_id, name, is_decommissioned, zero_progress_status, recommissioned_at, restarted_at)
       values ($1, $2, 'Scenario', $3, $4, $5, $6) returning id`,
      [USER, categoryId, sc.element.isDecommissioned, sc.element.zeroProgressStatus, sc.element.recommissionedAt, sc.element.restartedAt],
    );
    const id = el.rows[0]!.id;
    for (const g of sc.goals) {
      await tx.query(
        `insert into goals (user_id, element_id, title, start_date, due_date, is_done) values ($1, $2, $3, $4, $5, $6)`,
        [USER, id, g.id, g.startDate, g.dueDate, g.isDone],
      );
    }
    // The insert trigger manages tick_changed_at; set the scenario's value directly as the owner.
    for (const g of sc.goals) {
      await tx.query(`update goals set tick_changed_at = $1 where element_id = $2 and title = $3`, [g.tickChangedAt, id, g.id]);
    }
    return id;
  });
}

function expected(sc: Scenario, today: string) {
  const infos = sc.goals.map((g) => describeGoal(g, today));
  const { pct, total, done } = completion(sc.goals);
  return {
    status: resolveElementStatus(sc.element, sc.goals, today),
    pct,
    goals_total: total,
    goals_done: done,
    overdue: infos.filter((i) => i.state === 'overdue').length,
    abandoned: infos.filter((i) => i.state === 'abandoned').length,
    due_soon: sc.goals.filter((g) => !g.isDone && daysBetween(today, g.dueDate) >= 0 && daysBetween(today, g.dueDate) <= 14).length,
  };
}

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'parity@test')`, [USER]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('SQL status engine matches the TypeScript engine', () => {
  it('agrees on 300 random elements across 5 dates each', async () => {
    const r = rng(20261026);
    const cat = (await db.query<{ id: string }>(`select id from categories where user_id = $1 limit 1`, [USER])).rows[0]!.id;
    const mismatches: string[] = [];
    for (let i = 0; i < 300; i++) {
      const sc = randomScenario(r);
      const id = await insertScenario(sc, cat);
      for (const offset of [-20, -1, 0, 7, 40]) {
        const today = addDays(BASE, offset);
        const sql = (
          await db.query<Record<string, unknown>>(
            `select status, pct, goals_total, goals_done, overdue, abandoned, due_soon from engine_element_status($1, $2)`,
            [id, today],
          )
        ).rows[0];
        const ts = expected(sc, today);
        if (JSON.stringify(sql) !== JSON.stringify(ts)) mismatches.push(`#${i} on ${today}: SQL ${JSON.stringify(sql)} vs TS ${JSON.stringify(ts)}`);
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  }, 120_000);
});

describe('take_daily_snapshots', () => {
  const OWNER = '00000000-0000-0000-0000-0000000000c2';

  it('writes a snapshot per element for the user’s own date, logs status changes once, and can re-run', async () => {
    await db.query(`insert into auth.users (id, email) values ($1, 'owner@test')`, [OWNER]);
    const cat = (await db.query<{ id: string }>(`select id from categories where user_id = $1 and key = 'business'`, [OWNER])).rows[0]!.id;
    const elementId = await db.transaction(async (tx) => {
      const el = await tx.query<{ id: string }>(`insert into elements (user_id, category_id, name) values ($1, $2, 'Future') returning id`, [OWNER, cat]);
      await tx.query(
        `insert into goals (user_id, element_id, title, start_date, due_date) values ($1, $2, 'G', '2026-11-01', '2026-11-20')`,
        [OWNER, el.rows[0]!.id],
      );
      return el.rows[0]!.id;
    });

    // 31 Oct 23:30 UTC is already 1 Nov in Lagos: the start date has arrived there.
    await db.query(`select take_daily_snapshots('2026-10-31T23:30:00Z')`);
    // Run again the same night: no duplicate snapshot or history row.
    await db.query(`select take_daily_snapshots('2026-10-31T23:45:00Z')`);

    const snaps = (
      await db.query<{ snapshot_date: Date; status: string; due_soon_count: number; goals_total: number }>(
        `select snapshot_date, status, due_soon_count, goals_total from daily_snapshots where element_id = $1`,
        [elementId],
      )
    ).rows;
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.snapshot_date.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(snaps[0]).toMatchObject({ status: 'started', due_soon_count: 0, goals_total: 1 });

    const events = (
      await db.query<{ from_status: string | null; to_status: string; reason: string }>(
        `select from_status, to_status, reason from status_events where element_id = $1 order by created_at`,
        [elementId],
      )
    ).rows;
    expect(events).toEqual([{ from_status: null, to_status: 'started', reason: 'Nightly check' }]);
  });

  it('cannot be called through the API', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(`set local role authenticated`);
        await tx.query(`select take_daily_snapshots()`);
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
