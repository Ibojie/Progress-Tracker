import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

const HOUR = 60 * 60 * 1000;

/**
 * Registers the service worker and, when a new version has downloaded, offers to switch to it.
 * Never reloads on its own, so nothing being typed is lost.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An installed app can stay open for days; look for updates every hour.
      if (registration) window.setInterval(() => void registration.update(), HOUR);
    },
  });

  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
      <div className="glass flex max-w-lg flex-wrap items-center gap-3 rounded-lg px-4 py-3 shadow-xl">
        <p className="text-secondary">A new version of Progress Tracker is ready.</p>
        <Button size="default" onClick={() => void updateServiceWorker(true)}>
          <RefreshCw aria-hidden /> Update now
        </Button>
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
      </div>
    </div>
  );
}
