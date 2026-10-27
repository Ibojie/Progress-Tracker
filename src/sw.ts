/// <reference lib="webworker" />
// Service worker: keeps the app shell on the device so the app opens offline (§11).
// Data comes from the TanStack Query cache saved in IndexedDB, not from here; Supabase requests
// are left alone (they're cross-origin and must never be served stale).
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every page address opens the cached app shell; the app's router takes it from there.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// The app asks the waiting new version to take over when the user taps "Update".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
