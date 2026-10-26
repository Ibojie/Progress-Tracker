import { describe, expect, it } from 'vitest';
import {
  BAND_LABEL,
  STATUS_META,
  TEXT_BLACK,
  TEXT_DARK,
  TEXT_LIGHT,
  abandonedGoalCount,
  addDays,
  bandColor,
  bandFor,
  completion,
  contrastRatio,
  daysBetween,
  describeGoal,
  elementDaysLeft,
  elementStartDate,
  goalState,
  isElementAbandoned,
  resolveElementStatus,
  statusChange,
  statusLabel,
  todayIn,
  zeroProgressControl,
  type EngineElement,
  type EngineGoal,
} from '@/lib/engine';

const TODAY = '2026-10-26';
let seq = 0;

/** A goal relative to TODAY: start/due given as day offsets. */
function goal(opts: { done?: boolean; start?: number; due?: number; tick?: string | null } = {}): EngineGoal {
  return {
    id: `g${++seq}`,
    isDone: opts.done ?? false,
    startDate: addDays(TODAY, opts.start ?? -10),
    dueDate: addDays(TODAY, opts.due ?? 30),
    tickChangedAt: opts.tick ?? null,
  };
}

function element(opts: Partial<EngineElement> = {}): EngineElement {
  return { isDecommissioned: false, zeroProgressStatus: 'not_started', recommissionedAt: null, restartedAt: null, ...opts };
}

const status = (goals: EngineGoal[], el: EngineElement = element(), today = TODAY) =>
  resolveElementStatus(el, goals, today);
const pctOf = (goals: EngineGoal[]) => completion(goals).pct;

