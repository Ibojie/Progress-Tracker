// Runs the real migrations in an in-memory Postgres (PGlite) with a minimal stand-in for
// Supabase's auth schema. Shared by the database test files.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = path.resolve('supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(dir, file), 'utf8'));
  }
  return db;
}

/** Run statements as a signed-in user (or a signed-out visitor) inside one transaction. */
export function asUserOn(db: PGlite) {
  return async function asUser<T>(userId: string | null, fn: (q: PGlite['query']) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`);
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
      return fn(tx.query.bind(tx) as PGlite['query']);
    });
  };
}
