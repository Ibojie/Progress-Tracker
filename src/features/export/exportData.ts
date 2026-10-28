import { supabase } from '@/lib/supabase';

const TABLES = [
  'categories',
  'elements',
  'goals',
  'goal_date_resets',
  'status_events',
  'daily_snapshots',
  'ai_summaries',
  'notification_log',
] as const;
const PAGE = 1000; // the API's usual maximum rows per request

/** Every row of one table, page by page, until a page comes back empty (whatever the server's cap). */
async function allRows(table: (typeof TABLES)[number]): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; ) {
    let query = supabase!.from(table).select('*');
    // A stable order so pages don't overlap; daily snapshots have no id column.
    query = table === 'daily_snapshots' ? query.order('snapshot_date').order('element_id') : query.order('id');
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    if (data.length === 0) return out;
    out.push(...(data as Record<string, unknown>[]));
    from += data.length;
  }
}

/** Everything the user owns, read through their own access rules (RLS): nobody else's rows. */
export async function fetchAllData() {
  const [profile, ...rest] = await Promise.all([supabase!.from('profiles').select('*').single(), ...TABLES.map(allRows)]);
  if (profile.error) throw profile.error;
  const data: Record<string, unknown> = { exported_at: new Date().toISOString(), profile: profile.data };
  rest.forEach((rows, i) => {
    data[TABLES[i]!] = rows;
  });
  return data as { exported_at: string; profile: Record<string, unknown> } & Record<(typeof TABLES)[number], Record<string, unknown>[]>;
}

/** One CSV cell: quoted when needed; formula-like text is prefixed so spreadsheets don't run it. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GOAL_COLUMNS = [
  'Area',
  'Element',
  'Element switched off',
  'Goal',
  'Notes',
  'Start date',
  'Due date',
  'Original due date',
  'Done',
  'Done at',
  'Date resets',
] as const;

/** Goals as a spreadsheet: one row per goal, with its element and area. */
export function goalsCsv(data: {
  categories: Record<string, unknown>[];
  elements: Record<string, unknown>[];
  goals: Record<string, unknown>[];
}): string {
  const cat = new Map(data.categories.map((c) => [c.id, c.name]));
  const el = new Map(data.elements.map((e) => [e.id, e]));
  const rows = data.goals
    .map((g) => {
      const e = el.get(g.element_id);
      return {
        sort: `${cat.get(e?.category_id) ?? ''}|${e?.name ?? ''}|${String(g.sort_order).padStart(4, '0')}`,
        cells: [
          cat.get(e?.category_id),
          e?.name,
          e?.is_decommissioned ? 'yes' : 'no',
          g.title,
          g.notes,
          g.start_date,
          g.due_date,
          g.original_due_date,
          g.is_done ? 'yes' : 'no',
          g.done_at,
          g.reset_count,
        ],
      };
    })
    .sort((a, b) => a.sort.localeCompare(b.sort));
  // A byte-order mark so Excel reads the file as UTF-8.
  return '﻿' + [GOAL_COLUMNS.map(csvCell).join(','), ...rows.map((r) => r.cells.map(csvCell).join(','))].join('\r\n') + '\r\n';
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
