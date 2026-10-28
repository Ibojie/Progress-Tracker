// The AI weekly narrative (§7.2): the prompt, and the small fixed format the reply must follow.
// No imports, so it runs in Deno (Edge Functions), Vitest and the app (the insight card).

/** The compact summary from ai_summary_input (SQL). Names and numbers only: no notes or emails. */
export interface InsightInput {
  today: string;
  week: {
    goals_completed: number;
    goals_completed_week_before: number;
    overall_pct: number;
    overdue_goals: number;
    abandoned_goals: number;
  };
  categories: { name: string; pct: number; elements: number }[];
  elements: {
    name: string;
    category: string;
    pct: number;
    status: string;
    days_left: number | null;
    band: string | null;
    pace: string;
  }[];
}

export const INSIGHT_SYSTEM = `You are a direct, encouraging performance coach inside Progress Tracker, an app where one person tracks goals and deadlines in four areas: Paid Job, Business, Investment and Personal Development.

You receive a JSON summary of their progress. Each element is a project they track: its % complete, status, urgency band (overdue, immediate = 0-14 days, short = 15-29, medium = 30-59, long = 60+), days until its next unfinished goal is due, and whether it is behind pace. "week" compares the last 7 days with the 7 before.

Write their weekly insight in plain, warm, specific language. Name elements and areas from the data; never invent facts, numbers or deadlines that aren't in it. If there is little data, say so briefly and suggest one first step.

Reply in exactly this format and nothing else (no other headings, no bold elsewhere, no tables), at most 180 words in total:

**Do this week**
- (first action)
- (second action)
- (third action)

**Watch**
(one risk to keep an eye on, in one or two sentences)

**Celebrate**
(one thing that went well, in one or two sentences)`;

export function insightUserMessage(input: InsightInput): string {
  return `Here is this week's summary as JSON:\n\n${JSON.stringify(input)}`;
}

export type InsightBlock = { type: 'heading'; text: string } | { type: 'item'; text: string } | { type: 'para'; text: string };

/** Strips markup the format doesn't allow, so stored text is always safe and plain. */
function clean(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reads the reply into headings, list items and paragraphs. Anything unexpected becomes plain text. */
export function parseInsight(md: string): InsightBlock[] {
  const blocks: InsightBlock[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^(?:#{1,6}\s*)?\*\*(.+?)\*\*:?$/.exec(line) ?? /^#{1,6}\s+(.+)$/.exec(line);
    const item = /^(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line);
    if (heading) blocks.push({ type: 'heading', text: clean(heading[1]!) });
    else if (item) blocks.push({ type: 'item', text: clean(item[1]!) });
    else blocks.push({ type: 'para', text: clean(line) });
  }
  return blocks.filter((b) => b.text.length > 0);
}

/** Words in an insight, as a reader would count them. */
export function insightWords(md: string): number {
  return parseInsight(md).reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);
}

/**
 * Whether a reply follows the format closely enough to show: some actions, a heading or two, and
 * near the 180-word limit (a little slack, since headings count). Otherwise it's discarded.
 */
export function insightLooksRight(md: string): boolean {
  const blocks = parseInsight(md);
  const items = blocks.filter((b) => b.type === 'item').length;
  const headings = blocks.filter((b) => b.type === 'heading').length;
  return items >= 1 && items <= 6 && headings >= 2 && insightWords(md) <= 220;
}

/** The stored form: the same simple format, rebuilt from the parsed blocks (so it's always clean). */
export function normaliseInsight(md: string): string {
  return parseInsight(md)
    .map((b) => (b.type === 'heading' ? `\n**${b.text}**` : b.type === 'item' ? `- ${b.text}` : b.text))
    .join('\n')
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Email HTML for the Monday digest (inline styles, 16px text). */
export function insightHtml(md: string): string {
  let html = '';
  let inList = false;
  for (const b of parseInsight(md)) {
    if (b.type !== 'item' && inList) {
      html += '</ul>';
      inList = false;
    }
    if (b.type === 'heading') html += `<p style="margin:16px 0 4px;font-size:16px;font-weight:700;">${escapeHtml(b.text)}</p>`;
    else if (b.type === 'para') html += `<p style="margin:0 0 8px;font-size:16px;line-height:1.6;">${escapeHtml(b.text)}</p>`;
    else {
      if (!inList) {
        html += '<ul style="margin:0 0 8px;padding-left:20px;font-size:16px;line-height:1.6;">';
        inList = true;
      }
      html += `<li>${escapeHtml(b.text)}</li>`;
    }
  }
  return inList ? `${html}</ul>` : html;
}

/** Plain-text version for the email's text part. */
export function insightText(md: string): string {
  return parseInsight(md)
    .map((b) => (b.type === 'heading' ? `\n${b.text}` : b.type === 'item' ? `- ${b.text}` : b.text))
    .join('\n')
    .trim();
}

/** YYYY-MM-DD in a timezone (en-CA formats dates that way). */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
