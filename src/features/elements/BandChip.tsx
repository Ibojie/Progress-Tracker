import { AlertTriangle, CalendarClock } from 'lucide-react';
import { bandColor, type GoalInfo } from '@/lib/engine';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { cn } from '@/lib/utils';
import { dueText } from './model';

/** Band-coloured "X days left" chip for a goal (§5, §6.3). Done goals show green. */
export function BandChip({ info, isDone, className }: { info: GoalInfo; isDone: boolean; className?: string }) {
  const { theme } = useTheme();
  const text = dueText(info, isDone);
  if (isDone) {
    return (
      <span className={cn('inline-flex rounded-full bg-[#16A34A] px-3 py-1 text-label font-semibold text-black', className)}>
        {text}
      </span>
    );
  }
  if (info.state === 'not_started') {
    return (
      <span className={cn('inline-flex rounded-full bg-muted px-3 py-1 text-label font-semibold text-muted-foreground', className)}>
        Not Started · {text}
      </span>
    );
  }
  const { bg, fg } = bandColor(info.daysLeft, theme);
  const urgent = info.state === 'overdue' || info.state === 'abandoned';
  const Icon = urgent ? AlertTriangle : CalendarClock;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label font-semibold', className)}
      style={{ backgroundColor: bg, color: fg }}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {text}
    </span>
  );
}

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}
