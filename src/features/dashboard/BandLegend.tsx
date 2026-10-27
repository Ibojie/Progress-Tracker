import { BAND_LABEL, bandColor, type Band } from '@/lib/engine';
import { useTheme } from '@/lib/theme/ThemeProvider';

const ROWS: { band: Band; range: string; far: number; near: number }[] = [
  { band: 'long', range: '60+ days', far: 100, near: 60 },
  { band: 'medium', range: '30–59 days', far: 59, near: 30 },
  { band: 'short', range: '15–29 days', far: 29, near: 15 },
  { band: 'immediate', range: '0–14 days', far: 14, near: 0 },
  { band: 'overdue', range: 'past due', far: -1, near: -1 },
];

/** Small legend of the deadline bands (§5): each band's colour darkens as the deadline nears. */
export function BandLegend() {
  const { theme } = useTheme();
  return (
    <figure className="mb-6">
      <figcaption className="mb-2 text-label font-semibold text-muted-foreground">
        Deadline colours: each colour darkens as the deadline gets closer
      </figcaption>
      <ul className="flex flex-wrap gap-2">
        {ROWS.map((r) => (
          <li key={r.band} className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 py-1 pl-1 pr-3">
            <span
              aria-hidden
              className="h-5 w-10 rounded-full border border-border/40"
              style={{ background: `linear-gradient(90deg, ${bandColor(r.far, theme).bg}, ${bandColor(r.near, theme).bg})` }}
            />
            <span className="text-label">
              <strong>{BAND_LABEL[r.band]}</strong> {r.range}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
