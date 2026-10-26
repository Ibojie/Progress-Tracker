import { CategoryGrid } from '@/features/categories/CategoryGrid';
import { PageHeader } from '@/components/PagePlaceholder';

export function CategoriesPage() {
  return (
    <>
      <PageHeader title="Categories" description="The four areas of life you track." />
      <CategoryGrid />
    </>
  );
}
