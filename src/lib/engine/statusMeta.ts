import { readableTextOn } from './bands';
import type { ElementStatus, GoalState } from './types';

export interface StatusMeta {
  label: string;
  /** Pill background from §4.1; text colour is chosen for AA contrast. */
  bg: string;
  fg: string;
  /** lucide-react icon name, so the pill never relies on colour alone. */
  icon: string;
  /** Card opacity (abandoned elements fade to 45%). */
  opacity: number;
  /** Status is set automatically rather than chosen. */
  auto: boolean;
}

const meta = (label: string, bg: string, icon: string, auto: boolean, opacity = 1): StatusMeta => ({
  label,
  bg,
  fg: readableTextOn(bg),
  icon,
  opacity,
  auto,
});

export const STATUS_META: Record<ElementStatus, StatusMeta> = {
  not_started: meta('Not Started', '#64748B', 'CircleDashed', true),
  started: meta('Started', '#4F46E5', 'PlayCircle', true),
  resource_delay: meta('Resource Delay', '#EA580C', 'PauseCircle', false),
  in_progress: meta('In Progress', '#0891B2', 'Loader', true),
  completed: meta('Completed', '#16A34A', 'CheckCircle2', true),
  abandoned: meta('Abandoned', '#9CA3AF', 'Ban', true, 0.45),
  restarted: meta('Restarted', '#9333EA', 'RotateCcw', true),
  decommissioned: meta('Decommissioned', '#374151', 'PowerOff', false),
  recommissioned: meta('Recommissioned', '#0284C7', 'Power', true),
};

export const GOAL_STATE_LABEL: Record<GoalState, string> = {
  done: 'Done',
  not_started: 'Not Started',
  open: 'Open',
  overdue: 'Overdue',
  abandoned: 'Abandoned',
};

/** "In Progress · 50%" (§4.4). */
export function statusLabel(status: ElementStatus, pct: number): string {
  return `${STATUS_META[status].label} · ${pct}%`;
}
