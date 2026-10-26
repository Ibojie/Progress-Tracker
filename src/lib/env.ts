import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/** Returns the validated client env, or null when Supabase is not configured yet. */
export function parseClientEnv(raw: Record<string, unknown>): ClientEnv | null {
  const result = clientEnvSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const clientEnv = parseClientEnv(import.meta.env);