describe('dates', () => {
  it('counts calendar days, including across months and years', () => {
    expect(daysBetween('2026-10-26', '2026-11-01')).toBe(6);
    expect(daysBetween('2026-11-01', '2026-10-26')).toBe(-6);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(addDays('2026-10-26', 7)).toBe('2026-11-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rejects malformed dates', () => {
    expect(() => daysBetween('26/10/2026', '2026-10-26')).toThrow(RangeError);
  });

  it('works out today in Lagos, not in UTC', () => {
    // 23:30 UTC on 25 Oct is 00:30 on 26 Oct in Lagos (UTC+1).
    expect(todayIn('Africa/Lagos', new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
    expect(todayIn('UTC', new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-25');
    expect(todayIn()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('goal states', () => {
  it('done wins over every date', () => {
    expect(goalState(goal({ done: true, due: -30 }), TODAY)).toBe('done');
    expect(goalState(goal({ done: true, start: 5, due: 10 }), TODAY)).toBe('done');
  });

  it('a goal starting in the future is Not Started (§4.6)', () => {
    expect(goalState(goal({ start: 6, due: 20 }), TODAY)).toBe('not_started');
    expect(goalState(goal({ start: 0, due: 20 }), TODAY)).toBe('open');
  });

  it('overdue on days 1–7 with days to abandonment, abandoned from day 8 (§4.3)', () => {
    expect(describeGoal(goal({ due: 0 }), TODAY)).toMatchObject({ state: 'open', daysLeft: 0, daysToAbandonment: null });
    expect(describeGoal(goal({ due: -1 }), TODAY)).toMatchObject({ state: 'overdue', daysOverdue: 1, daysToAbandonment: 6 });
    expect(describeGoal(goal({ due: -7 }), TODAY)).toMatchObject({ state: 'overdue', daysOverdue: 7, daysToAbandonment: 0 });
    expect(describeGoal(goal({ due: -8 }), TODAY)).toMatchObject({ state: 'abandoned', daysOverdue: 8, daysToAbandonment: null });
  });
});

describe('completion', () => {
  it('weighs every goal equally and rounds', () => {
    expect(completion([])).toEqual({ total: 0, done: 0, pct: 0 });
    expect(pctOf([goal({ done: true }), goal(), goal()])).toBe(33);
    expect(pctOf([goal({ done: true }), goal({ done: true }), goal()])).toBe(67);
  });
});

describe('element status resolution order (§4.2)', () => {
  it('decommissioned beats everything', () => {
    expect(status([goal({ done: true })], element({ isDecommissioned: true }))).toBe('decommissioned');
  });

  it('abandoned only when every unfinished goal is abandoned', () => {
    expect(status([goal({ due: -9 }), goal({ due: -20 })])).toBe('abandoned');
    expect(status([goal({ due: -9 }), goal({ due: 5 })])).toBe('started');
    expect(abandonedGoalCount([goal({ due: -9 }), goal({ due: 5 })], TODAY)).toBe(1);
    // A finished element is never abandoned, even with old due dates.
    expect(isElementAbandoned([goal({ done: true, due: -30 })], TODAY)).toBe(false);
  });

  it('recommissioned until the next tick change', () => {
    const at = '2026-10-20T10:00:00Z';
    const el = element({ recommissionedAt: at });
    expect(status([goal({ done: true, tick: '2026-10-01T00:00:00Z' }), goal()], el)).toBe('recommissioned');
    expect(status([goal({ done: true, tick: '2026-10-21T00:00:00Z' }), goal()], el)).toBe('in_progress');
  });

  it('restarted until the next tick change, then normal rules', () => {
    const el = element({ restartedAt: '2026-10-20T10:00:00Z' });
    expect(status([goal({ due: 10 })], el)).toBe('restarted');
    expect(status([goal({ done: true, tick: '2026-10-22T08:00:00Z', due: 10 }), goal()], el)).toBe('in_progress');
  });

  it('completed at 100%, in progress between 1 and 99%', () => {
    expect(status([goal({ done: true }), goal({ done: true })])).toBe('completed');
    expect(status([goal({ done: true }), goal()])).toBe('in_progress');
  });

  it('an element with no goals is treated as started at 0%', () => {
    expect(status([])).toBe('started');
    expect(elementStartDate([])).toBeNull();
  });
});

describe('start-date rules (§4.6)', () => {
  it('the element starts on its earliest goal start date', () => {
    expect(elementStartDate([goal({ start: 10 }), goal({ start: 6 }), goal({ start: 8 })])).toBe('2026-11-01');
  });

  it('before the start date: Not Started, whatever was chosen', () => {
    const goals = [goal({ start: 6, due: 20 })];
    expect(status(goals)).toBe('not_started');
    expect(status(goals, element({ zeroProgressStatus: 'resource_delay' }))).toBe('not_started');
  });

  it('on and after the start date at 0%: Started automatically', () => {
    expect(status([goal({ start: 0, due: 20 })])).toBe('started');
    expect(status([goal({ start: -3, due: 20 })], element({ zeroProgressStatus: 'not_started' }))).toBe('started');
  });

  it('Resource Delay is kept once the start date has passed', () => {
    expect(status([goal({ start: -3, due: 20 })], element({ zeroProgressStatus: 'resource_delay' }))).toBe('resource_delay');
  });

  it('an early tick counts: In Progress before the start date', () => {
    expect(status([goal({ start: 6, due: 20, done: true }), goal({ start: 6, due: 20 })])).toBe('in_progress');
  });

  it('the 0% selector is locked before the start date and offers Started/Resource Delay after', () => {
    const future = [goal({ start: 6, due: 20 })];
    expect(zeroProgressControl(element(), future, TODAY)).toEqual({
      visible: true,
      locked: true,
      options: ['not_started'],
      startDate: '2026-11-01',
    });
    expect(zeroProgressControl(element(), [goal({ start: 0 })], TODAY)).toMatchObject({
      visible: true,
      locked: false,
      options: ['started', 'resource_delay'],
    });
    expect(zeroProgressControl(element(), [goal({ done: true }), goal()], TODAY).visible).toBe(false);
  });
});

describe('status history', () => {
  it('records a change only when the status differs', () => {
    expect(statusChange('not_started', 'started')).toEqual({ from: 'not_started', to: 'started' });
    expect(statusChange(null, 'not_started')).toEqual({ from: null, to: 'not_started' });
    expect(statusChange('started', 'started')).toBeNull();
  });
});

describe('time bands (§5)', () => {
  it('assigns bands at the right boundaries', () => {
    expect([-1, 0, 14, 15, 29, 30, 59, 60, 200].map(bandFor)).toEqual([
      'overdue',
      'immediate',
      'immediate',
      'short',
      'short',
      'medium',
      'medium',
      'long',
      'long',
    ]);
    expect(BAND_LABEL.immediate).toBe('Immediate');
  });

  it('hits the exact colours at each band edge (acceptance test 7)', () => {
    const bg = (d: number) => bandColor(d).bg;
    expect(bg(59)).toBe('#E3F0FF'); // pale blue
    expect(bg(30)).toBe('#0B4FA8'); // deep blue
    expect(bg(29)).toBe('#FFF3D6'); // pale amber
    expect(bg(15)).toBe('#B86E00'); // deep amber
    expect(bg(14)).toBe('#FFE0DC'); // pale red
    expect(bg(0)).toBe('#B3261E'); // deep red
    expect(bg(60)).toBe('#4A4A4A'); // dark grey
    expect(bg(100)).toBe('#FFFFFF'); // white
    expect(bg(365)).toBe('#FFFFFF'); // clamped
    expect(bg(-3)).toBe('#5C0B0B'); // crimson
  });

  it('darkens steadily inside a band', () => {
    const lightness = (hex: string) => contrastRatio(hex, '#000000');
    expect(lightness(bandColor(59).bg)).toBeGreaterThan(lightness(bandColor(45).bg));
    expect(lightness(bandColor(45).bg)).toBeGreaterThan(lightness(bandColor(30).bg));
  });

  it('dark mode uses a dark far edge, keeping the same deep near edge', () => {
    expect(bandColor(59, 'dark').bg).toBe('#0F1D36');
    expect(bandColor(30, 'dark').bg).toBe('#0B4FA8');
    expect(bandColor(100, 'dark').bg).toBe('#1E2430');
  });

  it('text on every band colour passes WCAG AA in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (let d = -10; d <= 120; d++) {
        const { bg, fg } = bandColor(d, theme);
        expect([TEXT_DARK, TEXT_LIGHT, TEXT_BLACK]).toContain(fg);
        expect(contrastRatio(bg, fg), `${theme} ${d} days: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('an element is banded by its nearest unfinished goal (acceptance test 8)', () => {
    const goals = [goal({ due: 3, done: true }), goal({ due: 40 }), goal({ due: 20 })];
    expect(elementDaysLeft(goals, TODAY)).toBe(20);
    expect(bandFor(elementDaysLeft(goals, TODAY)!)).toBe('short');
    expect(elementDaysLeft([goal({ done: true })], TODAY)).toBeNull();
  });
});

describe('status pills (§4.1)', () => {
  it('every pill has a label, an icon and AA-contrast text', () => {
    for (const [key, m] of Object.entries(STATUS_META)) {
      expect(m.label, key).not.toBe('');
      expect(m.icon, key).not.toBe('');
      expect(contrastRatio(m.bg, m.fg), key).toBeGreaterThanOrEqual(4.5);
    }
    expect(STATUS_META.abandoned.opacity).toBe(0.45);
    expect(statusLabel('in_progress', 50)).toBe('In Progress · 50%');
  });
});

describe('acceptance tests (§14)', () => {
  it('1. PMI 2027 with 4 goals: 25% → 100% → back to 75%', () => {
    const goals = [goal(), goal(), goal(), goal()];
    goals[0]!.isDone = true;
    expect(statusLabel(status(goals), pctOf(goals))).toBe('In Progress · 25%');
    goals.forEach((g) => (g.isDone = true));
    expect(statusLabel(status(goals), pctOf(goals))).toBe('Completed · 100%');
    goals[3]!.isDone = false;
    expect(statusLabel(status(goals), pctOf(goals))).toBe('In Progress · 75%');
  });

  it('2. two goals, one ticked → In Progress · 50%', () => {
    const goals = [goal({ done: true }), goal()];
    expect(statusLabel(status(goals), pctOf(goals))).toBe('In Progress · 50%');
  });

  it('3. a new element starting today → Started; can switch to Resource Delay and back; selector hides on a tick', () => {
    const goals = [goal({ start: 0, due: 30 })];
    expect(status(goals)).toBe('started');
    expect(status(goals, element({ zeroProgressStatus: 'resource_delay' }))).toBe('resource_delay');
    expect(status(goals, element({ zeroProgressStatus: 'started' }))).toBe('started');
    goals[0]!.isDone = true;
    expect(zeroProgressControl(element(), goals, TODAY).visible).toBe(false);
  });

  it('4. due 3 days ago → Overdue · 4 days to abandonment', () => {
    expect(describeGoal(goal({ due: -3 }), TODAY)).toMatchObject({ state: 'overdue', daysToAbandonment: 4 });
  });

  it('5. due 8 days ago → goal and element Abandoned, % does not go up', () => {
    const goals = [goal({ done: true }), goal({ due: -8 })];
    expect(goalState(goals[1]!, TODAY)).toBe('abandoned');
    expect(status(goals)).toBe('abandoned');
    expect(pctOf(goals)).toBe(50);
  });

  it('6. date reset on the abandoned goal → Restarted, then normal rules after a tick', () => {
    const goals = [goal({ done: true, tick: '2026-10-01T00:00:00Z' }), goal({ due: 10 })]; // due date moved forward
    const el = element({ restartedAt: '2026-10-26T09:00:00Z' });
    expect(status(goals, el)).toBe('restarted');
    goals[1]!.isDone = true;
    goals[1]!.tickChangedAt = '2026-10-26T12:00:00Z';
    expect(status(goals, el)).toBe('completed');
  });

  it('17. goals starting 1 November: Not Started on 26 Oct, Started on 1 Nov, In Progress if ticked early', () => {
    const goals = [goal({ start: 6, due: 20 }), goal({ start: 6, due: 25 })];
    expect(status(goals, element(), '2026-10-26')).toBe('not_started');
    expect(goals.map((g) => goalState(g, '2026-10-26'))).toEqual(['not_started', 'not_started']);
    expect(zeroProgressControl(element(), goals, '2026-10-26').locked).toBe(true);

    const onStart = status(goals, element(), '2026-11-01');
    expect(onStart).toBe('started');
    expect(statusChange('not_started', onStart)).toEqual({ from: 'not_started', to: 'started' });

    goals[0]!.isDone = true;
    expect(status(goals, element(), '2026-10-26')).toBe('in_progress');
  });
});
