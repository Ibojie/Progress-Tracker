import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { selectClass } from '@/components/ui/select-class';
import type { DateRange, PeriodKind } from '@/lib/engine';

const OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: 'week', label: 'This week vs last week' },
  { value: 'month', label: 'This month vs last month' },
  { value: 'quarter', label: 'This quarter vs last quarter' },
  { value: 'custom', label: 'Custom range' },
];

interface Props {
  kind: PeriodKind;
  custom: DateRange;
  onKind: (k: PeriodKind) => void;
  onCustom: (r: DateRange) => void;
}

/** One control row above the KPIs and charts (§6.1). */
export function PeriodSwitcher({ kind, custom, onKind, onCustom }: Props) {
  const invalid = kind === 'custom' && custom.end < custom.start;
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="grid min-w-[16rem] gap-1.5">
        <Label htmlFor="period">Compare</Label>
        <select id="period" className={selectClass} value={kind} onChange={(e) => onKind(e.target.value as PeriodKind)}>
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {kind === 'custom' && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="period-start">From</Label>
            <Input id="period-start" type="date" value={custom.start} onChange={(e) => onCustom({ ...custom, start: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="period-end">To</Label>
            <Input
              id="period-end"
              type="date"
              value={custom.end}
              min={custom.start}
              onChange={(e) => onCustom({ ...custom, end: e.target.value })}
              aria-invalid={invalid}
            />
          </div>
          {invalid && <p className="w-full text-label font-medium text-destructive">The end date can’t be before the start date.</p>}
        </>
      )}
    </div>
  );
}
