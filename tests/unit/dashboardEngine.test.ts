import { describe, expect, it } from 'vitest';
import {
  PERIOD_LABEL,
  buildAdvice,
  categoryPctAt,
  computeKpis,
  dateIn,
  eachDay,
  expectedPct,
  findStalls,
  focusItems,
  inRange,
  isBehindPace,
  laterOf,
  overallComment,
  periodPair,
  totalsByDay,
  urgencyScore,
  weekdayIndex,
  type AdviceElement,
  type AdviceGoal,
  type Snapshot,
} from '@/lib/engine';

describe('date helpers', () => {
  it('weeks start on Monday', () => {
    expect(weekdayIndex('2026-10-26')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-01')).toBe(6); // Sunday
  });
  it('converts instants to the user’s calendar day', () => {
    expect(dateIn('2026-10-25T23:30:00Z', 'Africa/Lagos')).toBe('2026-10-26');
    expect(dateIn('2026-10-25T23:30:00Z', 'UTC')).toBe('2026-10-25');
    expect(dateIn('2026-10-25T12:00:00Z')).toBe('2026-10-25');
  });
  it('lists days and picks the later date', () => {
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(eachDay('2026-11-02', '2026-11-01')).toEqual([]);
    expect(laterOf('2026-10-01', '2026-11-01')).toBe('2026-11-01');
    expect(laterOf('2026-12-01', '2026-11-01')).toBe('2026-12-01');
  });
});

describe('periods (Monday weeks, like-for-like comparison)', () => {
  it('this week vs the same days last week', () => {
    // Wednesday 28 Oct 2026
    expect(periodPair('week', '2026-10-28')).toEqual({
      kind: 'week',
      current: { start: '2026-10-26', end: '2026-10-28' },
      previous: { start: '2026-10-19', end: '2026-10-21' },
    });
    // Sunday: the whole week vs the whole of last week
    expect(periodPair('week', '2026-11-01').previous).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });

  it('this month vs the same days last month, capped at month end', () => {
    expect(periodPair('month', '2026-10-15')).toMatchObject({
      current: { start: '2026-10-01', end: '2026-10-15' },
      previous: { start: '2026-09-01', end: '2026-09-15' },
    });
    // 31 March vs February: capped at 28 Feb
    expect(periodPair('month', '2027-03-31').previous).toEqual({ start: '2027-02-01', end: '2027-02-28' });
    // January vs December of the previous year
    expect(periodPair('month', '2027-01-10').previous).toEqual({ start: '2026-12-01', end: '2026-12-10' });
  });

  it('this quarter vs last quarter', () => {
    expect(periodPair('quarter', '2026-11-15')).toMatchObject({
      current: { start: '2026-10-01', end: '2026-11-15' },
      previous: { start: '2026-07-01', end: '2026-08-15' },
    });
    expect(periodPair('quarter', '2027-02-10').previous.start).toBe('2026-10-01');
    expect(periodPair('quarter', '2026-12-31').previous.end).toBe('2026-09-30');
  });

  it('a custom range is compared with the same length just before it', () => {
    expect(periodPair('custom', '2026-10-28', { start: '2026-10-10', end: '2026-10-19' }).previous).toEqual({
      start: '2026-09-30',
      end: '2026-10-09',
    });
    expect(() => periodPair('custom', '2026-10-28')).toThrow(RangeError);
    expect(() => periodPair('custom', '2026-10-28', { start: '2026-10-20', end: '2026-10-10' })).toThrow(RangeError);
  });

  it('labels and range checks', () => {
    expect(PERIOD_LABEL.week).toEqual({ current: 'This week', previous: 'last week' });
    expect(inRange('2026-10-26', { start: '2026-10-26', end: '2026-10-28' })).toBe(true);
    expect(inRange('2026-10-29', { start: '2026-10-26', end: '2026-10-28' })).toBe(false);
  });
});

function snap(date: string, patch: Partial<Snapshot> = {}): Snapshot {
  return { date, elementId: 'e1', categoryId: 'c1', status: 'in_progress', goalsTotal: 4, goalsDone: 1, overdue: 0, abandoned: 0, dueSoon: 1, ...patch };
}

describe('KPIs (acceptance test 10: this week vs last week from snapshot fixtures)', () => {
  // Wednesday 28 Oct 2026, Lagos. Last week's comparison point is Wednesday 21 Oct.
  const period = periodPair('week', '2026-10-28');
  const snapshots: Snapshot[] = [
    snap('2026-10-20', { goalsDone: 0, overdue: 2 }),
    snap('2026-10-21', { goalsDone: 1, overdue: 1, dueSoon: 2 }),
    snap('2026-10-21', { elementId: 'e2', goalsTotal: 2, goalsDone: 1, overdue: 0, dueSoon: 0 }),
    snap('2026-10-21', { elementId: 'e3', status: 'decommissioned', goalsTotal: 10, goalsDone: 0, overdue: 5 }),
    snap('2026-10-26', { goalsDone: 2 }),
    snap('2026-10-27', { goalsDone: 2, abandoned: 1 }),
  ];
  const kpis = computeKpis({
    period,
    today: { goalsTotal: 6, goalsDone: 4, overdue: 0, abandoned: 1, dueSoon: 2 },
    doneDates: ['2026-10-20', '2026-10-21', '2026-10-26', '2026-10-28', '2026-10-28', '2026-10-15'],
    snapshots,
  });
  const byKey = Object.fromEntries(kpis.map((k) => [k.key, k]));

  it('overall completion compares today with the same weekday last week, ignoring decommissioned elements', () => {
    // Last Wednesday: (1 + 1) done of (4 + 2) = 33%; today 4 of 6 = 67%.
    expect(byKey.completion).toMatchObject({ value: 67, previous: 33, delta: 34, goodWhenUp: true, unit: '%' });
  });

  it('goals completed counts Mon–Wed this week against Mon–Wed last week', () => {
    expect(byKey.completed).toMatchObject({ value: 3, previous: 2, delta: 1 });
    expect(byKey.completed!.series).toEqual([1, 1, 3]); // cumulative Mon, Tue, Wed
  });

  it('counts go down as good news for overdue, due soon and abandoned', () => {
    expect(byKey.overdue).toMatchObject({ value: 0, previous: 1, delta: -1, goodWhenUp: false });
    expect(byKey.dueSoon).toMatchObject({ value: 2, previous: 2, delta: 0 });
    expect(byKey.abandoned).toMatchObject({ value: 1, previous: 0, delta: 1 });
  });

  it('sparklines use snapshot days, ending with today’s live value', () => {
    expect(byKey.overdue!.series).toEqual([0, 0, 0]);
    expect(byKey.abandoned!.series).toEqual([0, 1, 1]);
  });

  it('with no history, deltas are null rather than invented', () => {
    const fresh = computeKpis({ period, today: { goalsTotal: 2, goalsDone: 1, overdue: 0, abandoned: 0, dueSoon: 1 }, doneDates: [], snapshots: [] });
    expect(fresh.find((k) => k.key === 'completion')).toMatchObject({ value: 50, previous: null, delta: null, series: [50] });
  });

  it('category % at a past point comes from that category’s snapshots', () => {
    expect(categoryPctAt(snapshots, 'c1', period.previous)).toBe(33);
    expect(categoryPctAt(snapshots, 'other', period.previous)).toBeNull();
    expect(totalsByDay(snapshots).get('2026-10-21')).toEqual({ goalsTotal: 6, goalsDone: 2, overdue: 1, abandoned: 0, dueSoon: 2 });
  });
});

describe('pace (§7.1)', () => {
  const g = (start: string, due: string) => ({ id: 'x', isDone: false, startDate: start, dueDate: due, tickChangedAt: null });
  it('expected % is the share of time elapsed, averaged over goals', () => {
    expect(expectedPct([g('2026-10-01', '2026-10-31')], '2026-10-16')).toBe(50);
    expect(expectedPct([g('2026-10-01', '2026-10-31'), g('2026-11-01', '2026-11-30')], '2026-10-31')).toBe(50);
    expect(expectedPct([g('2026-10-10', '2026-10-10')], '2026-10-10')).toBe(100);
    expect(expectedPct([g('2026-10-10', '2026-10-10')], '2026-10-09')).toBe(0);
    expect(expectedPct([], '2026-10-09')).toBe(0);
  });
  it('behind pace means more than 15 points under expected', () => {
    expect(isBehindPace(30, 50)).toBe(true);
    expect(isBehindPace(35, 50)).toBe(false);
  });
});

function goal(id: string, due: string, patch: Partial<AdviceGoal> = {}): AdviceGoal {
  return { id, title: `Goal ${id}`, isDone: false, startDate: '2026-10-01', dueDate: due, tickChangedAt: null, doneDate: null, ...patch };
}

function el(id: string, goals: AdviceGoal[], patch: Partial<AdviceElement> = {}): AdviceElement {
  const done = goals.filter((x) => x.isDone).length;
  return {
    id,
    name: `Element ${id}`,
    categoryId: 'c1',
    status: done === goals.length ? 'completed' : done > 0 ? 'in_progress' : 'started',
    pct: Math.round((done / goals.length) * 100),
    goals,
    startDate: '2026-10-01',
    statusSince: null,
    lastTickDate: null,
    ...patch,
  };
}

const TODAY = '2026-10-28';

describe('Focus Now and Keep Tabs On (§7.1)', () => {
  it('orders overdue first, then 0–14 days, then 15–29; skips done, abandoned, future and far goals', () => {
    const items = focusItems(
      [
        el('a', [goal('a1', '2026-11-10'), goal('a2', '2026-10-26'), goal('a3', '2026-11-20')]),
        el('b', [
          goal('b1', '2026-10-30'),
          goal('b2', '2026-10-10'), // abandoned
          goal('b3', '2026-10-29', { isDone: true }),
          goal('b4', '2026-12-30'), // 63 days: too far
          goal('b5', '2026-11-20', { startDate: '2026-11-05' }), // not started yet
        ]),
      ],
      TODAY,
    );
    expect(items.map((i) => i.goalId)).toEqual(['a2', 'b1', 'a1', 'a3']);
    expect(items[0]).toMatchObject({ band: 'overdue', daysLeft: -2, daysToAbandonment: 5 });
  });

  it('urgency rises as the deadline nears and when overdue', () => {
    expect(urgencyScore(-3, 25, false)).toBeGreaterThan(urgencyScore(0, 25, false));
    expect(urgencyScore(0, 25, false)).toBeGreaterThan(urgencyScore(10, 25, false));
    expect(urgencyScore(10, 50, false)).toBeGreaterThan(urgencyScore(10, 25, false));
    expect(urgencyScore(10, 25, true)).toBeGreaterThan(urgencyScore(10, 25, false));
    expect(urgencyScore(-30, 25, false)).toBe(urgencyScore(-7, 25, false)); // capped
  });
});

describe('stalls (§7.1, counted from the later of start date and status change)', () => {
  it('flags no ticks for 14+ days, Resource Delay over 7 days, and Started at 0% over 7 days', () => {
    const stalls = findStalls(
      [
        el('p', [goal('p1', '2026-12-01', { isDone: true }), goal('p2', '2026-12-01')], { lastTickDate: '2026-10-10' }),
        el('q', [goal('q1', '2026-12-01')], { status: 'resource_delay', statusSince: '2026-10-15' }),
        el('r', [goal('r1', '2026-12-01')], { status: 'started', startDate: '2026-10-25' }),
        el('s', [goal('s1', '2026-12-01')], { status: 'started', startDate: '2026-10-01', statusSince: '2026-10-25' }),
        el('t', [goal('t1', '2026-12-01')], { status: 'started', startDate: '2026-10-01' }),
      ],
      TODAY,
    );
    expect(stalls).toEqual([
      { elementId: 't', elementName: 'Element t', kind: 'started_idle', days: 27 },
      { elementId: 'p', elementName: 'Element p', kind: 'no_ticks', days: 18 },
      { elementId: 'q', elementName: 'Element q', kind: 'resource_delay', days: 13 },
    ]);
  });
});

describe('advice', () => {
  it('writes the overall comment from the template', () => {
    expect(
      overallComment({
        periodLabel: 'This week',
        previousLabel: 'last week',
        completedNow: 6,
        completedBefore: 4,
        overallPct: 48,
        overallPctBefore: 43,
        categories: [
          { id: '1', name: 'Business', pct: 71, previousPct: 60, overdue: 0 },
          { id: '2', name: 'Investment', pct: 22, previousPct: 22, overdue: 2 },
          { id: '3', name: 'Paid Job', pct: 0, previousPct: null, overdue: 0 },
        ],
      }),
    ).toBe(
      'This week you completed 6 goals (▲2 vs last week). Overall completion is 48% (▲5 pts). Business is your strongest area at 71%. Investment is lagging at 22% with 2 goals overdue.',
    );
    expect(
      overallComment({
        periodLabel: 'This month',
        previousLabel: 'last month',
        completedNow: 1,
        completedBefore: 1,
        overallPct: 10,
        overallPctBefore: null,
        categories: [],
      }),
    ).toBe('This month you completed 1 goal (no change vs last month). Overall completion is 10%.');
  });

  it('collects behind-pace, keep-tabs, wins and the most improved category', () => {
    const period = periodPair('week', TODAY);
    const advice = buildAdvice({
      periodLabel: 'This week',
      previousLabel: 'last week',
      completedNow: 2,
      completedBefore: 0,
      overallPct: 40,
      overallPctBefore: 30,
      today: TODAY,
      period,
      categories: [
        { id: '1', name: 'Business', pct: 50, previousPct: 30, overdue: 0 },
        { id: '2', name: 'Investment', pct: 30, previousPct: 25, overdue: 0 },
        { id: '3', name: 'Paid Job', pct: 10, previousPct: 20, overdue: 1 },
      ],
      elements: [
        // Behind pace and 30+ days away: Keep Tabs On
        el('far', [goal('f1', '2026-12-10', { startDate: '2026-01-01' })]),
        // Behind pace but near: behind, not Keep Tabs On
        el('near', [goal('n1', '2026-11-05', { startDate: '2026-09-01' })]),
        // Completed this week: a win
        el('won', [goal('w1', '2026-11-30', { isDone: true, doneDate: '2026-10-27' })]),
        // Completed long ago: not a win this week
        el('old', [goal('o1', '2026-09-30', { isDone: true, doneDate: '2026-09-20' })]),
      ],
    });
    expect(advice.behindPace.map((p) => p.elementId)).toEqual(['far', 'near']);
    expect(advice.keepTabsOn.map((p) => p.elementId)).toEqual(['far']);
    expect(advice.wins.completed).toEqual([{ elementId: 'won', elementName: 'Element won' }]);
    expect(advice.wins.mostImproved).toEqual({ name: 'Business', points: 20 });
    expect(advice.focus.map((f) => f.goalId)).toEqual(['n1']);
    expect(advice.overall).toContain('This week you completed 2 goals');
  });
});
