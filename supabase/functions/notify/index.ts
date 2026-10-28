// notify Edge Function (§9). Two ways in:
//  - {"mode":"cron"} with the x-cron-token header: the hourly job. Queues the alerts that are
//    due (queue_notifications) and delivers every waiting push and email.
//  - {"mode":"test"} with a signed-in user's token: sends a test push to that user's devices.
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY, VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are built in.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { sendWebPush, type VapidKeys } from './webpush.ts';
import { aiConfigured, writeInsight } from '../_shared/claude.ts';
import { addDaysIso, type InsightInput } from '../_shared/insight.ts';
import { alertEmail, digestEmail, isPushEndpoint, pushPayload, type AlertRow, type DigestData } from './messages.ts';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://progress.thebusinessapostle.net';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Progress Tracker <reminders@notify.thebusinessapostle.net>';
const EMAIL_REPLY_TO = Deno.env.get('EMAIL_REPLY_TO') ?? 'ibojie@gmail.com';
// Stop taking new work well before the Edge Function's time limit; the rest goes next hour.
const TIME_BUDGET_MS = 100_000;
// Resend allows a few requests a second; space emails out so a busy Monday isn't rejected.
const EMAIL_GAP_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function vapidKeys(): VapidKeys | null {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.trim();
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: Deno.env.get('VAPID_SUBJECT')?.trim() || 'mailto:ibojie@gmail.com' };
}

interface Subscription {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Sends to every device of a user. Devices that have gone away (404/410) are removed. */
async function pushToUser(db: SupabaseClient, vapid: VapidKeys, userId: string, payload: object): Promise<{ sent: number; error?: string }> {
  const { data: subs, error } = await db.from('push_subscriptions').select('id, endpoint, keys').eq('user_id', userId);
  if (error) return { sent: 0, error: error.message };
  let sent = 0;
  let lastError: string | undefined;
  for (const s of (subs ?? []) as Subscription[]) {
    if (!isPushEndpoint(s.endpoint)) {
      await db.from('push_subscriptions').delete().eq('id', s.id);
      continue;
    }
    try {
      // High urgency: Android otherwise holds normal-priority pushes while the phone is idle.
      const res = await sendWebPush(s, JSON.stringify(payload), vapid, { ttl: 60 * 60 * 12, urgency: 'high' });
      if (res.status >= 200 && res.status < 300) sent++;
      else if (res.status === 404 || res.status === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      else lastError = `push ${res.status} ${res.body}`.trim();
    } catch (e) {
      lastError = `push ${(e as Error).message}`;
    }
  }
  return { sent, error: sent === 0 ? (lastError ?? 'no devices') : undefined };
}

/** The alert's id is the idempotency key, so a retry after a crash never sends it twice. */
async function sendEmail(to: string, msg: { subject: string; html: string; text: string }, key: string): Promise<string | null> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return 'RESEND_API_KEY is not set';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `notify-${key}` },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], reply_to: EMAIL_REPLY_TO, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  return res.ok ? null : `email ${res.status} ${(await res.text()).slice(0, 300)}`;
}

/** Writes the Monday insight for each user who is due one. A failure is retried next hour. */
async function writeWeeklyInsights(
  db: SupabaseClient,
  started: number,
): Promise<{ written: number; failed: number; pending: Set<string> }> {
  // Users still waiting for this Monday's insight: their digest waits for it (a run or two).
  const pending = new Set<string>();
  if (!aiConfigured()) return { written: 0, failed: 0, pending };
  const due = await db.rpc('ai_weekly_due');
  if (due.error) {
    console.error('ai_weekly_due', due.error.message);
    return { written: 0, failed: 0, pending };
  }
  let written = 0;
  let failed = 0;
  for (const { user_id, today } of (due.data ?? []) as { user_id: string; today: string }[]) {
    pending.add(user_id);
    // Leave most of the run for deliveries; the rest are picked up next hour.
    if (Date.now() - started > TIME_BUDGET_MS / 2) continue;
    const input = await db.rpc('ai_summary_input', { p_user: user_id, p_today: today });
    if (input.error || !input.data) {
      failed++;
      continue;
    }
    // Counts the try (3 per Monday at most), so a call that keeps failing isn't paid for all day.
    const claim = await db.rpc('ai_claim', { p_user: user_id, p_trigger: 'weekly' });
    if (claim.error || (claim.data as number) < 0) continue;
    const result = await writeInsight(input.data as InsightInput, { timeoutMs: 25_000, maxRetries: 0 });
    if (!result.ok) {
      console.error('weekly insight failed', result.reason, result.detail);
      failed++;
      continue;
    }
    const saved = await db.from('ai_summaries').insert({
      user_id,
      period_start: addDaysIso(today, -7),
      period_end: today,
      content_md: result.text,
      model: result.model,
      trigger: 'weekly',
    });
    if (saved.error) failed++;
    else {
      written++;
      pending.delete(user_id);
    }
  }
  return { written, failed, pending };
}

