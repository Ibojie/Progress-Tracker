import { CloudOff, RefreshCw } from 'lucide-react';
import { useMutationState } from '@tanstack/react-query';
import { isQueuedKey } from '@/features/elements/offlineQueue';
import { useOnline } from '@/lib/useOnline';

/** "Offline · changes will sync" (§11), with how many changes are waiting. */
export function OfflineBanner() {
  const online = useOnline();
  const waiting = useMutationState({
    filters: { status: 'pending', predicate: (m) => isQueuedKey(m.options.mutationKey) },
    select: (m) => m.mutationId,
  }).length;

  if (online && waiting === 0) return null;
  const changes = `${waiting} ${waiting === 1 ? 'change' : 'changes'}`;
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        online
          ? 'flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-label font-semibold text-primary-foreground'
          : 'flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-label font-semibold text-background'
      }
    >
      {online ? <RefreshCw aria-hidden className="size-4 animate-spin" /> : <CloudOff aria-hidden className="size-4" />}
      {online
        ? `Syncing ${changes}…`
        : waiting > 0
          ? `Offline · ${changes} will sync when you’re back online`
          : 'Offline · showing your saved data; changes will sync'}
    </div>
  );
}
