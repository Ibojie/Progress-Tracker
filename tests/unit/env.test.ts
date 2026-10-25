import { describe, expect, it } from 'vitest';
import { parseClientEnv } from '@/lib/env';

describe('parseClientEnv', () => {
  it('accepts a URL and key', () => {
    const env = parseClientEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnop',
    });
    expect(env?.VITE_SUPABASE_URL).toBe('https://example.supabase.co');
  });
  it('returns null when config is missing or malformed', () => {
    expect(parseClientEnv({})).toBeNull();
    expect(parseClientEnv({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: 'x' })).toBeNull();
  });
});
