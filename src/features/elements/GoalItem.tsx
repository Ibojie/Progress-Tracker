import { ArrowDown, ArrowUp, CalendarClock, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GOAL_STATE_LABEL } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { BandChip } from './BandChip';
import { formatDate, type GoalView } from './model';

interface GoalItemProps {
  goal: GoalView;
  position: number;
  count: number;
  disabled: boolean;
  /** Reset date and delete need a connection; ticks, edits and reordering work offline. */
  online: boolean;
  onToggle: (isDone: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onReset: () => void;
}

/** One row of the goal checklist (§6.3): tick, title, dates, band chip, state, actions. */
export function GoalItem({ goal, position, count, disabled, online, onToggle, onEdit, onDelete, onMove, onReset }: GoalItemProps) {
  const { row, info } = goal;
  const abandoned = info.state === 'abandoned';
  const checkboxId = `goal-${row.id}`;

  return (
    <li
      className="rounded-md border border-border/60 bg-surface/70 p-3 sm:p-4"
      aria-label={`${row.title}: ${GOAL_STATE_LABEL[info.state]}`}
    >
      {/* Abandoned goals fade (§4.3); the Reset date button below stays at full strength. */}
      <div className={cn('flex items-start gap-3', abandoned && 'opacity-45')}>
        <label htmlFor={checkboxId} className="-m-2 flex min-h-tap min-w-tap shrink-0 cursor-pointer items-center justify-center p-2">
          <input
            id={checkboxId}
            type="checkbox"
            checked={row.is_done}
            disabled={disabled}
            onChange={(e) => {
              // Only the box just ticked animates (not every done goal when the list appears).
              if (e.target.checked) e.target.classList.add('ticked');
              onToggle(e.target.checked);
            }}
            onAnimationEnd={(e) => e.currentTarget.classList.remove('ticked')}
                    className="tick-box size-6 cursor-pointer accent-[rgb(var(--done))]"
            aria-describedby={`${checkboxId}-meta`}
          />
          <span className="sr-only">Mark “{row.title}” as {row.is_done ? 'not done' : 'done'}</span>
        </label>
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold', row.is_done && 'text-done', abandoned && 'text-muted-foreground')}>{row.title}</p>
          <div id={`${checkboxId}-meta`} className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-secondary text-muted-foreground">
              {formatDate(row.start_date)} → {formatDate(row.due_date)}
            </span>
            <BandChip info={info} isDone={row.is_done} />
            {row.reset_count > 0 && (
              <span className="text-label text-muted-foreground">
                Reset {row.reset_count}× (first due {formatDate(row.original_due_date)})
              </span>
            )}
          </div>
          {row.notes && <p className="mt-2 whitespace-pre-line text-secondary text-muted-foreground">{row.notes}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 pl-12">
        {abandoned && (
          <Button size="default" variant="accent" onClick={onReset} className="mr-2" disabled={!online} title={online ? undefined : 'Needs a connection'}>
            <CalendarClock aria-hidden /> Reset date
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onEdit} disabled={disabled} aria-label={`Edit “${row.title}”`}>
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMove(-1)}
          disabled={disabled || position === 0}
          aria-label={`Move “${row.title}” up`}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMove(1)}
          disabled={disabled || position === count - 1}
          aria-label={`Move “${row.title}” down`}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={disabled || count === 1 || !online}
          aria-label={count === 1 ? 'The only goal can’t be deleted' : `Delete “${row.title}”`}
          title={count === 1 ? 'An element needs at least one goal' : undefined}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}