/** A Monday digest waits up to two hourly runs for its insight, then goes without it. */
const DIGEST_WAITS_FOR_INSIGHT = 2;

async function runCron(db: SupabaseClient): Promise<Response> {
  const started = Date.now();
  const queued = await db.rpc('queue_notifications');
  if (queued.error) return json(500, { error: queued.error.message });

  // Monday AI insights (§7.2), written before the digests below so the emails can include them.
  const insights = await writeWeeklyInsights(db, started);

  const vapid = vapidKeys();
  const emails = new Map<string, string | null>();
  const emailOf = async (userId: string) => {
    if (!emails.has(userId)) {
      const { data, error } = await db.auth.admin.getUserById(userId);
      if (error) throw new Error(`user lookup: ${error.message}`);
      emails.set(userId, data.user?.email ?? null);
    }
    return emails.get(userId) ?? null;
  };

  const claimed = await db.rpc('claim_deliveries', { p_limit: 100 });
  if (claimed.error) return json(500, { error: claimed.error.message });

  let delivered = 0;
  let failed = 0;
  let left = 0;
  for (const row of (claimed.data ?? []) as AlertRow[]) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      // Out of time: hand it back unsent (the claim lapses) so the next run picks it up.
      await db.rpc('finish_delivery', { p_id: row.id, p_ok: false, p_error: 'deferred: out of time' });
      left++;
      continue;
    }
    if (row.kind === 'weekly_digest' && insights.pending.has(row.user_id) && row.attempts <= DIGEST_WAITS_FOR_INSIGHT) {
      await db.rpc('finish_delivery', { p_id: row.id, p_ok: false, p_error: 'waiting for the weekly insight' });
      left++;
      continue;
    }
    let error: string | null = null;
    try {
      if (row.channel === 'push') {
        error = vapid ? ((await pushToUser(db, vapid, row.user_id, pushPayload(row))).error ?? null) : 'VAPID keys are not set';
      } else {
        const to = await emailOf(row.user_id);
        if (!to) error = 'no email address';
        else if (row.kind === 'weekly_digest') {
          const d = await db.rpc('weekly_digest_data', { p_user: row.user_id, p_today: row.sent_on });
          const ai = await db.rpc('ai_weekly_for', { p_user: row.user_id, p_today: row.sent_on });
          error = d.error
            ? d.error.message
            : await sendEmail(to, digestEmail(d.data as DigestData, APP_URL, (ai.data as string | null) ?? null), row.id);
        } else {
          error = await sendEmail(to, alertEmail(row, APP_URL), row.id);
        }
        await sleep(EMAIL_GAP_MS);
      }
    } catch (e) {
      error = (e as Error).message;
    }
    await db.rpc('finish_delivery', { p_id: row.id, p_ok: !error, p_error: error });
    if (error) failed++;
    else delivered++;
  }
  return json(200, {
    queued: queued.data,
    delivered,
    failed,
    deferred: left,
    insights: { written: insights.written, failed: insights.failed, waiting: insights.pending.size },
  });
}

async function runTest(db: SupabaseClient, req: Request): Promise<Response> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const { data, error } = token ? await db.auth.getUser(token) : { data: { user: null }, error: null };
  if (error || !data.user) return json(401, { error: 'Sign in again, then retry.' });
  const vapid = vapidKeys();
  if (!vapid) return json(500, { error: 'Push isn’t set up on the server yet.' });
  // The test also appears in the bell, like a real alert: one unread entry, refreshed each time.
  await db.from('notification_log').delete().eq('user_id', data.user.id).eq('kind', 'test');
  await db.from('notification_log').insert({
    user_id: data.user.id,
    kind: 'test',
    channel: 'in_app',
    title: 'Test notification',
    body: 'Push notifications are working on this device.',
    link: '/settings',
    delivered_at: new Date().toISOString(),
  });
  const result = await pushToUser(db, vapid, data.user.id, {
    title: 'Test notification',
    body: 'Push notifications are working on this device.',
    url: '/settings',
    tag: 'test',
  });
  if (result.sent === 0) {
    return json(400, {
      error:
        result.error === 'no devices'
          ? 'No device is subscribed. Turn on push notifications first.'
          : `The push service refused it (${result.error}). Turn push off and on again, then retry.`,
    });
  }
  return json(200, { sent: result.sent });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const db = admin();
  const body = (await req.json().catch(() => ({}))) as { mode?: string };

  if (body.mode === 'cron') {
    const ok = await db.rpc('notify_token_ok', { p_token: req.headers.get('x-cron-token') });
    if (ok.error || ok.data !== true) return json(401, { error: 'unauthorised' });
    return runCron(db);
  }
  if (body.mode === 'test') return runTest(db, req);
  return json(400, { error: 'unknown mode' });
});
