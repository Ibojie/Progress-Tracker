import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PagePlaceholder';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Link to="/" className="font-semibold text-primary underline">
        Go to the dashboard
      </Link>
    </>
  );
}
