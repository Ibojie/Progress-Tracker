// Pure builders for the notify Edge Function: push payloads and email HTML/text.
// No imports, so the same file runs in Deno (the function) and in Vitest (tests/unit).

export interface AlertRow {
  id: string;
  user_id: string;
  goal_id: string | null;
  element_id: string | null;
  kind: string;
  channel: 'push' | 'email' | 'in_app';
  title: string | null;
  body: string | null;
  link: string | null;
  sent_on: string;
}

export interface DigestFocus {
  title: string;
  element_name: string;
  element_id: string;
  due_date: string;
  days_left: number;
}

export interface DigestData {
  week_start: string;
  week_end: string;
  goals_total: number;
  goals_done: number;
  done_last_week: number;
  done_week_before: number;
  overdue: number;
  abandoned: number;
  due_soon: number;
  focus: DigestFocus[];
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

/** Only same-app paths are allowed as notification links ("//host" would leave the app). */
export function safePath(link: string | null | undefined): string {
  return link && /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(link) ? link : '/';
}

/** Push services browsers use; the function never posts anywhere else. Mirrors is_push_endpoint (SQL). */
export function isPushEndpoint(url: string): boolean {
  return /^https:\/\/(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)\//.test(
    url,
  );
}

export function pushPayload(row: AlertRow): PushPayload {
  return {
    title: row.title ?? 'Progress Tracker',
    body: row.body ?? '',
    url: safePath(row.link),
    // One notification per goal (or element) and kind on the device: a newer one replaces the older.
    tag: `${row.kind}:${row.goal_id ?? row.element_id ?? row.id}`,
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026-11-02 → "2 Nov 2026" (dates are plain calendar days; no timezone maths). */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function dueLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'due today';
  if (daysLeft === 1) return 'due tomorrow';
  if (daysLeft > 1) return `due in ${daysLeft} days`;
  const late = -daysLeft;
  return `${late} ${late === 1 ? 'day' : 'days'} overdue`;
}

/** "▲ 3 more than the week before", "▼ 1 fewer …", or "same as …". */
export function deltaLabel(now: number, before: number): string {
  const d = now - before;
  if (d === 0) return 'same as the week before';
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} ${d > 0 ? 'more' : 'fewer'} than the week before`;
}

// Email layout: one centred column, 16px body text, high contrast, works without images.
function layout(title: string, inner: string, appUrl: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F1F5FF;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0F172A;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
<div style="background:#FFFFFF;border-radius:12px;padding:24px;border:1px solid #DBE3F4;">
<p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#1E40AF;">Progress Tracker</p>
${inner}
</div>
<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#475569;">
You get these emails because email alerts are on.
<a href="${appUrl}/settings" style="color:#1E40AF;">Change this in Settings</a>.
</p>
</div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:#1E40AF;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:12px 20px;border-radius:8px;">${escapeHtml(label)}</a>`;
}

export function alertEmail(row: AlertRow, appUrl: string): EmailMessage {
  const title = row.title ?? 'Progress Tracker reminder';
  const body = row.body ?? '';
  const href = `${appUrl}${safePath(row.link)}`;
  const inner = `<h1 style="margin:0;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
<p style="margin:12px 0 0;font-size:16px;line-height:1.6;">${escapeHtml(body)}</p>
${button(href, 'Open in Progress Tracker')}`;
  return {
    subject: title,
    html: layout(title, inner, appUrl),
    text: `${title}\n\n${body}\n\nOpen: ${href}\n\nChange email alerts in Settings: ${appUrl}/settings\n`,
  };
}

export function digestEmail(d: DigestData, appUrl: string): EmailMessage {
  const pct = d.goals_total === 0 ? 0 : Math.round((d.goals_done / d.goals_total) * 100);
  const range = `${formatDay(d.week_start)} – ${formatDay(d.week_end)}`;
  const subject = `Your week: ${d.done_last_week} ${d.done_last_week === 1 ? 'goal' : 'goals'} completed`;
  const stats: [string, string][] = [
    ['Goals completed last week', `${d.done_last_week} (${deltaLabel(d.done_last_week, d.done_week_before)})`],
    ['Overall completion', `${pct}% (${d.goals_done} of ${d.goals_total} goals)`],
    ['Due in the next 14 days', String(d.due_soon)],
    ['Overdue', String(d.overdue)],
    ['Abandoned', String(d.abandoned)],
  ];
  const rows = stats
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;font-size:16px;border-top:1px solid #E2E8F0;">${escapeHtml(k)}</td><td style="padding:8px 0;font-size:16px;font-weight:600;text-align:right;border-top:1px solid #E2E8F0;">${escapeHtml(v)}</td></tr>`,
    )
    .join('');
  const focus = d.focus.length
    ? `<h2 style="margin:24px 0 8px;font-size:18px;">Focus now</h2><ul style="margin:0;padding-left:20px;font-size:16px;line-height:1.6;">${d.focus
        .map(
          (f) =>
            `<li><a href="${appUrl}/elements/${encodeURIComponent(f.element_id)}" style="color:#1E40AF;">${escapeHtml(f.title)}</a> · ${escapeHtml(f.element_name)} · <strong>${escapeHtml(dueLabel(f.days_left))}</strong></li>`,
        )
        .join('')}</ul>`
    : `<p style="margin:24px 0 0;font-size:16px;">Nothing is overdue or due in the next 14 days. Well done.</p>`;
  const inner = `<h1 style="margin:0;font-size:22px;line-height:1.3;">Your week in review</h1>
<p style="margin:4px 0 16px;font-size:16px;color:#475569;">${escapeHtml(range)}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>
${focus}
${button(`${appUrl}/`, 'Open your dashboard')}`;
  const text = [
    `Your week in review (${range})`,
    '',
    ...stats.map(([k, v]) => `${k}: ${v}`),
    '',
    d.focus.length ? 'Focus now:' : 'Nothing is overdue or due in the next 14 days.',
    ...d.focus.map((f) => `- ${f.title} · ${f.element_name} · ${dueLabel(f.days_left)}`),
    '',
    `Open your dashboard: ${appUrl}/`,
    `Change email alerts in Settings: ${appUrl}/settings`,
  ].join('\n');
  return { subject, html: layout(subject, inner, appUrl), text };
}
