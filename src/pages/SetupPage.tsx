import { FullPageMessage } from '@/components/FullPageMessage';

/** Shown when the Supabase env vars are missing, so a bare build still runs. */
export function SetupPage() {
  return (
    <FullPageMessage title="Almost ready">
      <p>The app isn't connected to its database yet.</p>
      <p className="text-secondary text-muted-foreground">
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code> (or in
        the Vercel project settings), then restart or redeploy.
      </p>
    </FullPageMessage>
  );
}
