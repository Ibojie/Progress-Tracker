import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PagePlaceholder';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { selectClass } from '@/components/ui/select-class';
import { useCategories } from '@/features/categories/useCategories';
import { useElementViews } from '@/features/elements/api';
import { ElementCard } from '@/features/elements/ElementCard';
import type { ElementView } from '@/features/elements/model';
import { BAND_LABEL, STATUS_META, type Band, type ElementStatus } from '@/lib/engine';

type SortKey = 'due' | 'pct' | 'name';
const BANDS: Band[] = ['overdue', 'immediate', 'short', 'medium', 'long'];
const FILTER_STATUSES = (Object.keys(STATUS_META) as ElementStatus[]).filter((s) => s !== 'decommissioned');

const SORTERS: Record<SortKey, (a: ElementView, b: ElementView) => number> = {
  // Elements with no open goals (completed) go last.
  due: (a, b) => (a.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.daysLeft ?? Number.MAX_SAFE_INTEGER),
  pct: (a, b) => a.pct - b.pct,
  name: (a, b) => a.row.name.localeCompare(b.row.name),
};

export function CategoryPage() {
  const { key } = useParams<{ key: string }>();
  const categories = useCategories();
  const { views, isLoading, error } = useElementViews();
  const category = categories.data?.find((c) => c.key === key);

  const [status, setStatus] = useState<ElementStatus | 'all'>('all');
  const [band, setBand] = useState<Band | 'all'>('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [sort, setSort] = useState<SortKey>('due');

  const all = useMemo(
    () => views.filter((v) => v.row.category_id === category?.id && v.status !== 'decommissioned'),
    [views, category?.id],
  );
  const shown = all
    .filter((v) => status === 'all' || v.status === status)
    .filter((v) => band === 'all' || v.band === band)
    .filter((v) => showCompleted || v.status !== 'completed')
    .sort(SORTERS[sort]);

  if (categories.isSuccess && !category) {
    return (
      <>
        <PageHeader title="Category not found" />
        <Link to="/categories" className="font-semibold text-primary underline">
          Back to categories
        </Link>
      </>
    );
  }

  return (
    <>
      <Link to="/categories" className="mb-2 inline-flex min-h-tap items-center gap-1 font-medium text-primary">
        <ArrowLeft aria-hidden className="size-5" /> Categories
      </Link>
      <PageHeader title={category?.name ?? '…'} />

      <div className="mb-6">
        <Link to={`/elements/new?category=${key}`} className={buttonVariants({ variant: 'default' })}>
          <Plus aria-hidden /> New element
        </Link>
      </div>

      {all.length > 0 && (
        <section aria-label="Filter and sort" className="glass mb-6 grid gap-4 rounded-lg p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="filter-status">Status</Label>
            <select
              id="filter-status"
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as ElementStatus | 'all')}
            >
              <option value="all">All statuses</option>
              {FILTER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="filter-band">Deadline</Label>
            <select id="filter-band" className={selectClass} value={band} onChange={(e) => setBand(e.target.value as Band | 'all')}>
              <option value="all">All deadlines</option>
              {BANDS.map((b) => (
                <option key={b} value={b}>
                  {BAND_LABEL[b]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sort">Sort by</Label>
            <select id="sort" className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="due">Nearest deadline</option>
              <option value="pct">Least complete</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div className="flex items-center gap-3 self-end pb-2">
            <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} />
            <Label htmlFor="show-completed">Show completed</Label>
          </div>
        </section>
      )}

      {isLoading && <p role="status">Loading elements…</p>}
      {error && (
        <p role="alert" className="font-medium text-destructive">
          Couldn't load elements: {error.message}
        </p>
      )}
      {!isLoading && all.length === 0 && (
        <div className="glass rounded-lg p-6">
          <h2 className="text-h3 font-semibold">Nothing here yet</h2>
          <p className="mt-2 text-secondary text-muted-foreground">
            Add the first thing you want to track in {category?.name}. The wizard has quick templates to start from.
          </p>
        </div>
      )}
      {all.length > 0 && shown.length === 0 && <p role="status">No elements match these filters.</p>}

      <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
        {shown.map((v) => (
          <li key={v.row.id}>
            <ElementCard view={v} />
          </li>
        ))}
      </ul>
    </>
  );
}
