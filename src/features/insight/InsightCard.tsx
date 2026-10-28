import { RefreshCw, Sparkles } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotice } from '@/components/Notice';
import { useProfile, useTimezone } from '@/features/profile/useProfile';
import { NEEDS_CONNECTION, useOnline } from '@/lib/useOnline';
import { ShowMore } from '@/components/ShowMore';
import { parseInsight } from '../../../supabase/functions/_shared/insight';
import { useAiStatus, useLatestInsight, useRefreshInsight } from './api';

/** The insight's simple format (headings, a list, short paragraphs) as plain React, never raw HTML. */
function InsightBody({ md }: { md: string }) {
  const blocks = parseInsight(md);
  const out: React.ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length)
      out.push(
        <ul key={`l${out.length}`} className="mb-3 list-disc space-y-1 pl-6">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>,
      );
    items = [];
  };
  for (const b of blocks) {
    if (b.type === 'item') {
      items.push(b.text);
      continue;
    }
    flush();
    out.push(
      b.type === 'heading' ? (
        <h3 key={out.length} className="mb-1 mt-3 font-semibold first:mt-0">
          {b.text}
        </h3>
      ) : (
        <p key={out.length} className="mb-3">
          {b.text}
        </p>
      ),
    );
  }
  flush();
  return <div className="text-body">{out}</div>;
}

/**
 * The AI weekly insight (§7.2), above the rule-based advice. Hidden when switched off in Settings
 * or when the server has no AI key; the rule-based advice is always shown regardless.
 */
export function InsightCard() {
  const profile = useProfile().data;
  const timeZone = useTimezone();
  const status = useAiStatus();
  const insight = useLatestInsight();
  const refresh = useRefreshInsight();
  const online = useOnline();
  const { notify } = useNotice();

  // Shown only once the server has confirmed the AI is set up (no key → no card, test 14).
  if (!profile?.ai_summary_enabled || !status.data?.configured || insight.isLoading) return null;
  const latest = insight.data;
  const left = status.data.left;

  function onRefresh() {
    refresh.mutate(undefined, { onError: (e) => notify(e.message) });
  }

  return (
    <Card className="mb-6" aria-busy={refresh.isPending}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-6 text-primary" /> Your weekly insight
        </CardTitle>
        <p className="text-label text-muted-foreground">
          {latest
            ? `Written by AI on ${formatInTimeZone(new Date(latest.created_at), timeZone, 'EEE d MMM, HH:mm')} from your progress figures.`
            : 'A short coaching note from AI, written from your progress figures. A new one arrives every Monday.'}
        </p>
      </CardHeader>
      <CardContent>
        {latest ? (
          <ShowMore storageKey="pt-insight-open" collapsedRem={12} className="mb-3">
            <InsightBody md={latest.content_md} />
          </ShowMore>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={latest ? 'outline' : 'default'}
            disabled={refresh.isPending || left === 0 || !online}
            title={online ? undefined : NEEDS_CONNECTION}
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden className={refresh.isPending ? 'animate-spin motion-reduce:animate-none' : undefined} />
            {refresh.isPending ? 'Writing…' : latest ? 'Refresh insight' : 'Get my first insight'}
          </Button>
          <span className="text-label text-muted-foreground" role="status">
            {left === 0 ? 'No refreshes left today.' : `${left} ${left === 1 ? 'refresh' : 'refreshes'} left today.`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
