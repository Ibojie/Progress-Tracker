import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GoalInput } from './schemas';

interface GoalFieldsProps {
  idPrefix: string;
  value: GoalInput;
  onChange: (next: GoalInput) => void;
  errors: Record<string, string>;
  /** Prefix for error keys, e.g. "goals.0." */
  errorPrefix?: string;
  showNotes?: boolean;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-label font-medium text-destructive">
      {message}
    </p>
  );
}

/** Title, start date and due date for one goal, with errors next to each field. */
export function GoalFields({ idPrefix, value, onChange, errors, errorPrefix = '', showNotes = false }: GoalFieldsProps) {
  const err = (field: string) => errors[`${errorPrefix}${field}`];
  const set = (patch: Partial<GoalInput>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Goal</Label>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          maxLength={200}
          onChange={(e) => set({ title: e.target.value })}
          aria-invalid={!!err('title')}
          aria-describedby={err('title') ? `${idPrefix}-title-error` : undefined}
        />
        <FieldError id={`${idPrefix}-title-error`} message={err('title')} />
      </div>
      <div className="grid gap-3 min-[420px]:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-start`}>Start date</Label>
          <Input
            id={`${idPrefix}-start`}
            type="date"
            value={value.start_date}
            onChange={(e) => set({ start_date: e.target.value })}
            aria-invalid={!!err('start_date')}
            aria-describedby={err('start_date') ? `${idPrefix}-start-error` : undefined}
          />
          <FieldError id={`${idPrefix}-start-error`} message={err('start_date')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-due`}>Due date</Label>
          <Input
            id={`${idPrefix}-due`}
            type="date"
            min={value.start_date || undefined}
            value={value.due_date}
            onChange={(e) => set({ due_date: e.target.value })}
            aria-invalid={!!err('due_date')}
            aria-describedby={err('due_date') ? `${idPrefix}-due-error` : undefined}
          />
          <FieldError id={`${idPrefix}-due-error`} message={err('due_date')} />
        </div>
      </div>
      {showNotes && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-notes`}>Notes (optional)</Label>
          <textarea
            id={`${idPrefix}-notes`}
            value={value.notes ?? ''}
            maxLength={2000}
            rows={3}
            onChange={(e) => set({ notes: e.target.value })}
            className="w-full rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>
      )}
    </div>
  );
}
