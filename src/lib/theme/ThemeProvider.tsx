import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  toggledPreference,
  writeStoredPreference,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

interface ThemeContextValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  /** Set by the user. Saved locally and reported through onUserChange so it can sync to the profile. */
  setPreference: (pref: ThemePreference) => void;
  /** One-tap switch between light and dark. */
  toggle: () => void;
  /** Adopt a preference from elsewhere (the profile) without reporting it back. */
  adoptPreference: (pref: ThemePreference) => void;
  registerUserChangeListener: (fn: ((pref: ThemePreference) => void) | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const darkQuery = '(prefers-color-scheme: dark)';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(darkQuery).matches;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => readStoredPreference(safeLocalStorage()) ?? 'system',
  );
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [listener, setListener] = useState<((pref: ThemePreference) => void) | null>(null);

  const theme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const mql = window.matchMedia?.(darkQuery);
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const animate = !window.matchMedia?.(reducedMotionQuery).matches;
    if (animate && root.getAttribute('data-theme') !== theme) {
      root.classList.add('theme-transition');
      window.setTimeout(() => root.classList.remove('theme-transition'), 250);
    }
    applyTheme(document, theme);
  }, [theme]);

  const adoptPreference = useCallback((pref: ThemePreference) => {
    writeStoredPreference(safeLocalStorage(), pref);
    setPreferenceState(pref);
  }, []);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      adoptPreference(pref);
      listener?.(pref);
    },
    [adoptPreference, listener],
  );

  const toggle = useCallback(() => setPreference(toggledPreference(theme)), [setPreference, theme]);

  const registerUserChangeListener = useCallback((fn: ((pref: ThemePreference) => void) | null) => {
    // Wrap so React does not treat the function as a state updater.
    setListener(() => fn);
  }, []);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggle, adoptPreference, registerUserChangeListener }),
    [preference, theme, setPreference, toggle, adoptPreference, registerUserChangeListener],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
