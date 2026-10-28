import { supabase } from '@/lib/supabase';

// The public half of the VAPID key pair (safe to ship; the private half is a Supabase secret).
const DEFAULT_VAPID_PUBLIC_KEY = 'BOUQjnf64BTXXNm8N-Jg7k0mWowkWafzNsgxe679-OuIYdu2hjQBMMzlu1v2cR6W_SkrAiih0mzFFPmyhZbkcFQ';
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;

/** Base64url (VAPID key format) → bytes for pushManager.subscribe. */
export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function permission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported';
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  // The service worker isn't registered in development (vite-plugin-pwa devOptions off).
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function deviceSubscription(): Promise<PushSubscription | null> {
  return (await (await registration())?.pushManager.getSubscription()) ?? null;
}

/** Short label so Settings can name the device ("Android · Chrome"). */
export function deviceLabel(ua: string = navigator.userAgent): string {
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iPhone/iPad'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'browser';
  return `${os} · ${browser}`;
}

const PUSH_SERVICE_HINT =
  'Wait a moment and try again. If it keeps failing, check this browser can reach its push service (in Brave: Settings → Privacy → turn on “Use Google services for push messaging”).';

/**
 * Desktop Chrome sometimes fails the first subscribe ("Error retrieving push subscription")
 * while its connection to the push service starts up; a short wait and a second try usually works.
 */
async function subscribeWithRetry(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const options = { userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) };
  try {
    return await reg.pushManager.subscribe(options);
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
    return reg.pushManager.subscribe(options);
  }
}

/**
 * Asks permission (must run from a tap), subscribes this device and saves it. Returns an
 * error message for the user, or null on success.
 */
export async function enablePush(): Promise<string | null> {
  if (!supabase) return 'The app isn’t connected to its server.';
  if (!pushSupported()) return 'Notifications aren’t available here. Install the app, or use Chrome, Edge, Firefox or Safari.';
  // Ask first, straight from the tap: iPhone only shows the prompt during a user gesture.
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    return result === 'denied'
      ? 'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.'
      : 'Notifications weren’t allowed.';
  }
  const reg = await registration();
  if (!reg) return 'Notifications aren’t available here. Install the app, or use Chrome, Edge, Firefox or Safari.';
  let sub: PushSubscription;
  try {
    sub = (await reg.pushManager.getSubscription()) ?? (await subscribeWithRetry(reg));
  } catch (e) {
    return `${(e as Error).message || 'The browser couldn’t reach its push service.'} ${PUSH_SERVICE_HINT}`;
  }
  const json = sub.toJSON();
  // Saved through a server function: it checks the push service and, if someone else used this
  // device before, moves the device to the current user.
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_label: deviceLabel(),
  });
  if (error) return error.message;
  return null;
}

/**
 * Turns push off on this device only, without the server (the session may already be gone).
 * The server forgets the device the next time a push to it is rejected.
 */
export async function forgetDevicePush(): Promise<void> {
  await (await deviceSubscription())?.unsubscribe();
}

/** Unsubscribes this device and forgets it on the server. Safe to call when not subscribed. */
export async function disablePush(): Promise<void> {
  const sub = await deviceSubscription();
  if (!sub) return;
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Waits up to `ms` for the service worker to say a push arrived on this device.
 * Resolves with what it reported, or null if nothing arrived.
 */
export function waitForPush(ms = 20_000): Promise<{ shown: boolean; error?: string } | null> {
  if (!pushSupported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'PUSH_RECEIVED') return;
      done({ shown: !!e.data.shown, error: e.data.error });
    };
    const timer = window.setTimeout(() => done(null), ms);
    function done(result: { shown: boolean; error?: string } | null) {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve(result);
    }
    navigator.serviceWorker.addEventListener('message', onMessage);
  });
}

/** Shows a notification straight from this device, without the server: checks the phone's own settings. */
export async function showLocalTest(): Promise<string | null> {
  const reg = await registration();
  if (!reg) return 'Notifications aren’t available here.';
  if (Notification.permission !== 'granted') return 'Notifications aren’t allowed for this app. Turn push on first.';
  try {
    await reg.showNotification('Local test', { body: 'This device can show Progress Tracker notifications.', icon: '/pwa-192x192.png', badge: '/badge-96.png', tag: 'local-test' });
    return null;
  } catch (e) {
    return `This device refused to show it: ${(e as Error).message}`;
  }
}

export async function sendTestPush(): Promise<string | null> {
  if (!supabase) return 'The app isn’t connected to its server.';
  const { data, error } = await supabase.functions.invoke<{ sent?: number; error?: string }>('notify', { body: { mode: 'test' } });
  if (error) {
    // The function replies with a readable message in its JSON body.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    return body?.error ?? error.message;
  }
  return data?.sent ? null : (data?.error ?? 'No notification was sent.');
}
