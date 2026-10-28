import { cn } from '@/lib/utils';

/**
 * The Progress Tracker seal (brand/progress-tracker-logo.svg): a roof over a base line inside a
 * ringed circle, in the app's primary blue. Decorative: the app name always sits beside it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" aria-hidden className={cn('shrink-0', className)}>
      <circle cx="512" cy="512" r="512" fill="#1E40AF" />
      <circle cx="512" cy="512" r="457" fill="none" stroke="#fff" strokeWidth="26" />
      <polyline points="283,525 512,365 741,525" fill="none" stroke="#fff" strokeWidth="58" strokeLinejoin="miter" />
      <rect x="283" y="631" width="458" height="47" fill="#fff" />
    </svg>
  );
}
