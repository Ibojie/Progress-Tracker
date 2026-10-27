// Saves the query cache (your data and any queued changes) in IndexedDB on this device, so the
// app can show your data and finish queued changes offline (§11).
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { createStore, del, get, set } from 'idb-keyval';
import type { QueryClient } from '@tanstack/react-query';

const store = createStore('progress-tracker', 'query-cache');

export const persister = createAsyncStoragePersister({
  key: 'pt-query-cache',
  throttleTime: 1000,
  storage: {
    getItem: (key) => get<string>(key, store).then((v) => v ?? null),
    setItem: (key, value: string) => set(key, value, store),
    removeItem: (key) => del(key, store),
  },
});

/** Bump when the cached data's shape changes, so old saved copies are thrown away. */
export const CACHE_BUSTER = 'pt-cache-v1';

/** Remove every saved copy of the user's data from this device (used on sign-out). */
export async function clearOfflineData(queryClient: QueryClient): Promise<void> {
  queryClient.getMutationCache().clear();
  queryClient.clear();
  await persister.removeClient();
}
