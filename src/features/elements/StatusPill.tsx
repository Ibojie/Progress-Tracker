import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Loader,
  PauseCircle,
  PlayCircle,
  Power,
  PowerOff,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { STATUS_META, type ElementStatus } from '@/lib/engine';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  CircleDashed,
  PlayCircle,
  PauseCircle,
  Loader,
  CheckCircle2,
  Ban,
  RotateCcw,
  PowerOff,
  Power,
};

/** Status pill with word and icon, never colour alone (§4.1). Shows "· 50%" when pct is given. */
export function StatusPill({ status, pct, className }: { status: ElementStatus; pct?: number; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = ICONS[meta.icon] ?? CircleDashed;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label font-semibold leading-tight', className)}
      style={{ backgroundColor: meta.bg, color: meta.fg }}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>
        {meta.label}
        {pct !== undefined && ` · ${pct}%`}
      </span>
    </span>
  );
}
