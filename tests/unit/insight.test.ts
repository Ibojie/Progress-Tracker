import { describe, expect, it } from 'vitest';
import {
  INSIGHT_SYSTEM,
  addDaysIso,
  insightHtml,
  insightLooksRight,
  insightText,
  insightUserMessage,
  normaliseInsight,
  parseInsight,
  todayInZone,
  type InsightInput,
} from '../../supabase/functions/_shared/insight';
import { digestEmail, type DigestData } from '../../supabase/functions/notify/messages';
import { csvCell, goalsCsv } from '@/features/export/exportData';

const REPLY = `**Do this week**
- Book the PMI mock exam before Friday.
- Tick off one NEBOSH unit.
- Review the Investment plan for 20 minutes.

**Watch**
Investment is behind pace with 2 goals overdue.

**Celebrate**
Business is at 71%, up from last week.`;

describe('the insight format', () => {
  it('reads headings, actions and sentences', () => {
    expect(parseInsight(REPLY).map((b) => b.type)).toEqual(['heading', 'item', 'item', 'item', 'heading', 'para', 'heading', 'para']);
    expect(parseInsight(REPLY)[1]).toEqual({ type: 'item', text: 'Book the PMI mock exam before Friday.' });
  });

  it('tidies replies that drift from the format, and strips markup and links', () => {
    const messy = '## Do this week\n1. **Book** the [exam](https://x.example)\n* Second <script>alert(1)</script>\n\n`Watch`';
    expect(parseInsight(messy)).toEqual([
      { type: 'heading', text: 'Do this week' },
      { type: 'item', text: 'Book the exam' },
      { type: 'item', text: 'Second alert(1)' },
      { type: 'para', text: 'Watch' },
    ]);
    expect(normaliseInsight(messy)).toBe('**Do this week**\n- Book the exam\n- Second alert(1)\nWatch');
    expect(normaliseInsight(REPLY)).toBe(REPLY);
  });

  it('accepts the coach format, and rejects replies that ignore it or run long', () => {
    expect(insightLooksRight(REPLY)).toBe(true);
    expect(insightLooksRight('Just a paragraph with no actions.')).toBe(false);
    expect(insightLooksRight(`**Do this week**
- ${'word '.repeat(230)}
**Watch**
x`)).toBe(false);
  });

  it('renders for email safely, as HTML and as plain text', () => {
    const html = insightHtml('**Watch**\n- Fees & "tax" <b>now</b>');
    expect(html).toContain('<li>Fees &amp; &quot;tax&quot; now</li>');
    expect(html).not.toContain('<b>');
    expect(insightText(REPLY)).toContain('Do this week\n- Book the PMI mock exam');
  });

  it('the prompt asks for the coach format and sends only the summary', () => {
    expect(INSIGHT_SYSTEM).toMatch(/3 things|first action/);
    expect(INSIGHT_SYSTEM).toContain('180 words');
    const input: InsightInput = {
      today: '2026-11-02',
      week: { goals_completed: 2, goals_completed_week_before: 1, overall_pct: 40, overdue_goals: 0, abandoned_goals: 0 },
      categories: [],
      elements: [],
    };
    expect(insightUserMessage(input)).toContain('"goals_completed":2');
  });

  it('works out dates in the user’s timezone', () => {
    expect(todayInZone('Africa/Lagos', new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
    expect(todayInZone('America/New_York', new Date('2026-11-02T03:00:00Z'))).toBe('2026-11-01');
    expect(addDaysIso('2026-11-02', -7)).toBe('2026-10-26');
  });
});

describe('the Monday digest with an insight', () => {
  const digest: DigestData = {
    week_start: '2026-10-26',
    week_end: '2026-11-01',
    goals_total: 4,
    goals_done: 2,
    done_last_week: 1,
    done_week_before: 1,
    overdue: 0,
    abandoned: 0,
    due_soon: 1,
    focus: [],
  };

  it('adds the coach’s take when there is one, and leaves it out when not', () => {
    const withAi = digestEmail(digest, 'https://app.example', REPLY);
    expect(withAi.html).toContain('Your coach’s take');
    expect(withAi.html).toContain('<li>Book the PMI mock exam before Friday.</li>');
    expect(withAi.text).toContain('Your coach’s take:\nDo this week');
    expect(digestEmail(digest, 'https://app.example').html).not.toContain('coach');
  });
});

describe('data export', () => {
  it('writes safe CSV cells', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`); // spreadsheets won't run it
  });

  it('lists goals by area and element, with a header Excel reads as UTF-8', () => {
    const csv = goalsCsv({
      categories: [{ id: 'c1', name: 'Paid Job' }],
      elements: [{ id: 'e1', name: 'PMI 2027', category_id: 'c1', is_decommissioned: false }],
      goals: [
        { element_id: 'e1', title: 'Mock exam', notes: null, start_date: '2026-10-01', due_date: '2026-11-01', original_due_date: '2026-11-01', is_done: true, done_at: '2026-10-30T09:00:00Z', reset_count: 0, sort_order: 1 },
        { element_id: 'e1', title: 'Apply', notes: 'Fees: ₦50,000', start_date: '2026-09-01', due_date: '2026-09-30', original_due_date: '2026-09-20', is_done: false, done_at: null, reset_count: 1, sort_order: 0 },
      ],
    });
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('Area,Element,Element switched off,Goal,Notes,Start date,Due date,Original due date,Done,Done at,Date resets');
    expect(lines[1]).toBe('Paid Job,PMI 2027,no,Apply,"Fees: ₦50,000",2026-09-01,2026-09-30,2026-09-20,no,,1');
    expect(lines[2]).toBe('Paid Job,PMI 2027,no,Mock exam,,2026-10-01,2026-11-01,2026-11-01,yes,2026-10-30T09:00:00Z,0');
  });
});
