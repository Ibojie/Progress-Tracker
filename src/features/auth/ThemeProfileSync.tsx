import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { isThemePreference, readUnsyncedFlag, writeUnsyncedFlag, type ThemePreference } from '@/lib/theme/theme';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useAuth } from './AuthProvider';

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Keeps profiles.theme_preference and the local choice in step:
 * on sign-in the profile's saved choice is adopted (so it follows the user to other devices),
 * and every later flip of the switch is written back to the profile.
 * A flip whose write failed (e.g. offline) is pushed on the next sync instead of being overwritten.
 */
export function ThemeProfileSync() {
  const { user } = useAuth();
  const { preference, adoptPreference, registerUserChangeListener } = useTheme();
  const userId = user?.id;

  useEffect(() => {
    if (!supabase || !userId) return;
    const client = supabase;
    const storage = safeLocalStorage();
    let cancelled = false;
    // Set once the user flips the switch, so a slow profile fetch can't undo that flip.
    let userChanged = false;

    const save = async (pref: ThemePreference) => {
      const { error } = await client.from('profiles').update({ theme_preference: pref }).eq('id', userId);
      writeUnsyncedFlag(storage, !!error);
    };

    if (readUnsyncedFlag(storage)) {
      void save(preference);
    } else {
      client
        .from('profiles')
        .select('theme_preference')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled || userChanged) return;
          if (data && isThemePreference(data.theme_preference)) adoptPreference(data.theme_preference);
        });
    }

    registerUserChangeListener((pref) => {
      userChanged = true;
      void save(pref);
    });

    return () => {
      cancelled = true;
      registerUserChangeListener(null);
    };
    // Runs once per signed-in user; `preference` is read only for the unsynced push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, adoptPreference, registerUserChangeListener]);

  return null;
}
