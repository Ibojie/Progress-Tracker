import { useEffect, useId, useState } from 'react';
import { BellRing, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { selectClass } from '@/components/ui/select-class';
import { useNotice } from '@/components/Notice';
import { useProfile } from '@/features/profile/useProfile';
import { useInstall } from '@/features/pwa/install';
import { NEEDS_CONNECTION, useOnline } from '@/lib/useOnline';
import { DEFAULT_TIMEZONE } from '@/lib/engine';
import { toTimeInput, usePushDevices, useUpdateProfile } from './api';
import { deviceSubscription, disablePush, enablePush, permission, pushSupported, sendTestPush } from './push';

function timezones(): string[] {
  const all = (Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
  return all?.length ? all : [DEFAULT_TIMEZONE];
}

function Row({ id, title, hint, children }: { id: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/60 py-4 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <Label htmlFor={id}>{title}</Label>
        <p id={`${id}-hint`} className="mt-1 text-secondary text-muted-foreground">
          {hint}
        </p>
      </div>
      {/* The switch itself is small: give it a full 44px tap area. */}
      <span className="flex min-h-tap min-w-tap shrink-0 items-center justify-center">{children}</span>
    </div>
  );
}

/** Settings → Notifications (§9): channels, quiet hours, timezone and a test push. */
export function NotificationSettings() {
  const ids = { push: useId(), email: useId(), inApp: useId(), quiet: useId(), from: useId(), to: useId(), tz: useId() };
  const profile = useProfile().data;
  const update = useUpdateProfile();
  const devices = usePushDevices();
  const install = useInstall();
  const online = useOnline();
  const { notify } = useNotice();
  const [thisDevice, setThisDevice] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void deviceSubscription().then((s) => live && setThisDevice(!!s && permission() === 'granted'));
    return () => {
      live = false;
    };
  }, []);

  if (!profile) return null;

  const needsInstall = install.ios && !install.standalone;
  const pushBlocked = !pushSupported() || needsInstall;
  const quietOn = !!profile.quiet_hours_start && !!profile.quiet_hours_end;
  const save = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, { onError: (e) => notify(`Couldn’t save that setting. ${e.message}`) });

  // Saved as soon as a full time is picked. From and Until can't be the same (that means "off").
  function saveQuiet(which: 'quiet_hours_start' | 'quiet_hours_end', value: string) {
    if (!value) return;
    const other = toTimeInput(which === 'quiet_hours_start' ? profile!.quiet_hours_end : profile!.quiet_hours_start);
    if (value === other) return notify('Quiet hours need different From and Until times.');
    save({ [which]: value });
  }

  async function togglePush(on: boolean) {
    setBusy(true);
    try {
      if (on) {
        const error = await enablePush();
        if (error) return notify(error);
        setThisDevice(true);
        save({ push_enabled: true });
      } else {
        await disablePush();
        setThisDevice(false);
        const others = (await devices.refetch()).data?.length ?? 0;
        if (others === 0) save({ push_enabled: false });
      }
      await devices.refetch();
    } catch (e) {
      notify(`Couldn’t change push notifications. ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const error = await sendTestPush();
    setBusy(false);
    notify(error ?? 'Test notification sent. It should appear in a few seconds.');
  }

  const otherDevices = (devices.data?.length ?? 0) - (thisDevice ? 1 : 0);

  return (
    <Card id="notifications">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing aria-hidden className="size-5 text-primary" /> Notifications
        </CardTitle>
        <CardDescription>
          Reminders go out at 07:00 your time: 21, 14, 7, 3 and 1 days before a deadline, on the day, and every day a goal is
          overdue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Row
          id={ids.push}
          title="Push notifications on this device"
          hint={
            needsInstall
              ? 'On iPhone, add the app to your Home Screen first (Share → Add to Home Screen), then open it from there.'
              : !pushSupported()
                ? 'This browser can’t show notifications. Install the app, or use Chrome, Edge, Firefox or Safari.'
                : otherDevices > 0
                  ? `Also on for ${otherDevices} other ${otherDevices === 1 ? 'device' : 'devices'}.`
                  : 'Alerts on your lock screen, even when the app is closed.'
          }
        >
          <Switch
            id={ids.push}
            aria-describedby={`${ids.push}-hint`}
            checked={!!thisDevice}
            disabled={busy || pushBlocked || thisDevice === null || !online}
            title={online ? undefined : NEEDS_CONNECTION}
            onCheckedChange={(on) => void togglePush(on)}
          />
        </Row>
        {thisDevice && (
          <div className="-mt-2 pb-4">
            <Button variant="outline" disabled={busy || !online} onClick={() => void test()}>
              <Send aria-hidden /> Send test push
            </Button>
          </div>
        )}

        <Row id={ids.email} title="Email" hint="Due today, overdue (day 1 and day 6), abandoned, and a Monday digest of your week.">
          <Switch
            id={ids.email}
            aria-describedby={`${ids.email}-hint`}
            checked={profile.email_digest_enabled}
            disabled={!online}
            onCheckedChange={(on) => save({ email_digest_enabled: on })}
          />
        </Row>

        <Row id={ids.inApp} title="In-app" hint="Alerts in the bell at the top of the screen, with a count on the app icon.">
          <Switch
            id={ids.inApp}
            aria-describedby={`${ids.inApp}-hint`}
            checked={profile.in_app_enabled}
            disabled={!online}
            onCheckedChange={(on) => save({ in_app_enabled: on })}
          />
        </Row>

        <Row id={ids.quiet} title="Quiet hours" hint="If they cover 07:00, reminders wait until quiet hours end.">
          <Switch
            id={ids.quiet}
            aria-describedby={`${ids.quiet}-hint`}
            checked={quietOn}
            disabled={!online}
            onCheckedChange={(on) =>
              save(on ? { quiet_hours_start: '22:00', quiet_hours_end: '07:00' } : { quiet_hours_start: null, quiet_hours_end: null })
            }
          />
        </Row>
        {quietOn && (
          <div className="grid gap-4 pb-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={ids.from}>From</Label>
              <Input
                id={ids.from}
                type="time"
                defaultValue={toTimeInput(profile.quiet_hours_start)}
                disabled={!online}
                onChange={(e) => saveQuiet('quiet_hours_start', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={ids.to}>Until</Label>
              <Input
                id={ids.to}
                type="time"
                defaultValue={toTimeInput(profile.quiet_hours_end)}
                disabled={!online}
                onChange={(e) => saveQuiet('quiet_hours_end', e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid gap-1.5 border-t border-border/60 pt-4">
          <Label htmlFor={ids.tz}>Your timezone</Label>
          <select
            id={ids.tz}
            className={selectClass}
            value={profile.timezone}
            disabled={!online}
            onChange={(e) => save({ timezone: e.target.value })}
          >
            {timezones().map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <p className="text-secondary text-muted-foreground">Days, deadlines and the 07:00 reminder use this timezone.</p>
        </div>
      </CardContent>
    </Card>
  );
}
