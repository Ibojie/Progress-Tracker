import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/lib/theme/ThemeProvider';
import type { ThemePreference } from '@/lib/theme/theme';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComingSoon, PageHeader } from '@/components/PagePlaceholder';
import { cn } from '@/lib/utils';
import { Archive } from '@/features/elements/Archive';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match system', icon: Monitor },
];

export function SettingsPage() {
  const { user, signOut } = useAuth();
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

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut aria-hidden />
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card id="archive">
          <CardHeader>
            <CardTitle>Archive</CardTitle>
            <CardDescription>Switched-off elements are hidden everywhere else. Switch one on to bring it back.</CardDescription>
          </CardHeader>
          <CardContent>
            <Archive />
          </CardContent>
        </Card>

        <ComingSoon phase={5}>
          Timezone, notification channels, quiet hours, the AI summary switch and data export.
        </ComingSoon>
      </div>
    </>
  );
}
