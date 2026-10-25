export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// Keep in step with the inline script in index.html.
export const THEME_STORAGE_KEY = 'pt-theme';
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#f1f5ff', dark: '#0b1120' };

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

/** The one-tap switch flips the theme the user currently sees. */
export function toggledPreference(current: ResolvedTheme): ThemePreference {
  return current === 'dark' ? 'light' : 'dark';
}

export function readStoredPreference(storage: Pick<Storage, 'getItem'> | undefined): ThemePreference | null {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPreference(storage: Pick<Storage, 'setItem'> | undefined, pref: ThemePreference): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Private mode or blocked storage: the profile copy still remembers it.
  }
}

export function applyTheme(doc: Document, theme: ResolvedTheme): void {
  doc.documentElement.setAttribute('data-theme', theme);
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}
