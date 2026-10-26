import { Link } from 'react-router-dom';
import { CATEGORY_ICON } from '@/features/categories/categoryMeta';
import { ProgressBar } from '@/features/elements/BandChip';
import { STATUS_META, type ElementStatus } from '@/lib/engine';
import type { CategorySummary } from './useDashboard';

function nextDueText(n: NonNullable<CategorySummary['nextDue']>): string {
  if (n.daysLeft < 0) return `${n.goalTitle} overdue by ${-n.daysLeft}d`;
  if (n.daysLeft === 0) return `${n.goalTitle} due today`;
  return `${n.goalTitle} in ${n.daysLeft}d`;
}

/** The four category cards: %, status distribution and next deadline (§6.1). */
export function CategoryCards({ categories }: { categories: CategorySummary[] }) {
  return (
    <ul className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
      {categories.map((c) => {
        const Icon = CATEGORY_ICON[c.key];
        const counts = new Map<ElementStatus, number>();
        for (const v of c.views) counts.set(v.status, (counts.get(v.status) ?? 0) + 1);
        return (
          <li key={c.id}>
            <Link to={`/categories/${c.key}`} className="glass flex h-full flex-col gap-3 rounded-lg p-5 text-foreground no-underline">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="text-[1.25rem] font-semibold">{c.name}</h3>
                <span className="ml-auto text-[1.5rem] font-bold tabular-nums">{c.pct}%</span>
              </div>
              <ProgressBar pct={c.pct} label={`${c.name}: ${c.pct}% complete`} />
              {c.views.length === 0 ? (
                <p className="text-secondary text-muted-foreground">No elements yet</p>
              ) : (
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-label" aria-label="Elements by status">
                  {[...counts.entries()].map(([status, n]) => (
                    <li key={status} className="flex items-center gap-1.5">
                      <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: STATUS_META[status].bg }} />
                      {n} {STATUS_META[status].label}
                    </li>
                  ))}
                </ul>
              )}
              {c.nextDue && <p className="text-secondary text-muted-foreground">Next: {nextDueText(c.nextDue)}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
