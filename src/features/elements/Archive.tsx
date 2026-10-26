import { Link } from 'react-router-dom';
import { Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useElementViews, useSetDecommissioned } from './api';
import { StatusPill } from './StatusPill';

/** Settings → Archive: decommissioned elements (switch back on) and completed ones (§4.5, §6.6). */
export function Archive() {
  const { views, isLoading } = useElementViews();
  const decommission = useSetDecommissioned();
  const off = views.filter((v) => v.status === 'decommissioned');
  const completed = views.filter((v) => v.status === 'completed');

  if (isLoading) return <p role="status">Loading…</p>;

  return (
    <div className="grid gap-6">
      <section aria-labelledby="archive-off">
        <h3 id="archive-off" className="mb-2 font-semibold">
          Decommissioned
        </h3>
        {off.length === 0 ? (
          <p className="text-secondary text-muted-foreground">Nothing switched off.</p>
        ) : (
          <ul className="grid gap-2">
            {off.map((v) => (
              <li key={v.row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-surface/60 p-3">
                <div className="min-w-0">
                  <Link to={`/elements/${v.row.id}`} className="font-semibold text-foreground">
                    {v.row.name}
                  </Link>
                  <p className="text-label text-muted-foreground">{v.row.category?.name}</p>
                </div>
                <Button
                  variant="outline"
                  disabled={decommission.isPending}
                  onClick={() => decommission.mutate(v.row.id, false)}
                  aria-label={`Switch “${v.row.name}” back on`}
                >
                  <Power aria-hidden /> Switch on
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="archive-done">
        <h3 id="archive-done" className="mb-2 font-semibold">
          Completed
        </h3>
        {completed.length === 0 ? (
          <p className="text-secondary text-muted-foreground">No completed elements yet.</p>
        ) : (
          <ul className="grid gap-2">
            {completed.map((v) => (
              <li key={v.row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-surface/60 p-3">
                <Link to={`/elements/${v.row.id}`} className="font-semibold text-foreground">
                  {v.row.name}
                </Link>
                <StatusPill status={v.status} pct={v.pct} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
