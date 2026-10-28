import { Link } from 'react-router-dom';
import { DOCUMENTS } from './documents';
import { cn } from '@/lib/utils';

/** Links to every legal document (sign-in footer, Settings). */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={className}>
      <ul className={cn('flex flex-wrap gap-x-5 gap-y-1')}>
        {DOCUMENTS.map((d) => (
          <li key={d.slug}>
            <Link to={`/${d.slug}`} className="inline-flex min-h-tap items-center">
              {d.slug === 'account-deletion' ? 'Delete your account' : d.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
