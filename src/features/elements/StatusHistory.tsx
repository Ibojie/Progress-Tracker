import { CalendarClock, History } from 'lucide-react';
import { STATUS_META } from '@/lib/engine';
import { useElementHistory } from './api';
import { formatDate } from './model';

function when(ts: string): string {
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Status changes and date resets, newest first (§6.3). */
export function StatusHistory({ elementId }: { elementId: string }) {
  const { data, isLoading, error } = useElementHistory(elementId);
  if (isLoading) return <p role="status">Loading history…</p>;
  if (error) return <p role="alert" className="text-destructive">Couldn’t load the history: {error.message}</p>;

  const entries = [
    ...(data?.events ?? []).map((e) => ({
      at: e.created_at,
      key: `s-${e.id}`,
      icon: History,
      text: e.from_status
        ? `${STATUS_META[e.from_status].label} → ${STATUS_META[e.to_status].label}`
        : `Started tracking as ${STATUS_META[e.to_status].label}`,
      detail: e.reason,
    })),
    ...(data?.resets ?? []).map((r) => ({
      at: r.created_at,
      key: `r-${r.id}`,
      icon: CalendarClock,
      text: `“${r.goal.title}” due date moved from ${formatDate(r.old_due_date)} to ${formatDate(r.new_due_date)}`,
      detail: r.reason,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (entries.length === 0) return <p className="text-secondary text-muted-foreground">No changes recorded yet.</p>;

  return (
    <ol className="grid gap-3">
      {entries.map(({ key, icon: Icon, at, text, detail }) => (
        <li key={key} className="flex gap-3">
          <Icon aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-secondary">{text}</p>
            {detail && <p className="text-label text-muted-foreground">“{detail}”</p>}
            <p className="text-label text-muted-foreground">
              <time dateTime={at}>{when(at)}</time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
