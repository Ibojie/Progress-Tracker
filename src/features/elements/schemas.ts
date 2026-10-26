import { z } from 'zod';

export const MAX_GOALS = 10;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.');

export const goalInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the goal a title.').max(200, 'Keep the title under 200 characters.'),
    notes: z.string().trim().max(2000, 'Keep notes under 2,000 characters.').optional().default(''),
    start_date: isoDate,
    due_date: isoDate,
  })
  .refine((g) => g.due_date >= g.start_date, {
    message: 'The due date can’t be before the start date.',
    path: ['due_date'],
  });

export type GoalInput = z.input<typeof goalInputSchema>;

export const elementInputSchema = z.object({
  category_id: z.string().uuid('Choose a category.'),
  name: z.string().trim().min(1, 'Give the element a name.').max(120, 'Keep the name under 120 characters.'),
  description: z.string().trim().max(2000, 'Keep the description under 2,000 characters.').optional().default(''),
});

export const newElementSchema = elementInputSchema.extend({
  goals: z
    .array(goalInputSchema)
    .min(1, 'Add at least one goal.')
    .max(MAX_GOALS, `An element can have at most ${MAX_GOALS} goals.`),
});

export type NewElementInput = z.input<typeof newElementSchema>;

/** First error message per field path, e.g. { 'goals.0.title': '…' }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export const resetDateSchema = (today: string) =>
  z.object({
    new_due_date: isoDate.refine((d) => d > today, 'Pick a date after today.'),
    reason: z.string().trim().max(500, 'Keep the reason under 500 characters.').optional().default(''),
  });
