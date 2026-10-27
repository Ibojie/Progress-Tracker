import { QueryClient } from '@tanstack/react-query';
import { registerQueuedMutations } from '@/features/elements/offlineQueue';

/** How long data saved on the device stays usable offline. */
export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function createAppQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      // Keep cached data at least as long as it is saved on the device, or it can't be restored.
      queries: { staleTime: 30_000, gcTime: OFFLINE_MAX_AGE, retry: 1 },
    },
  });
  registerQueuedMutations(client);
  return client;
}

export const queryClient = createAppQueryClient();
