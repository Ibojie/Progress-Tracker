import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addDays } from '@/lib/engine';
import { GoalFields } from './GoalFields';
import { formatDate } from './model';
import { fieldErrors, goalInputSchema, resetDateSchema, type GoalInput } from './schemas';

interface GoalEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial: GoalInput;
  busy: boolean;
  submitLabel: string;
  onSubmit: (goal: GoalInput) => void;
}

/**
 * Add or edit one goal. Validates before saving (§6.4 rules apply to edits too).
 * Render it only while open, so each opening starts from `initial`.
 */
export function GoalEditDialog({ open, onOpenChange, title, initial, busy, submitLabel, onSubmit }: GoalEditDialogProps) {
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const r = goalInputSchema.safeParse(value);
    if (!r.success) return setErrors(fieldErrors(r.error));
    setErrors({});
    onSubmit(r.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <div className="mt-4">
          <GoalFields idPrefix="edit-goal" value={value} onChange={setValue} errors={errors} showNotes />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ResetDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalTitle: string;
  currentDue: string;
  today: string;
  busy: boolean;
  onSubmit: (newDueDate: string, reason: string) => void;
}

/** The only way to revive an abandoned goal: a new due date after today, with an optional reason (§4.3). Render only while open. */
export function ResetDateDialog({ open, onOpenChange, goalTitle, currentDue, today, busy, onSubmit }: ResetDateDialogProps) {
  const [date, setDate] = useState(addDays(today, 14));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const r = resetDateSchema(today).safeParse({ new_due_date: date, reason });
    if (!r.success) return setErrors(fieldErrors(r.error));
    setErrors({});
    onSubmit(r.data.new_due_date, r.data.reason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Reset the due date</DialogTitle>
        <DialogDescription>
          “{goalTitle}” was due on {formatDate(currentDue)}. Pick a new date to make it active again. The change is kept in
          the history.
        </DialogDescription>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="reset-date">New due date</Label>
            <Input
              id="reset-date"
              type="date"
              min={addDays(today, 1)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.new_due_date}
              aria-describedby={errors.new_due_date ? 'reset-date-error' : undefined}
            />
            {errors.new_due_date && (
              <p id="reset-date-error" className="text-label font-medium text-destructive">
                {errors.new_due_date}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reset-reason">Reason (optional)</Label>
            <textarea
              id="reset-reason"
              value={reason}
              maxLength={500}
              rows={2}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Reset date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
