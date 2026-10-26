import { ComingSoon, PageHeader } from '@/components/PagePlaceholder';

export function TimelinePage() {
  return (
    <>
      <PageHeader title="Timeline" />
      <ComingSoon phase={3}>A Gantt view of every active goal, coloured by how close its deadline is.</ComingSoon>
    </>
  );
}
