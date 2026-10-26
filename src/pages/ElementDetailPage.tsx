import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToday } from '@/features/profile/useProfile';
import {
  useAddGoal,
  useDeleteElement,
  useDeleteGoal,
  useElementViews,
  useResetGoalDate,
  useSetDecommissioned,
  useSwapGoals,
  useToggleGoal,
  useUpdateElement,
  useUpdateGoal,
} from '@/features/elements/api';
import { ProgressBar } from '@/features/elements/BandChip';
import { GoalEditDialog, ResetDateDialog } from '@/features/elements/GoalDialogs';
import { GoalItem } from '@/features/elements/GoalItem';
import { StatusHistory } from '@/features/elements/StatusHistory';
import { StatusPill } from '@/features/elements/StatusPill';
import { formatDate, toEngineElement, toEngineGoal, type ElementView, type GoalView } from '@/features/elements/model';
import { MAX_GOALS, elementInputSchema, fieldErrors, type GoalInput } from '@/features/elements/schemas';
import { STATUS_META, addDays, zeroProgressControl, type ZeroProgressStatus } from '@/lib/engine';
import { cn } from '@/lib/utils';

const ElementBurndown = lazy(() => import('@/features/dashboard/charts/ElementBurndown'));

export function ElementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { views, isLoading, error } = useElementViews();
  const view = views.find((v) => v.row.id === id);

  if (isLoading) return <p role="status">Loading…</p>;
  if (error) return <p role="alert" className="text-destructive">Couldn’t load this element: {error.message}</p>;
  if (!view) {
    return (
      <div className="glass rounded-lg p-6">
        <h1 className="text-h2 font-bold">Element not found</h1>
        <p className="mt-2">It may have been deleted.</p>
        <Link to="/categories" className="mt-4 inline-block font-semibold text-primary underline">
          Back to categories
        </Link>
      </div>
    );
  }
  return <ElementDetail view={view} />;
}

