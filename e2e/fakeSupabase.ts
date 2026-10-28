// An in-memory stand-in for Supabase, so the end-to-end tests drive the real app with no real
// account and never touch live data. It answers exactly the calls the app makes (REST tables,
// the database functions and the Edge Function checks) through Playwright's request routing.
import type { Page, Route } from '@playwright/test';

export const FAKE_URL = 'https://e2e.supabase.co';
export const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'e2e@example.com' };

type Row = Record<string, unknown>;

const CATEGORIES = [
  { key: 'paid_job', name: 'Paid Job' },
  { key: 'business', name: 'Business' },
  { key: 'investment', name: 'Investment' },
  { key: 'personal_development', name: 'Personal Development' },
].map((c, i) => ({ id: `c000000${i}-0000-4000-8000-000000000000`, user_id: USER.id, sort_order: i, created_at: '2026-01-01T00:00:00Z', ...c }));

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const now = () => new Date().toISOString();

export class FakeDb {
  profile: Row = {
    id: USER.id,
    display_name: 'E2E',
    timezone: 'Africa/Lagos',
    theme_preference: 'light',
    email_digest_enabled: true,
    push_enabled: false,
    in_app_enabled: true,
    ai_summary_enabled: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
  categories = CATEGORIES.map((c) => ({ ...c }));
  elements: Row[] = [];
  goals: Row[] = [];
  statusEvents: Row[] = [];
  resets: Row[] = [];
  deleted = false;

  addElement(name: string, categoryKey: string, goals: { title: string; start: string; due: string; done?: boolean }[]): string {
    const id = uuid();
    const cat = this.categories.find((c) => c.key === categoryKey)!;
    this.elements.push({
      id,
      user_id: USER.id,
      category_id: cat.id,
      name,
      description: null,
      zero_progress_status: 'not_started',
      is_decommissioned: false,
      decommissioned_at: null,
      recommissioned_at: null,
      restarted_at: null,
      sort_order: this.elements.length,
      created_at: now(),
      updated_at: now(),
    });
    goals.forEach((g, i) => this.addGoal(id, g.title, g.start, g.due, i, g.done));
    return id;
  }

  addGoal(elementId: string, title: string, start: string, due: string, sort: number, done = false): Row {
    const goal = {
      id: uuid(),
      user_id: USER.id,
      element_id: elementId,
      title,
      notes: null,
      start_date: start,
      due_date: due,
      original_due_date: due,
      is_done: done,
      done_at: done ? now() : null,
      tick_changed_at: done ? now() : null,
      reset_count: 0,
      sort_order: sort,
      created_at: now(),
      updated_at: now(),
    };
    this.goals.push(goal);
    return goal;
  }

  /** Elements as the app's select returns them: goals, category and the latest status event embedded. */
  elementRows(): Row[] {
    return [...this.elements]
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map((e) => {
        const cat = this.categories.find((c) => c.id === e.category_id)!;
        const events = this.statusEvents
          .filter((s) => s.element_id === e.id)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .slice(0, 1)
          .map((s) => ({ to_status: s.to_status, created_at: s.created_at }));
        return {
          ...e,
          goals: this.goals.filter((g) => g.element_id === e.id),
          category: { id: cat.id, key: cat.key, name: cat.name },
          status_events: events,
        };
      });
  }
}

/** PostgREST-style filters from the query string: column=eq.value, column=in.(a,b). */
function matches(row: Row, params: URLSearchParams): boolean {
  for (const [col, cond] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(col) || col.includes('.')) continue;
    const [op, ...rest] = cond.split('.');
    const value = rest.join('.');
    if (op === 'eq' && String(row[col]) !== value) return false;
    if (op === 'in' && !value.replace(/^\(|\)$/g, '').split(',').includes(String(row[col]))) return false;
    if (op === 'gte' && String(row[col]) < value) return false;
  }
  return true;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

/** Routes every request for the fake Supabase URL to the in-memory database. */
export async function installFakeSupabase(page: Page, db: FakeDb): Promise<void> {
  await page.route(`${FAKE_URL}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return json(route, undefined, 204);
    const url = new URL(req.url());
    const path = url.pathname;
    const params = url.searchParams;
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const body = req.postDataJSON?.() as Row | Row[] | null;

    // ---- auth
    if (path === '/auth/v1/user') return json(route, { id: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated' });
    if (path.startsWith('/auth/v1/logout')) return json(route, undefined, 204);
    if (path.startsWith('/auth/v1/')) return json(route, {});

    // ---- Edge Functions: the AI check says "not set up", so the AI card stays hidden (test 14)
    if (path === '/functions/v1/ai-summary') return json(route, { configured: false, left: 0 });
    if (path.startsWith('/functions/v1/')) return json(route, { error: 'not in tests' }, 400);

    // ---- database functions
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.slice('/rest/v1/rpc/'.length);
      const a = (body ?? {}) as Row;
      if (fn === 'create_element_with_goals') {
        const cat = db.categories.find((c) => c.id === a.p_category_id)!;
        const goals = a.p_goals as { title: string; start_date: string; due_date: string }[];
        const id = db.addElement(a.p_name as string, cat.key, goals.map((g) => ({ title: g.title, start: g.start_date, due: g.due_date })));
        return json(route, id);
      }
      if (fn === 'tick_goal') {
        const g = db.goals.find((x) => x.id === a.p_goal_id)!;
        g.is_done = a.p_is_done;
        g.tick_changed_at = a.p_ticked_at;
        g.done_at = a.p_is_done ? a.p_ticked_at : null;
        return json(route, null);
      }
      if (fn === 'reset_goal_date') {
        const g = db.goals.find((x) => x.id === a.p_goal_id)!;
        db.resets.push({ id: uuid(), user_id: USER.id, goal_id: g.id, old_due_date: g.due_date, new_due_date: a.p_new_due_date, reason: a.p_reason, created_at: now() });
        g.due_date = a.p_new_due_date;
        g.reset_count = (g.reset_count as number) + 1;
        if (a.p_mark_restarted) db.elements.find((e) => e.id === g.element_id)!.restarted_at = now();
        return json(route, null);
      }
      if (fn === 'swap_goal_order') {
        const ga = db.goals.find((x) => x.id === a.p_goal_a)!;
        const gb = db.goals.find((x) => x.id === a.p_goal_b)!;
        [ga.sort_order, gb.sort_order] = [gb.sort_order, ga.sort_order];
        return json(route, null);
      }
      if (fn === 'delete_my_account') {
        if (a.p_confirm !== 'DELETE') return json(route, { message: 'Type DELETE to confirm.' }, 400);
        db.deleted = true;
        db.elements = [];
        db.goals = [];
        return json(route, null);
      }
      if (fn === 'snapshot_totals') return json(route, []);
      return json(route, { message: `unknown function ${fn}` }, 404);
    }

    // ---- tables
    const table = path.replace('/rest/v1/', '');
    const method = req.method();
    const store: Record<string, Row[]> = {
      profiles: [db.profile],
      categories: db.categories,
      elements: db.elements,
      goals: db.goals,
      status_events: db.statusEvents,
      goal_date_resets: db.resets,
      notification_log: [],
      push_subscriptions: [],
      ai_summaries: [],
    };
    const rows = store[table];
    if (!rows) return json(route, { message: `unknown table ${table}` }, 404);

    if (method === 'GET' || method === 'HEAD') {
      let out = table === 'elements' ? db.elementRows() : rows;
      if (table === 'goal_date_resets') out = out.map((r) => ({ ...r, goal: db.goals.find((g) => g.id === r.goal_id) }));
      out = out.filter((r) => matches(r, params));
      if (table === 'categories') out = [...out].sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
      return json(route, single ? (out[0] ?? null) : out, single && !out[0] ? 406 : 200);
    }
    if (method === 'POST') {
      const list = (Array.isArray(body) ? body : [body]) as Row[];
      const created = list.map((r) => ({ id: uuid(), user_id: USER.id, created_at: now(), ...r }));
      if (table === 'goals') created.forEach((g: Row) => db.goals.push({ is_done: false, done_at: null, tick_changed_at: null, reset_count: 0, original_due_date: g.due_date, ...g }));
      else rows.push(...created);
      return json(route, created, 201);
    }
    if (method === 'PATCH') {
      const hit = rows.filter((r) => matches(r, params));
      hit.forEach((r) => Object.assign(r, body, { updated_at: now() }));
      return json(route, hit);
    }
    if (method === 'DELETE') {
      const hit = rows.filter((r) => matches(r, params));
      for (const r of hit) rows.splice(rows.indexOf(r), 1);
      if (table === 'elements') db.goals = db.goals.filter((g) => !hit.some((e) => e.id === g.element_id));
      return json(route, hit);
    }
    return json(route, { message: 'unsupported' }, 400);
  });
}

/** A signed-in session saved where supabase-js looks for it, so the app starts signed in. */
export async function signIn(page: Page): Promise<void> {
  const session = {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    user: { id: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
  };
  await page.addInitScript(
    ([key, value]) => {
      // Only on the first load of each test, so signing out stays signed out.
      if (!sessionStorage.getItem('e2e-signed-in')) {
        localStorage.setItem(key!, value!);
        sessionStorage.setItem('e2e-signed-in', '1');
      }
    },
    ['sb-e2e-auth-token', JSON.stringify(session)],
  );
}

export function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
