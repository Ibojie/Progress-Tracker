import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_ICON } from './categoryMeta';
import { useCategories } from './useCategories';

export function CategoryGrid() {
  const { data, isLoading, error } = useCategories();

  if (isLoading) return <p role="status">Loading your categories…</p>;
  if (error) {
    return (
      <p role="alert" className="font-medium text-destructive">
        Couldn't load categories: {error.message}
      </p>
    );
  }
  if (!data?.length) {
    return (
      <p role="status" className="text-muted-foreground">
        No categories yet. They are created when your account is set up. If this stays empty, the database migrations
        haven't been applied.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
      {data.map((c) => {
        const Icon = CATEGORY_ICON[c.key];
        return (
          <li key={c.id}>
            <Card className="h-full">
              <CardHeader>
                <span className="mb-2 flex size-11 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Icon aria-hidden className="size-6" />
                </span>
                <CardTitle className="text-[1.25rem]">{c.name}</CardTitle>
                <CardDescription>No elements yet</CardDescription>
              </CardHeader>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
