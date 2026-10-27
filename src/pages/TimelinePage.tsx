import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PagePlaceholder';
import { Label } from '@/components/ui/label';
import { selectClass } from '@/components/ui/select-class';
import { Switch } from '@/components/ui/switch';
import { useCategories } from '@/features/categories/useCategories';
import { useElementViews } from '@/features/elements/api';
import { dueText, formatDate } from '@/features/elements/model';
import { useToday } from '@/features/profile/useProfile';
import { BAND_LABEL, STATUS_META, addDays, bandColor, bandFor, daysBetween, eachDay, type Band } from '@/lib/engine';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { cn } from '@/lib/utils';

const BANDS: Band[] = ['overdue', 'immediate', 'short', 'medium', 'long'];
const DAY_PX = 14;

/**
 * Gantt view of every goal in active elements (§6.5): band-coloured bars from start to due date,
 * a Today line, grouped by category then element. Scrolls sideways inside its own box on phones.
 * Built in HTML rather than a chart library so every bar is a real, keyboard-reachable link.
 */
export function TimelinePage() {
  const { theme } = useTheme();
  const today = useToday();
  const categories = useCategories();
  const { views, isLoading } = useElementViews();
  const [params, setParams] = useSearchParams();
  const bandParam = params.get('band');
  const band: Band | 'all' = bandParam && (BANDS as string[]).includes(bandParam) ? (bandParam as Band) : 'all';
  const [showDone, setShowDone] = useState(true);

  const active = views.filter((v) => v.status !== 'decommissioned');
  const rows = active.flatMap((v) =>
    v.goals
      .filter((g) => showDone || !g.row.is_done)
      .filter((g) => band === 'all' || (!g.row.is_done && g.info.state !== 'abandoned' && bandFor(g.info.daysLeft) === band))
      .map((g) => ({ view: v, goal: g })),
  );

  if (isLoading) return <p role="status">Loading…</p>;

  const starts = rows.map((r) => r.goal.row.start_date);
  const dues = rows.map((r) => r.goal.row.due_date);
  const rangeStart = [addDays(today, -14), ...starts].sort()[0]!;
  const rangeEnd = [addDays(today, 30), ...dues].sort().at(-1)!;
  const days = eachDay(rangeStart, rangeEnd);
  const width = days.length * DAY_PX;
  const x = (d: string) => daysBetween(rangeStart, d) * DAY_PX;
  const months = days.filter((d, i) => i === 0 || d.endsWith('-01'));

  return (
    <>
      <PageHeader title="Timeline" description="Every goal from start to due date, coloured by how close it is." />

      <div className="glass mb-4 flex flex-wrap items-end gap-4 rounded-lg p-4">
        <div className="grid min-w-[12rem] gap-1.5">
          <Label htmlFor="timeline-band">Deadline</Label>
          <select
            id="timeline-band"
            className={selectClass}
            value={band}
            onChange={(e) => setParams(e.target.value === 'all' ? {} : { band: e.target.value }, { replace: true })}
          >
            <option value="all">All deadlines</option>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {BAND_LABEL[b]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 pb-2">
          <Switch id="timeline-done" checked={showDone} onCheckedChange={setShowDone} />
          <Label htmlFor="timeline-done">Show completed goals</Label>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="glass rounded-lg p-6 text-secondary text-muted-foreground">
          {active.length === 0 ? 'Add an element to see its goals on the timeline.' : 'No goals match this filter.'}
        </p>
      ) : (
        <div className="glass overflow-x-auto rounded-lg">
          <div className="relative" style={{ width: `calc(14rem + ${width}px)` }}>
            {/* Month header */}
            <div className="sticky top-0 z-10 flex border-b border-border/50 bg-surface/90">
              <div className="sticky left-0 z-20 w-56 shrink-0 bg-surface/95 px-3 py-2 text-label font-semibold">Goal</div>
              <div className="relative h-9" style={{ width }}>
                {months.map((m) => (
                  <span key={m} className="absolute top-2 whitespace-nowrap border-l border-border/50 pl-1 text-label text-muted-foreground" style={{ left: x(m) }}>
                    {formatDate(m).split(' ').slice(1).join(' ')}
                  </span>
                ))}
              </div>
            </div>

            {(categories.data ?? []).map((c) => {
              const inCat = rows.filter((r) => r.view.row.category_id === c.id);
              if (inCat.length === 0) return null;
              const elementIds = [...new Set(inCat.map((r) => r.view.row.id))];
              return (
                <section key={c.id} aria-label={c.name}>
                  <h2 className="sticky left-0 w-56 px-3 pb-1 pt-4 text-[1.125rem] font-bold">{c.name}</h2>
                  {elementIds.map((id) => {
                    const items = inCat.filter((r) => r.view.row.id === id);
                    const v = items[0]!.view;
                    return (
                      <div key={id} className="mb-2">
                        <Link to={`/elements/${id}`} className="sticky left-0 block w-56 px-3 py-1 text-secondary font-semibold text-foreground">
                          {v.row.name}
                          <span className="sr-only"> ({STATUS_META[v.status].label})</span>
                        </Link>
                        <ul>
                          {items.map(({ goal }) => {
                            const g = goal.row;
                            const done = g.is_done;
                            const color = done ? { bg: STATUS_META.completed.bg, fg: STATUS_META.completed.fg } : bandColor(goal.info.daysLeft, theme);
                            const left = x(g.start_date);
                            const barWidth = Math.max(DAY_PX, (daysBetween(g.start_date, g.due_date) + 1) * DAY_PX);
                            return (
                              <li key={g.id} className="flex min-h-[44px] items-center border-t border-border/20">
                                <span className={cn('sticky left-0 z-[1] w-56 shrink-0 truncate bg-surface/90 px-3 text-secondary', done && 'text-done', goal.info.state === 'abandoned' && 'opacity-45')} title={g.title}>
                                  {g.title}
                                </span>
                                <div className="relative h-11" style={{ width }}>
                                  <Link
                                    to={`/elements/${id}`}
                                    className={cn('absolute top-2 flex h-7 items-center overflow-hidden rounded-[4px] px-2 text-label font-semibold no-underline', goal.info.state === 'abandoned' && 'opacity-45')}
                                    style={{ left, width: barWidth, backgroundColor: color.bg, color: color.fg }}
                                    aria-label={`${g.title}: ${formatDate(g.start_date)} to ${formatDate(g.due_date)}, ${dueText(goal.info, done)}`}
                                  >
                                    <span className="truncate">{barWidth > 90 ? dueText(goal.info, done) : ''}</span>
                                  </Link>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </section>
              );
            })}

            {/* Today line */}
            <div aria-hidden className="pointer-events-none absolute bottom-0 top-9 w-0.5 bg-destructive" style={{ left: `calc(14rem + ${x(today)}px)` }}>
              <span className="absolute -top-0 left-1 rounded bg-destructive px-1.5 text-label font-semibold text-destructive-foreground">Today</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
