import { describe, expect, it } from 'vitest';
import {
  bandDistribution,
  burndown,
  completedByCategory,
  cumulativeCompletions,
  deadlineCalendar,
  statusMix,
} from '@/features/dashboard/chartData';
import { periodPair, type AdviceElement, type AdviceGoal } from '@/lib/engine';

const TODAY = '2026-10-28'; // Wednesday
const period = periodPair('week', TODAY);
const cats = [
  { id: 'c1', key: 'paid_job', name: 'Paid Job' },
  { id: 'c2', key: 'business', name: 'Business' },
];

function g(id: string, due: string, patch: Partial<AdviceGoal> = {}): AdviceGoal {
  return { id, title: id, isDone: false, startDate: '2026-10-01', dueDate: due, tickChangedAt: null, doneDate: null, ...patch };
}
function el(id: string, categoryId: string, goals: AdviceGoal[], status: AdviceElement['status'] = 'in_progress'): AdviceElement {
  return { id, name: id, categoryId, status, pct: 0, goals, startDate: '2026-10-01', statusSince: null, lastTickDate: null };
}

const elements = [
  el('a', 'c1', [g('a1', '2026-11-01', { isDone: true, doneDate: '2026-10-27' }), g('a2', '2026-10-25'), g('a3', '2026-10-10')]),
  el('b', 'c2', [g('b1', '2026-12-31', { isDone: true, doneDate: '2026-10-20' }), g('b2', '2026-10-28')], 'started'),
];

describe('chart data', () => {
  it('completed per category, this period vs last', () => {
    expect(completedByCategory(elements, cats, period)).toEqual([
      { key: 'paid_job', name: 'Paid Job', current: 1, previous: 0 },
      { key: 'business', name: 'Business', current: 0, previous: 1 },
    ]);
  });

  it('cumulative completions aligned on day 1', () => {
    expect(cumulativeCompletions(['2026-10-20', '2026-10-27', '2026-10-28'], period)).toEqual({
      days: ['2026-10-26', '2026-10-27', '2026-10-28'],
      current: [0, 1, 2],
      previous: [0, 1, 1],
    });
  });

  it('status mix per category, only statuses in use', () => {
    expect(statusMix(elements, cats)).toEqual({
      statuses: ['started', 'in_progress'],
      rows: [
        { key: 'paid_job', name: 'Paid Job', counts: [0, 1] },
        { key: 'business', name: 'Business', counts: [1, 0] },
      ],
    });
  });

  it('90-day deadline calendar with band colours', () => {
    const cells = deadlineCalendar(elements, TODAY);
    expect(cells).toHaveLength(90);
    expect(cells[0]).toMatchObject({ date: '2026-10-28', count: 1, band: 'immediate' });
    expect(cells[0]!.goals[0]).toEqual({ goalId: 'b2', title: 'b2', elementId: 'b', elementName: 'b' });
    expect(cells[64]).toMatchObject({ date: '2026-12-31', count: 0, band: 'long' }); // b1 is done
  });

  it('band distribution counts open goals, skipping done and abandoned', () => {
    expect(bandDistribution(elements, TODAY)).toEqual([
      { band: 'overdue', count: 1 },
      { band: 'immediate', count: 1 },
      { band: 'short', count: 0 },
      { band: 'medium', count: 0 },
      { band: 'long', count: 0 },
    ]);
  });

  it('burndown: actual stops at today, ideal falls to zero on the last due date', () => {
    const b = burndown(
      [
        { startDate: '2026-10-26', dueDate: '2026-10-28', doneDate: '2026-10-27' },
        { startDate: '2026-10-26', dueDate: '2026-10-30', doneDate: null },
      ],
      '2026-10-28',
    )!;
    expect(b.days).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
    expect(b.ideal).toEqual([2, 1.5, 1, 0.5, 0]);
    expect(b.actual).toEqual([2, 1, 1, null, null]);
    expect(burndown([], TODAY)).toBeNull();
  });
});
