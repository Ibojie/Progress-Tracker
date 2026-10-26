import { ComingSoon, PageHeader } from '@/components/PagePlaceholder';

export function NewElementPage() {
  return (
    <>
      <PageHeader title="New element" />
      <ComingSoon phase={2}>
        A three-step wizard: pick a category and name, add 1 to 10 goals with dates, then review and save.
      </ComingSoon>
    </>
  );
}
