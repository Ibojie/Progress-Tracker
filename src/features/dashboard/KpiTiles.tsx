import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Kpi } from '@/lib/engine';
import { cn } from '@/lib/utils';

/** Tiny trend line (§8 chart 9). Plain SVG: it has no axes or hover, so a chart library adds nothing. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <div className="h-8" aria-hidden />;
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full text-primary" role="img" aria-label={`${label} trend: ${values.join(', ')}`} preserveAspectRatio="none">
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Delta({ kpi, previousLabel }: { kpi: Kpi; previousLabel: string }) {
  if (kpi.delta === null) return <p className="text-label text-muted-foreground">No history yet</p>;
  const good = kpi.delta === 0 ? null : kpi.delta > 0 === kpi.goodWhenUp;
  const Icon = kpi.delta > 0 ? TrendingUp : kpi.delta < 0 ? TrendingDown : Minus;
  const arrow = kpi.delta > 0 ? '▲' : kpi.delta < 0 ? '▼' : '';
  const unit = kpi.unit === '%' ? ' pts' : '';
  return (
    <p
      className={cn(
        'flex items-center gap-1 text-label font-semibold',
        good === true && 'text-done',
        good === false && 'text-destructive',
        good === null && 'text-muted-foreground',
      )}
    >
      <Icon aria-hidden className="size-4" />
      {kpi.delta === 0 ? 'No change' : `${arrow}${Math.abs(kpi.delta)}${unit}`}
      <span className="font-normal text-muted-foreground">
        vs {previousLabel}
        {good !== null && <span className="sr-only">{good ? ' (better)' : ' (worse)'}</span>}
      </span>
    </p>
  );
}

export function KpiTiles({ kpis, previousLabel }: { kpis: Kpi[]; previousLabel: string }) {
  return (
    <ul className="mb-6 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]" aria-label="Key figures">
      {kpis.map((k) => (
        <li key={k.key} className="glass flex flex-col gap-1 rounded-lg p-4">
          <p className="text-label font-semibold text-muted-foreground">{k.label}</p>
          <p className="text-[2rem] font-bold leading-tight tabular-nums">
            {k.value}
            {k.unit}
          </p>
          <Delta kpi={k} previousLabel={previousLabel} />
          <Sparkline values={k.series} label={k.label} />
        </li>
      ))}
    </ul>
  );
}
