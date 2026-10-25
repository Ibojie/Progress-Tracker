import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { isThemePreference } from '@/lib/theme/theme';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useAuth } from './AuthProvider';

/**
 * Keeps profiles.theme_preference and the local choice in step:
 * on sign-in the profile's saved choice is adopted (so it follows the user to other devices),
 * and every later flip of the switch is written back to the profile.
 */
export function ThemeProfileSync() {
  const { user } = useAuth();
  const { adoptPreference, registerUserChangeListener } = useTheme();
  const userId = user?.id;

  useEffect(() => {
    if (!supabase || !userId) return;
    const client = supabase;
    let cancelled = false;

    client
      .from('profiles')
      .select('theme_preference')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data && isThemePreference(data.theme_preference)) adoptPreference(data.theme_preference);
      });

    registerUserChangeListener((pref) => {
      void client.from('profiles').update({ theme_preference: pref }).eq('id', userId);
    });

    return () => {
      cancelled = true;
      registerUserChangeListener(null);
    };
  }, [userId, adoptPreference, registerUserChangeListener]);

  return null;
}
