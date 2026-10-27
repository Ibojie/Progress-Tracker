import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

/** True while the device has a connection (the same signal that pauses and resumes queued changes). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export const NEEDS_CONNECTION = 'Needs a connection. Try again when you’re back online.';
