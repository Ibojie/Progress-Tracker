import { useSyncExternalStore } from 'react';

/** Chrome/Edge/Android's install offer (not in the standard DOM types yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Call once at start-up: the browser offers installation once, soon after the page loads. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // show our own button instead of the browser's mini-bar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad Safari, where installing is "Share → Add to Home Screen" (no automatic offer). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOs;
}

export interface InstallState {
  /** Already running as an installed app. */
  standalone: boolean;
  /** The browser has offered installation and we can show our button. */
  canPrompt: boolean;
  ios: boolean;
  justInstalled: boolean;
  prompt: () => Promise<void>;
}

async function prompt() {
  if (!deferred) return;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === 'accepted') installed = true;
  deferred = null;
  emit();
}

export function useInstall(): InstallState {
  const version = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => `${!!deferred}-${installed}`,
    () => 'ssr',
  );
  void version;
  return { standalone: isStandalone(), canPrompt: !!deferred, ios: isIos(), justInstalled: installed, prompt };
}
