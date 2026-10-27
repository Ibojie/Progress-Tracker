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

// Push reminders (§9). The payload comes from supabase/functions/notify (pushPayload).
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Progress Tracker', {
      body: data.body ?? '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  );
});

// Tapping a notification opens the right element: reuse an open window if there is one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data as { url?: string } | null)?.url ?? '/';
  const path = /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(raw) ? raw : '/';
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin) as WindowClient | undefined;
      if (existing) {
        await existing.focus();
        // navigate() only works on windows this worker controls; otherwise open a new one.
        const moved = await existing.navigate(target).catch(() => null);
        if (moved) return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// The app asks the waiting new version to take over when the user taps "Update".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
