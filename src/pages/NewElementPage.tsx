import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PagePlaceholder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CATEGORY_ICON } from '@/features/categories/categoryMeta';
import { useCategories } from '@/features/categories/useCategories';
import { useToday } from '@/features/profile/useProfile';
import { useCreateElement } from '@/features/elements/api';
import { GoalFields } from '@/features/elements/GoalFields';
import { StatusPill } from '@/features/elements/StatusPill';
import { formatDate } from '@/features/elements/model';
import { MAX_GOALS, elementInputSchema, fieldErrors, goalInputSchema, newElementSchema, type GoalInput } from '@/features/elements/schemas';
import { TEMPLATES, type ElementTemplate } from '@/features/elements/templates';
import { addDays, completion, resolveElementStatus } from '@/lib/engine';
import { cn } from '@/lib/utils';

const STEPS = ['Category and name', 'Goals', 'Review'] as const;

export function NewElementPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = useToday();
  const categories = useCategories();
  const create = useCreateElement();

  const blankGoal = (): GoalInput => ({ title: '', notes: '', start_date: today, due_date: addDays(today, 30) });
  const initialCategory = categories.data?.find((c) => c.key === params.get('category'))?.id ?? '';

  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState<GoalInput[]>(() => [blankGoal()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Categories load after the first render; adopt the ?category= choice once they arrive.
  const chosenCategoryId = categoryId || initialCategory;
  const category = categories.data?.find((c) => c.id === chosenCategoryId);
  const templates = TEMPLATES.filter((t) => !category || t.category === category.key);

  function applyTemplate(t: ElementTemplate) {
    const cat = categories.data?.find((c) => c.key === t.category);
    if (cat) setCategoryId(cat.id);
    setName(t.name);
    setDescription(t.description ?? '');
    setGoals(t.goals.map((g) => ({ title: g.title, notes: '', start_date: today, due_date: addDays(today, g.dueInDays) })));
    setErrors({});
  }

  function next() {
    if (step === 0) {
      const r = elementInputSchema.safeParse({ category_id: chosenCategoryId, name, description });
      if (!r.success) return setErrors(fieldErrors(r.error));
    }
    if (step === 1) {
      const r = newElementSchema.shape.goals.safeParse(goals);
      if (!r.success) return setErrors(prefixed(fieldErrors(r.error), 'goals.'));
    }
    setErrors({});
    setStep((s) => s + 1);
  }

  function save() {
    const r = newElementSchema.safeParse({ category_id: chosenCategoryId, name, description, goals });
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    create.mutate(r.data, { onSuccess: (id) => navigate(`/elements/${id}`, { replace: true }) });
  }

  const preview = (() => {
    const parsed = goals.map((g) => goalInputSchema.safeParse(g));
    if (!parsed.every((p) => p.success)) return null;
    const engineGoals = goals.map((g, i) => ({ id: String(i), isDone: false, startDate: g.start_date, dueDate: g.due_date, tickChangedAt: null }));
    const element = { isDecommissioned: false, zeroProgressStatus: 'not_started' as const, recommissionedAt: null, restartedAt: null };
    return { status: resolveElementStatus(element, engineGoals, today), pct: completion(engineGoals).pct };
  })();

  return (
    <>
      <PageHeader title="New element" description="Something to track, and the goals that complete it." />

      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'rounded-md border px-3 py-2 text-label font-semibold',
              i === step ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground',
            )}
          >
            <span className="block">Step {i + 1}</span>
            <span className="font-normal max-[480px]:sr-only">{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Category</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset>
                <legend className="sr-only">Category</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.data?.map((c) => {
                    const Icon = CATEGORY_ICON[c.key];
                    const checked = c.id === chosenCategoryId;
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          'flex min-h-tap cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-surface/60 px-4 py-3 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                          checked && 'border-primary bg-primary/10 ring-1 ring-primary',
                        )}
                      >
                        <input type="radio" name="category" value={c.id} checked={checked} onChange={() => setCategoryId(c.id)} className="sr-only" />
                        <Icon aria-hidden className="size-5" />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {errors.category_id && <p className="mt-2 text-label font-medium text-destructive">{errors.category_id}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Name</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="element-name">Element name</Label>
                <Input
                  id="element-name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'element-name-error' : undefined}
                />
                {errors.name && (
                  <p id="element-name-error" className="text-label font-medium text-destructive">
                    {errors.name}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="element-description">Description (optional)</Label>
                <textarea
                  id="element-description"
                  value={description}
                  maxLength={2000}
                  rows={2}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles aria-hidden className="size-5 text-primary" /> Quick templates
              </CardTitle>
              <p className="text-secondary text-muted-foreground">Fills in the name and suggested goals. You can change everything after.</p>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <li key={t.name}>
                    <Button type="button" variant="outline" onClick={() => applyTemplate(t)}>
                      {t.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4">
          <p className="text-secondary text-muted-foreground">
            Add 1 to {MAX_GOALS} goals. Each one is worth an equal share of the element’s progress.
          </p>
          {goals.map((g, i) => (
            <Card key={i}>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-[1.25rem]">Goal {i + 1}</CardTitle>
                {goals.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove goal ${i + 1}`}
                    onClick={() => setGoals((gs) => gs.filter((_, j) => j !== i))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <GoalFields
                  idPrefix={`goal-${i}`}
                  value={g}
                  onChange={(next) => setGoals((gs) => gs.map((x, j) => (j === i ? next : x)))}
                  errors={errors}
                  errorPrefix={`goals.${i}.`}
                />
              </CardContent>
            </Card>
          ))}
          {errors.goals && <p className="text-label font-medium text-destructive">{errors.goals}</p>}
          <Button
            type="button"
            variant="outline"
            disabled={goals.length >= MAX_GOALS}
            onClick={() => setGoals((gs) => [...gs, blankGoal()])}
          >
            <Plus aria-hidden />
            {goals.length >= MAX_GOALS ? `Maximum of ${MAX_GOALS} goals reached` : 'Add another goal'}
          </Button>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <p className="text-label font-semibold uppercase tracking-wide text-muted-foreground">{category?.name}</p>
            <CardTitle>{name.trim()}</CardTitle>
            {description.trim() && <p className="text-secondary text-muted-foreground">{description.trim()}</p>}
            {preview && (
              <div className="pt-2">
                <span className="mr-2 text-secondary">Starts as</span>
                <StatusPill status={preview.status} pct={preview.pct} />
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3">
              {goals.map((g, i) => (
                <li key={i} className="rounded-md border border-border/60 bg-surface/60 p-3">
                  <p className="font-semibold">{g.title.trim()}</p>
                  <p className="text-secondary text-muted-foreground">
                    {formatDate(g.start_date)} → {formatDate(g.due_date)}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={() => (step === 0 ? navigate(-1) : setStep((s) => s - 1))}>
          <ArrowLeft aria-hidden />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < 2 ? (
          <Button onClick={next}>
            Next <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button variant="accent" onClick={save} disabled={create.isPending}>
            <Check aria-hidden />
            {create.isPending ? 'Saving…' : 'Save element'}
          </Button>
        )}
      </div>
    </>
  );
}

function prefixed(errors: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k ? `${prefix}${k}` : prefix.slice(0, -1), v]));
}
