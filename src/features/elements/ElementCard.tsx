import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { STATUS_META, bandColor } from '@/lib/engine';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { BandChip, ProgressBar } from './BandChip';
import { StatusPill } from './StatusPill';
import type { ElementView } from './model';

/** Category-view card: band-coloured edge, status pill + %, progress, next goal, warnings (§6.2). */
export function ElementCard({ view }: { view: ElementView }) {
  const { theme } = useTheme();
  const edge =
    view.status === 'completed'
      ? STATUS_META.completed.bg
      : view.band && view.daysLeft !== null
        ? bandColor(view.daysLeft, theme).bg
        : 'transparent';
  const { row, nextGoal } = view;

  return (
    <article
      className="glass relative h-full overflow-hidden rounded-lg border-l-[6px]"
      style={{ borderLeftColor: edge, opacity: STATUS_META[view.status].opacity }}
    >
      <Link
        to={`/elements/${row.id}`}
        className="flex h-full flex-col gap-3 p-4 text-foreground no-underline focus-visible:outline-offset-[-3px] sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-[1.25rem] font-semibold leading-snug">{row.name}</h3>
          <StatusPill status={view.status} pct={view.pct} />
        </div>
        <ProgressBar pct={view.pct} label={`${row.name}: ${view.pct}% complete`} />
        <p className="text-secondary text-muted-foreground">
          {view.done} of {view.total} goals done
        </p>
        {nextGoal && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-secondary">Next: {nextGoal.row.title}</span>
            <BandChip info={nextGoal.info} isDone={false} />
          </div>
        )}
        {(view.overdueCount > 0 || (view.abandonedCount > 0 && view.status !== 'abandoned')) && (
          <p className="flex items-center gap-2 text-secondary font-semibold text-destructive">
            <AlertTriangle aria-hidden className="size-5 shrink-0" />
            {[
              view.overdueCount > 0 && `${view.overdueCount} overdue`,
              view.abandonedCount > 0 && view.status !== 'abandoned' && `${view.abandonedCount} abandoned`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </Link>
    </article>
  );
}
