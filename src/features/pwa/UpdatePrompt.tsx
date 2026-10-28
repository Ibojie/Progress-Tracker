import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useMutationState } from '@tanstack/react-query';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { isQueuedKey } from '@/features/elements/offlineQueue';

const HOUR = 60 * 60 * 1000;
/** An update found this soon after opening the app is applied straight away: nothing is in progress yet. */
const JUST_OPENED_MS = 15_000;
const openedAt = Date.now();

/**
 * Registers the service worker and, when a new version has downloaded, switches to it.
 * It switches by itself only when that's safe: no offline changes are waiting, and either the
 * app has just been opened or it's in the background. Otherwise it offers "Update now", so
 * nothing being typed is lost.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An installed app can stay open for days; look for updates every hour.
      if (registration) window.setInterval(() => void registration.update().catch(() => {}), HOUR);
    },
  });
  const waiting = useMutationState({
    filters: { status: 'pending', predicate: (m) => isQueuedKey(m.options.mutationKey) },
    select: (m) => m.mutationId,
  }).length;

  useEffect(() => {
    if (!needRefresh || waiting > 0) return;
    const apply = () => void updateServiceWorker(true);
    if (Date.now() - openedAt < JUST_OPENED_MS || document.visibilityState === 'hidden') return apply();
    const onHide = () => document.visibilityState === 'hidden' && apply();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [needRefresh, waiting, updateServiceWorker]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
      {needRefresh && (
        <div className="glass pointer-events-auto flex max-w-lg flex-wrap items-center gap-3 rounded-lg px-4 py-3 shadow-xl">
          <p className="text-secondary">A new version of Progress Tracker is ready.</p>
          <Button size="default" onClick={() => void updateServiceWorker(true)}>
            <RefreshCw aria-hidden /> Update now
          </Button>
          <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
        </div>
      )}
    </div>
  );
}
