import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/lib/theme/ThemeProvider';
import type { ThemePreference } from '@/lib/theme/theme';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PagePlaceholder';
import { cn } from '@/lib/utils';
import { Archive } from '@/features/elements/Archive';
import { useState } from 'react';
import { useMutationState } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { isQueuedKey } from '@/features/elements/offlineQueue';
import { InstallCard } from '@/features/pwa/InstallPrompt';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { AiSettings } from '@/features/insight/AiSettings';
import { ExportCard } from '@/features/export/ExportCard';
import { DeleteAccountCard } from '@/features/account/DeleteAccountCard';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match system', icon: Monitor },
];

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // Changes made offline that haven't reached the server yet; signing out would discard them.
  const waiting = useMutationState({
    filters: { status: 'pending', predicate: (m) => isQueuedKey(m.options.mutationKey) },
    select: (m) => m.mutationId,
  }).length;
  const { preference, setPreference } = useTheme();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Your choice is saved on this device and in your profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset>
              <legend className="sr-only">Theme</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const checked = preference === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        'flex min-h-tap cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-surface/60 px-4 py-3 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                        checked && 'border-primary bg-primary/10 ring-1 ring-primary',
                      )}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={value}
                        checked={checked}
                        onChange={() => setPreference(value)}
                        className="sr-only"
                      />
                      <Icon aria-hidden className="size-5" />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <NotificationSettings />

        <AiSettings />

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => (waiting > 0 ? setConfirmSignOut(true) : void signOut())}>
              <LogOut aria-hidden />
              Sign out
            </Button>
          </CardContent>
        </Card>

        <InstallCard />

        <ConfirmDialog
          open={confirmSignOut}
          onOpenChange={setConfirmSignOut}
          title="Sign out with unsynced changes?"
          confirmLabel="Sign out anyway"
          destructive
          onConfirm={() => {
            setConfirmSignOut(false);
            void signOut();
          }}
        >
          <p>
            {waiting} {waiting === 1 ? 'change' : 'changes'} made offline haven’t reached the server yet. Signing out removes your
            data from this device, so they would be lost. Reconnect and wait for them to sync first.
          </p>
        </ConfirmDialog>

        <Card id="archive">
          <CardHeader>
            <CardTitle>Archive</CardTitle>
            <CardDescription>Switched-off elements are hidden everywhere else. Switch one on to bring it back.</CardDescription>
          </CardHeader>
          <CardContent>
            <Archive />
          </CardContent>
        </Card>

        <ExportCard />

        <DeleteAccountCard />
      </div>
    </>
  );
}
