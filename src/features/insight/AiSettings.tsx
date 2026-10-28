import { useId } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNotice } from '@/components/Notice';
import { useProfile } from '@/features/profile/useProfile';
import { useUpdateProfile } from '@/features/notifications/api';
import { NEEDS_CONNECTION, useOnline } from '@/lib/useOnline';
import { useRefreshAiQueries } from './api';

/** Settings → AI weekly insight (§7.2): the on/off switch and what is shared. */
export function AiSettings() {
  const id = useId();
  const profile = useProfile().data;
  const update = useUpdateProfile();
  const online = useOnline();
  const { notify } = useNotice();
  const refreshAi = useRefreshAiQueries();
  if (!profile) return null;

  return (
    <Card id="ai">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-5 text-primary" /> AI weekly insight
        </CardTitle>
        <CardDescription>
          A short coaching note on the dashboard and in the Monday email, written by Claude (Anthropic).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor={id}>Write a weekly insight</Label>
            <p id={`${id}-hint`} className="mt-1 text-secondary text-muted-foreground">
              Only your area and element names, percentages, statuses, days left and weekly counts are sent. Goal titles,
              notes and your email address are never sent.
            </p>
          </div>
          <span className="flex min-h-tap min-w-tap shrink-0 items-center justify-center">
            <Switch
              id={id}
              aria-describedby={`${id}-hint`}
              checked={profile.ai_summary_enabled}
              disabled={!online}
              title={online ? undefined : NEEDS_CONNECTION}
              onCheckedChange={(on) =>
                update.mutate(
                  { ai_summary_enabled: on },
                  { onSuccess: refreshAi, onError: (e) => notify(`Couldn’t save that setting. ${e.message}`) },
                )
              }
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
