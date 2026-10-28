import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotice } from '@/components/Notice';
import { NEEDS_CONNECTION, useOnline } from '@/lib/useOnline';
import { download, fetchAllData, goalsCsv } from './exportData';

/** Settings → Export (§6.6): everything as JSON, or the goals as a spreadsheet (CSV). */
export function ExportCard() {
  const online = useOnline();
  const { notify } = useNotice();
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null);

  async function run(kind: 'json' | 'csv') {
    setBusy(kind);
    try {
      const data = await fetchAllData();
      const stamp = data.exported_at.slice(0, 10);
      if (kind === 'json') download(`progress-tracker-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
      else download(`progress-tracker-goals-${stamp}.csv`, goalsCsv(data), 'text/csv;charset=utf-8');
    } catch (e) {
      notify(`Couldn’t export your data. ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card id="export">
      <CardHeader>
        <CardTitle>Export your data</CardTitle>
        <CardDescription>
          Download a copy of everything you’ve entered. JSON keeps it all (elements, goals, history, insights); CSV is your
          goals as a spreadsheet for Excel or Google Sheets.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {(['json', 'csv'] as const).map((kind) => (
          <Button
            key={kind}
            variant="outline"
            disabled={!!busy || !online}
            title={online ? undefined : NEEDS_CONNECTION}
            onClick={() => void run(kind)}
          >
            <Download aria-hidden /> {busy === kind ? 'Preparing…' : kind === 'json' ? 'Everything (JSON)' : 'Goals (CSV)'}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
