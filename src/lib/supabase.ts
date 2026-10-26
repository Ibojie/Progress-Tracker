import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from './env';
import type { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

/** Null until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set; the app then shows a setup screen. */
export const supabase: AppSupabaseClient | null = clientEnv
  ? createClient<Database>(clientEnv.VITE_SUPABASE_URL, clientEnv.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null;
