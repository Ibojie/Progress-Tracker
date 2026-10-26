import { describe, expect, it } from 'vitest';
import { buildElementView, dueText, formatDate, type ElementWithGoals } from '@/features/elements/model';
import { newElementSchema, resetDateSchema } from '@/features/elements/schemas';
import type { GoalRow } from '@/lib/database.types';
import { describeGoal } from '@/lib/engine';

const TODAY = '2026-10-26';
let n = 0;

function goalRow(patch: Partial<GoalRow> = {}): GoalRow {
  n++;
  return {
    id: `g${n}`,
    user_id: 'u',
    element_id: 'e',
    title: `Goal ${n}`,
    notes: null,
    start_date: '2026-10-01',
    due_date: '2026-12-01',
    original_due_date: '2026-12-01',
    is_done: false,
    done_at: null,
    tick_changed_at: null,
    reset_count: 0,
    sort_order: n,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...patch,
  };
}

function elementRow(goals: GoalRow[], patch: Partial<ElementWithGoals> = {}): ElementWithGoals {
  return {
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
    goals,
    category: { id: 'c', key: 'paid_job', name: 'Paid Job' },
    status_events: [],
    ...patch,
  };
}

describe('buildElementView', () => {
  it('works out status, %, band and next goal from the nearest unfinished goal', () => {
    const v = buildElementView(
      elementRow([
        goalRow({ is_done: true, due_date: '2026-10-28' }),
        goalRow({ due_date: '2026-11-10' }), // 15 days: short term
        goalRow({ due_date: '2027-01-30' }),
      ]),
      TODAY,
    );
    expect(v).toMatchObject({ status: 'in_progress', pct: 33, total: 3, done: 1, daysLeft: 15, band: 'short' });
    expect(v.nextGoal?.row.due_date).toBe('2026-11-10');
    expect(v.lastLoggedStatus).toBeNull();
  });

  it('counts overdue and abandoned goals for the card warnings', () => {
    const v = buildElementView(
      elementRow([goalRow({ due_date: '2026-10-23' }), goalRow({ due_date: '2026-10-10' }), goalRow({ due_date: '2026-12-01' })]),
      TODAY,
    );
    expect(v.overdueCount).toBe(1);
    expect(v.abandonedCount).toBe(1);
    expect(v.band).toBe('overdue');
  });

  it('completed and decommissioned elements take no band colour (§5)', () => {
    expect(buildElementView(elementRow([goalRow({ is_done: true })]), TODAY).band).toBeNull();
    expect(buildElementView(elementRow([goalRow()], { is_decommissioned: true }), TODAY)).toMatchObject({
      status: 'decommissioned',
      band: null,
    });
  });

  it('orders goals by position and reads the last logged status', () => {
    const v = buildElementView(
      elementRow([goalRow({ sort_order: 2, title: 'B' }), goalRow({ sort_order: 1, title: 'A' })], {
        status_events: [{ to_status: 'not_started', created_at: '2026-10-20T00:00:00Z' }],
      }),
      TODAY,
    );
    expect(v.goals.map((g) => g.row.title)).toEqual(['A', 'B']);
    expect(v.lastLoggedStatus).toBe('not_started');
  });

  it('a future start date shows Not Started (§4.6)', () => {
    const v = buildElementView(elementRow([goalRow({ start_date: '2026-11-01', due_date: '2026-11-20' })]), TODAY);
    expect(v.status).toBe('not_started');
    expect(v.startDate).toBe('2026-11-01');
    expect(v.goals[0]!.info.state).toBe('not_started');
  });
});

describe('dueText', () => {
  const info = (due: string) => describeGoal({ id: 'x', isDone: false, startDate: '2026-10-01', dueDate: due, tickChangedAt: null }, TODAY);
  it('reads naturally for every state', () => {
    expect(dueText(info('2026-11-05'), false)).toBe('10 days left');
    expect(dueText(info('2026-10-27'), false)).toBe('1 day left');
    expect(dueText(info('2026-10-26'), false)).toBe('Due today');
    expect(dueText(info('2026-10-23'), false)).toBe('Overdue · 4 days to abandonment');
    expect(dueText(info('2026-10-20'), false)).toBe('Overdue · 1 day to abandonment');
    expect(dueText(info('2026-10-10'), false)).toBe('Abandoned');
    expect(dueText(info('2026-10-10'), true)).toBe('Done');
  });

  it('formats dates in the British style', () => {
    expect(formatDate('2026-11-01')).toBe('1 Nov 2026');
  });
});

describe('wizard and reset validation', () => {
  const goal = { title: 'Unit IG1', start_date: '2026-10-26', due_date: '2026-12-01' };
  const base = { category_id: '7f1c0c5e-4b1a-4f7e-9a3b-2a5f0c9d8e11', name: 'NEBOSH', goals: [goal] };

  it('accepts 1–10 goals and rejects 0 or 11 (acceptance test 12)', () => {
    expect(newElementSchema.safeParse(base).success).toBe(true);
    expect(newElementSchema.safeParse({ ...base, goals: [] }).success).toBe(false);
    expect(newElementSchema.safeParse({ ...base, goals: Array(11).fill(goal) }).success).toBe(false);
    expect(newElementSchema.safeParse({ ...base, goals: Array(10).fill(goal) }).success).toBe(true);
  });

  it('rejects a due date before the start date, and blank titles', () => {
    const bad = newElementSchema.safeParse({ ...base, goals: [{ ...goal, due_date: '2026-10-01' }] });
    expect(bad.success).toBe(false);
    expect(newElementSchema.safeParse({ ...base, goals: [{ ...goal, title: '   ' }] }).success).toBe(false);
  });

  it('a date reset must be after today', () => {
    expect(resetDateSchema(TODAY).safeParse({ new_due_date: '2026-10-26' }).success).toBe(false);
    expect(resetDateSchema(TODAY).safeParse({ new_due_date: '2026-10-27' }).success).toBe(true);
  });
});
