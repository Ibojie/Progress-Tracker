// Writes the weekly insight with Claude (§7.2). Server only: ANTHROPIC_API_KEY never reaches the app.
// The model comes from ANTHROPIC_MODEL (default Claude Sonnet 5.5, as the spec sets).
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { INSIGHT_SYSTEM, insightLooksRight, insightUserMessage, normaliseInsight, type InsightInput } from './insight.ts';

export type InsightResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: 'not_configured' | 'refused' | 'empty' | 'error'; detail?: string };

export function aiConfigured(): boolean {
  return !!Deno.env.get('ANTHROPIC_API_KEY')?.trim();
}

/**
 * The hourly job passes a short timeout and no retries, so one slow call can't stop that hour's
 * reminders; the next hour tries again. The Refresh button can wait longer.
 */
export async function writeInsight(
  input: InsightInput,
  opts: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<InsightResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) return { ok: false, reason: 'not_configured' };
  const model = Deno.env.get('ANTHROPIC_MODEL')?.trim() || 'claude-sonnet-5-5';
  const client = new Anthropic({ apiKey, maxRetries: opts.maxRetries ?? 1, timeout: opts.timeoutMs ?? 60_000 });

  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      // A short summary: low effort is plenty and keeps cost and wait down.
      output_config: { effort: 'low' },
      // If a safety classifier declines, Anthropic re-runs it on its recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: INSIGHT_SYSTEM,
      messages: [{ role: 'user', content: insightUserMessage(input) }],
    });

    if (response.stop_reason === 'refusal') return { ok: false, reason: 'refused' };
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const clean = normaliseInsight(text);
    if (!clean || !insightLooksRight(clean)) return { ok: false, reason: 'empty', detail: clean.slice(0, 200) };
    return { ok: true, text: clean, model: response.model };
  } catch (e) {
    if (e instanceof Anthropic.APIError) return { ok: false, reason: 'error', detail: `${e.status ?? ''} ${e.message}`.trim() };
    return { ok: false, reason: 'error', detail: (e as Error).message };
  }
}
