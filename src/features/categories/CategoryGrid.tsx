import { Link } from 'react-router-dom';
import { useElementViews } from '@/features/elements/api';
import { ProgressBar } from '@/features/elements/BandChip';
import { CATEGORY_ICON } from './categoryMeta';
import { useCategories } from './useCategories';

export function CategoryGrid() {
  const { data, isLoading, error } = useCategories();
  const { views } = useElementViews();

  if (isLoading) return <p role="status">Loading your categories…</p>;
  if (error) {
    return (
      <p role="alert" className="font-medium text-destructive">
        Couldn't load categories: {error.message}
      </p>
    );
  }
  if (!data?.length) {
    return (
      <p role="status" className="text-muted-foreground">
        No categories yet. They are created when your account is set up. If this stays empty, the database migrations
        haven't been applied.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
      {data.map((c) => {
        const Icon = CATEGORY_ICON[c.key];
        // Decommissioned elements are left out of every figure (§4.5).
        const active = views.filter((v) => v.row.category_id === c.id && v.status !== 'decommissioned');
        const total = active.reduce((n, v) => n + v.total, 0);
        const done = active.reduce((n, v) => n + v.done, 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <li key={c.id}>
            <Link
              to={`/categories/${c.key}`}
              className="glass flex h-full flex-col gap-3 rounded-lg p-5 text-foreground no-underline transition-transform hover:-translate-y-0.5 sm:p-6"
            >
              <span className="flex size-11 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Icon aria-hidden className="size-6" />
              </span>
              <h2 className="text-[1.25rem] font-semibold">{c.name}</h2>
              <p className="text-secondary text-muted-foreground">
                {active.length === 0
                  ? 'No elements yet'
                  : `${active.length} ${active.length === 1 ? 'element' : 'elements'} · ${pct}% complete`}
              </p>
              {active.length > 0 && <ProgressBar pct={pct} label={`${c.name}: ${pct}% complete`} />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
