// ai-summary Edge Function (§7.2), for a signed-in user:
//  - {"probe": true}: is the AI set up, and how many refreshes are left today? The app shows the
//    insight card only when the answer is yes (acceptance test 14: no key, no card).
//  - {}: the "Refresh insight" button. Writes a new insight; at most 5 attempts a day.
// The Monday run is done by the notify function.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { aiConfigured, writeInsight } from '../_shared/claude.ts';
import { addDaysIso, todayInZone, type InsightInput } from '../_shared/insight.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return json(401, { error: 'Sign in again, then retry.' });
  const body = (await req.json().catch(() => ({}))) as { probe?: boolean };

  if (body.probe) {
    if (!aiConfigured()) return json(200, { configured: false, left: 0 });
    const left = await db.rpc('ai_manual_left', { p_user: user.id });
    return json(200, { configured: true, left: left.error ? 0 : (left.data as number) });
  }

  // "unavailable" tells the app to hide the card quietly.
  if (!aiConfigured()) return json(503, { error: 'unavailable' });

  const { data: profile } = await db.from('profiles').select('timezone, ai_summary_enabled').eq('id', user.id).single();
  if (!profile?.ai_summary_enabled) return json(400, { error: 'The AI summary is switched off in Settings.' });

  const today = todayInZone(profile.timezone);
  const input = await db.rpc('ai_summary_input', { p_user: user.id, p_today: today });
  if (input.error) return json(500, { error: input.error.message });
  const data = input.data as InsightInput | null;
  if (!data || data.elements.length === 0) return json(400, { error: 'Add an element first, then ask for an insight.' });

  // Take one of today's attempts before calling Claude. It's locked per user, so parallel taps
  // can't all get through, and failed attempts count too.
  const claim = await db.rpc('ai_claim', { p_user: user.id, p_trigger: 'manual' });
  if (claim.error) return json(500, { error: claim.error.message });
  const left = claim.data as number;
  if (left < 0) return json(429, { error: 'You’ve used today’s 5 refreshes. Try again tomorrow.', left: 0 });

  const result = await writeInsight(data);
  if (!result.ok) {
    if (result.reason === 'not_configured') return json(503, { error: 'unavailable' });
    console.error('ai-summary failed', result.reason, result.detail);
    return json(502, {
      error: 'The AI couldn’t write an insight just now. Your rule-based advice is unchanged; try again later.',
      left,
    });
  }

  const saved = await db
    .from('ai_summaries')
    .insert({
      user_id: user.id,
      period_start: addDaysIso(today, -7),
      period_end: today,
      content_md: result.text,
      model: result.model,
      trigger: 'manual',
    })
    .select('*')
    .single();
  if (saved.error) return json(500, { error: saved.error.message, left });
  return json(200, { summary: saved.data, left });
});
