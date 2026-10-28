// Plain checks, no zod: this runs at start-up, before anything else loads (Lighthouse, §11).
export interface ClientEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
}

function isUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Returns the validated client env, or null when Supabase is not configured yet. */
export function parseClientEnv(raw: Record<string, unknown>): ClientEnv | null {
  const url = raw.VITE_SUPABASE_URL;
  const key = raw.VITE_SUPABASE_ANON_KEY;
  if (!isUrl(url) || typeof key !== 'string' || key.length < 20) return null;
  return { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key };
}

export const clientEnv = parseClientEnv(import.meta.env);
