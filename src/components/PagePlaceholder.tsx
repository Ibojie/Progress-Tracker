import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-h1 font-bold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-lead text-muted-foreground">{description}</p>}
    </header>
  );
}

export function ComingSoon({ phase, children }: { phase: number; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coming in Phase {phase}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
