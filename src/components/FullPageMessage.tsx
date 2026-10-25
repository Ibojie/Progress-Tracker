import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

export function FullPageMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>
      <div className="glass w-full max-w-lg rounded-lg p-6 sm:p-8" role="status" aria-live="polite">
        <h1 className="text-h2 font-bold">{title}</h1>
        {children && <div className="mt-4 space-y-3">{children}</div>}
      </div>
    </main>
  );
}
