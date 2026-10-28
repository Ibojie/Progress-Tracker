// Recovering when a screen's file is gone after an update (see LoadErrorBoundary and main.tsx).

const RELOADED_KEY = 'pt-chunk-reloaded';

/** True for "this screen's file couldn't be loaded" (typically: a new version replaced it). */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically/i.test(msg);
}

/** Reload once to pick up the new version; the flag stops a reload loop if the file really is gone. */
export function reloadOnceForNewVersion(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return false;
    sessionStorage.setItem(RELOADED_KEY, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Clears the flag once a screen has loaded fine, so a later update can reload again. */
export function markLoadedOk(): void {
  try {
    sessionStorage.removeItem(RELOADED_KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
}
