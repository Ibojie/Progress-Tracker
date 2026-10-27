import { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInstall } from './install';

const DISMISS_KEY = 'pt-install-dismissed';

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function IosSteps() {
  return (
    <ol className="grid list-decimal gap-1 pl-6 text-secondary">
      <li>
        Open this page in <strong>Safari</strong>.
      </li>
      <li>
        Tap <Share aria-label="Share" className="inline size-5 align-text-bottom" /> <strong>Share</strong> at the bottom of the
        screen.
      </li>
      <li>
        Scroll down and tap <PlusSquare aria-hidden className="inline size-5 align-text-bottom" /> <strong>Add to Home Screen</strong>
        , then <strong>Add</strong>.
      </li>
    </ol>
  );
}

/**
 * One-time banner on the dashboard (§11): an Install button where the browser offers it, or the
 * Add to Home Screen steps on iPhone (needed there for push reminders in Phase 5, §9).
 */
export function InstallBanner() {
  const install = useInstall();
  const [hidden, setHidden] = useState(dismissed);

  if (hidden || install.standalone || install.justInstalled || (!install.canPrompt && !install.ios)) return null;

  function close() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage blocked: the banner just shows again next time.
    }
  }

  return (
    <section aria-labelledby="install-title" className="glass relative mb-6 rounded-lg p-4 pr-14 sm:p-5 sm:pr-14">
      <button
        type="button"
        onClick={close}
        aria-label="Hide the install suggestion"
        className="absolute right-2 top-2 inline-flex min-h-tap min-w-tap items-center justify-center rounded-md hover:bg-muted"
      >
        <X aria-hidden className="size-5" />
      </button>
      <h2 id="install-title" className="flex items-center gap-2 font-semibold">
        <Smartphone aria-hidden className="size-5 text-primary" /> Install Progress Tracker
      </h2>
      <p className="mb-3 mt-1 text-secondary text-muted-foreground">
        It opens like an app, works offline, and {install.ios ? 'is needed on iPhone for' : 'can show'} deadline reminders.
      </p>
      {install.canPrompt ? (
        <Button onClick={() => void install.prompt()}>
          <Download aria-hidden /> Install app
        </Button>
      ) : (
        <IosSteps />
      )}
    </section>
  );
}

/** Always available under Settings, even after the banner was hidden. */
export function InstallCard() {
  const install = useInstall();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Install the app</CardTitle>
        <CardDescription>
          {install.standalone || install.justInstalled
            ? 'Installed. You’re using Progress Tracker as an app.'
            : 'Add Progress Tracker to your home screen so it opens like an app and works offline.'}
        </CardDescription>
      </CardHeader>
      {!install.standalone && !install.justInstalled && (
        <CardContent>
          {install.canPrompt ? (
            <Button onClick={() => void install.prompt()}>
              <Download aria-hidden /> Install app
            </Button>
          ) : install.ios ? (
            <IosSteps />
          ) : (
            <p className="text-secondary text-muted-foreground">
              In Chrome or Edge, open the browser menu and choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>{' '}
              on Android). If it isn’t offered, the app may already be installed.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