function ElementDetail({ view }: { view: ElementView }) {
  const navigate = useNavigate();
  const today = useToday();
  const { row } = view;

  const toggle = useToggleGoal();
  const updateElement = useUpdateElement();
  const decommission = useSetDecommissioned();
  const deleteElement = useDeleteElement();
  const addGoal = useAddGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const swap = useSwapGoals();
  const reset = useResetGoalDate();

  const [editingElement, setEditingElement] = useState(false);
  const [confirmDecommission, setConfirmDecommission] = useState(false);
  const [confirmDeleteElement, setConfirmDeleteElement] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalView | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<GoalView | null>(null);
  const [resettingGoal, setResettingGoal] = useState<GoalView | null>(null);

  const decommissioned = row.is_decommissioned;
  const control = zeroProgressControl(toEngineElement(row), row.goals.map(toEngineGoal), today);
  const canAdd = view.total < MAX_GOALS;
  const busy = swap.isPending;

  function toggleDecommission(off: boolean) {
    if (off) setConfirmDecommission(true);
    else decommission.mutate(row.id, false);
  }

  return (
    <>
      <Link
        to={decommissioned ? '/settings#archive' : `/categories/${row.category?.key ?? ''}`}
        className="mb-2 inline-flex min-h-tap items-center gap-1 font-medium text-primary"
      >
        <ArrowLeft aria-hidden className="size-5" /> {decommissioned ? 'Archive' : row.category?.name}
      </Link>

      <header className="glass mb-6 grid gap-4 rounded-lg p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-semibold uppercase tracking-wide text-muted-foreground">{row.category?.name}</p>
            <h1 className="text-h1 font-bold leading-tight tracking-tight">{row.name}</h1>
            {row.description && <p className="mt-1 text-secondary text-muted-foreground">{row.description}</p>}
          </div>
          <Button variant="outline" onClick={() => setEditingElement(true)}>
            <Pencil aria-hidden /> Edit
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={view.status} pct={view.pct} className="text-base" />
          <span className="text-secondary text-muted-foreground">
            {view.done} of {view.total} goals done
            {view.startDate && ` · starts ${formatDate(view.startDate)}`}
          </span>
        </div>
        <ProgressBar pct={view.pct} label={`${row.name}: ${view.pct}% complete`} />

        {(view.overdueCount > 0 || (view.abandonedCount > 0 && view.status !== 'abandoned')) && (
          <p role="status" className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle aria-hidden className="size-5 shrink-0" />
            {[
              view.overdueCount > 0 && `${view.overdueCount} overdue`,
              view.abandonedCount > 0 && view.status !== 'abandoned' && `${view.abandonedCount} abandoned`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {control.visible && !decommissioned && (
          <ZeroProgressSelector
            locked={control.locked}
            options={control.options}
            startDate={control.startDate}
            value={view.status === 'resource_delay' ? 'resource_delay' : view.status === 'started' ? 'started' : 'not_started'}
            onChange={(v) => updateElement.mutate({ id: row.id, patch: { zero_progress_status: v } })}
          />
        )}

        <div className="flex items-center gap-3 border-t border-border/50 pt-4">
          <Switch
            id="active-switch"
            checked={!decommissioned}
            onCheckedChange={(on) => toggleDecommission(!on)}
            disabled={decommission.isPending}
          />
          <Label htmlFor="active-switch">
            {decommissioned ? 'Switched off (decommissioned). Turn on to bring it back.' : 'Active'}
          </Label>
        </div>
      </header>

      <section aria-labelledby="goals-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="goals-heading" className="text-h2 font-semibold">
            Goals
          </h2>
          <Button variant="outline" onClick={() => setAdding(true)} disabled={!canAdd}>
            <Plus aria-hidden /> {canAdd ? 'Add goal' : `${MAX_GOALS} goals maximum`}
          </Button>
        </div>
        <ol className="grid gap-3">
          {view.goals.map((g, i) => (
            <GoalItem
              key={g.row.id}
              goal={g}
              position={i}
              count={view.goals.length}
              disabled={busy}
              onToggle={(isDone) => toggle.mutate({ goalId: g.row.id, isDone })}
              onEdit={() => setEditingGoal(g)}
              onDelete={() => setDeletingGoal(g)}
              onMove={(dir) => {
                const other = view.goals[i + dir];
                if (other) swap.mutate({ a: g.row.id, b: other.row.id });
              }}
              onReset={() => setResettingGoal(g)}
            />
          ))}
        </ol>
      </section>

      {!decommissioned && (
        <div className="mb-8">
          <Suspense fallback={<p role="status">Loading chart…</p>}>
            <ElementBurndown view={view} />
          </Suspense>
        </div>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusHistory elementId={row.id} />
        </CardContent>
      </Card>

      <div className="mb-8">
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDeleteElement(true)}>
          <Trash2 aria-hidden /> Delete this element
        </Button>
      </div>

      {editingElement && (
        <ElementEditDialog
          open
          onOpenChange={setEditingElement}
          view={view}
          busy={updateElement.isPending}
          onSave={(patch) => updateElement.mutate({ id: row.id, patch }, { onSuccess: () => setEditingElement(false) })}
        />
      )}

      {adding && (
        <GoalEditDialog
          open
          onOpenChange={setAdding}
          title="Add a goal"
          submitLabel="Add goal"
          initial={blankGoal(today)}
          busy={addGoal.isPending}
          onSubmit={(goal) =>
            addGoal.mutate(
              { elementId: row.id, goal, sortOrder: Math.max(-1, ...row.goals.map((g) => g.sort_order)) + 1 },
              { onSuccess: () => setAdding(false) },
            )
          }
        />
      )}

      {editingGoal && (
        <GoalEditDialog
          key={editingGoal.row.id}
          open
          onOpenChange={(o) => !o && setEditingGoal(null)}
          title="Edit goal"
          submitLabel="Save goal"
          initial={toInput(editingGoal)}
          busy={updateGoal.isPending}
          onSubmit={(goal) => updateGoal.mutate({ goalId: editingGoal.row.id, goal }, { onSuccess: () => setEditingGoal(null) })}
        />
      )}

      {resettingGoal && (
        <ResetDateDialog
          open
          onOpenChange={(o) => !o && setResettingGoal(null)}
          goalTitle={resettingGoal.row.title}
          currentDue={resettingGoal.row.due_date}
          today={today}
          busy={reset.isPending}
          onSubmit={(newDueDate, reason) =>
            reset.mutate(
              { goalId: resettingGoal.row.id, newDueDate, reason, markRestarted: view.status === 'abandoned' },
              { onSuccess: () => setResettingGoal(null) },
            )
          }
        />
      )}

      <ConfirmDialog
        open={!!deletingGoal}
        onOpenChange={(o) => !o && setDeletingGoal(null)}
        title="Delete this goal?"
        confirmLabel="Delete goal"
        destructive
        busy={deleteGoal.isPending}
        onConfirm={() => deletingGoal && deleteGoal.mutate(deletingGoal.row.id, { onSuccess: () => setDeletingGoal(null) })}
      >
        <p>“{deletingGoal?.row.title}” will be removed, and the element’s percentage will be recalculated.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDecommission}
        onOpenChange={setConfirmDecommission}
        title="Switch this element off?"
        confirmLabel="Switch off"
        busy={decommission.isPending}
        onConfirm={() => decommission.mutate(row.id, true, { onSuccess: () => setConfirmDecommission(false) })}
      >
        <p>
          “{row.name}” will be hidden from every list, chart and reminder. Nothing is deleted: you can switch it back on
          from Settings → Archive.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDeleteElement}
        onOpenChange={setConfirmDeleteElement}
        title="Delete this element for good?"
        confirmLabel="Delete element"
        destructive
        busy={deleteElement.isPending}
        onConfirm={() =>
          deleteElement.mutate(row.id, {
            onSuccess: () => navigate(`/categories/${row.category?.key ?? ''}`, { replace: true }),
          })
        }
      >
        <p>
          “{row.name}”, its {view.total} {view.total === 1 ? 'goal' : 'goals'} and its history will be deleted permanently. To
          hide it but keep the history, switch it off instead.
        </p>
      </ConfirmDialog>
    </>
  );
}

function blankGoal(today: string): GoalInput {
  return { title: '', notes: '', start_date: today, due_date: addDays(today, 30) };
}

function toInput(g: GoalView): GoalInput {
  return { title: g.row.title, notes: g.row.notes ?? '', start_date: g.row.start_date, due_date: g.row.due_date };
}

function ZeroProgressSelector({
  locked,
  options,
  startDate,
  value,
  onChange,
}: {
  locked: boolean;
  options: ZeroProgressStatus[];
  startDate: string | null;
  value: ZeroProgressStatus;
  onChange: (v: ZeroProgressStatus) => void;
}) {
  return (
    <fieldset className="grid gap-2" disabled={locked}>
      <legend className="mb-1 font-medium">Status while nothing is ticked</legend>
      {locked ? (
        <p className="flex items-center gap-2 text-secondary text-muted-foreground">
          <Lock aria-hidden className="size-5 shrink-0" />
          Not Started until {startDate ? formatDate(startDate) : 'its start date'}. It switches to Started automatically on
          that day.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const checked = value === o;
            return (
              <label
                key={o}
                className={cn(
                  'flex min-h-tap cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-surface/60 px-4 py-2 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                  checked && 'border-primary bg-primary/10 ring-1 ring-primary',
                )}
              >
                <input type="radio" name="zero-status" value={o} checked={checked} onChange={() => onChange(o)} className="sr-only" />
                {STATUS_META[o].label}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function ElementEditDialog({
  open,
  onOpenChange,
  view,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  view: ElementView;
  busy: boolean;
  onSave: (patch: { name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState(view.row.name);
  const [description, setDescription] = useState(view.row.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const r = elementInputSchema.safeParse({ category_id: view.row.category_id, name, description });
    if (!r.success) return setErrors(fieldErrors(r.error));
    onSave({ name: r.data.name, description: r.data.description || null });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Edit element</DialogTitle>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-label font-medium text-destructive">{errors.name}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <textarea
              id="edit-description"
              value={description}
              maxLength={2000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
