import { Link } from 'react-router-dom';
import { CheckCircle2, Siren } from 'lucide-react';
import { useToggleGoal } from '@/features/elements/api';
import { BandChip } from '@/features/elements/BandChip';
import { describeGoal, type FocusItem } from '@/lib/engine';
import type { DashboardData } from './useDashboard';

/**
 * Every overdue and Immediate (0–14 days) goal, most urgent first, each with a one-tap tick
 * (§6.1). Always shown and never collapsed: this strip is why the app exists.
 */
export function FocusNow({ data }: { data: DashboardData }) {
  const toggle = useToggleGoal();
  const items: FocusItem[] = data.advice.focus.filter((f) => f.daysLeft <= 14);
  const goalById = new Map(data.adviceElements.flatMap((e) => e.goals.map((g) => [g.id, g] as const)));

  return (
    <section aria-labelledby="focus-now" className="glass mb-6 rounded-lg border-2 border-destructive/40 p-4 sm:p-5">
      <h2 id="focus-now" className="mb-3 flex items-center gap-2 text-h3 font-bold">
        <Siren aria-hidden className="size-6 text-destructive" />
        Focus now
        {items.length > 0 && (
          <span className="rounded-full bg-destructive px-2.5 py-0.5 text-label font-bold text-destructive-foreground">{items.length}</span>
        )}
      </h2>

      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-secondary">
          <CheckCircle2 aria-hidden className="size-5 text-done" />
          Nothing overdue or due in the next 14 days.
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => {
            const goal = goalById.get(item.goalId);
            const id = `focus-${item.goalId}`;
            return (
              <li key={item.goalId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface/70 px-2 py-1.5">
                <label htmlFor={id} className="flex min-h-tap min-w-tap shrink-0 cursor-pointer items-center justify-center">
                  <input
                    id={id}
                    type="checkbox"
                    checked={false}
                    onChange={(e) => {
                      e.target.classList.add('ticked');
                      toggle.mutate({ goalId: item.goalId, isDone: true });
                    }}
                    onAnimationEnd={(e) => e.currentTarget.classList.remove('ticked')}
                    className="tick-box size-6 cursor-pointer accent-[rgb(var(--done))]"
                  />
                  <span className="sr-only">
                    Mark “{item.goalTitle}” in {item.elementName} as done
                  </span>
                </label>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{item.goalTitle}</p>
                  <Link to={`/elements/${item.elementId}`} className="text-secondary text-primary">
                    {item.elementName}
                  </Link>
                </div>
                {goal && <BandChip info={describeGoal(goal, data.today)} isDone={false} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
