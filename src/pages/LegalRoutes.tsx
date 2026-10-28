import { useLocation } from 'react-router-dom';
import { DOCUMENTS } from '@/features/legal/documents';
import { LegalPage } from './LegalPage';

/** Picks the document for the current address (/privacy, /terms, …). */
export function LegalRoute() {
  const slug = useLocation().pathname.replace(/^\//, '');
  const doc = DOCUMENTS.find((d) => d.slug === slug) ?? DOCUMENTS[0]!;
  return <LegalPage doc={doc} />;
}
