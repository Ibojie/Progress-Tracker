import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useNotice } from '@/components/Notice';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { clearOfflineData } from '@/lib/offlineStorage';
import { NEEDS_CONNECTION, useOnline } from '@/lib/useOnline';
import { forgetDevicePush } from '@/features/notifications/push';

const WORD = 'DELETE';

/**
 * Settings → Delete my account (Google Play requires in-app deletion). Removes the account and
 * every row it owns (the database cascades from the auth user), then signs out on this device.
 */
export function DeleteAccountCard() {
  const inputId = useId();
  const navigate = useNavigate();
  const online = useOnline();
  const { notify } = useNotice();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!supabase || typed !== WORD) return;
    setBusy(true);
    const { error } = await supabase.rpc('delete_my_account', { p_confirm: typed });
    if (error) {
      setBusy(false);
      notify(`Couldn’t delete your account. ${error.message}`);
      return;
    }
    // The account is gone: tidy this device without asking the server again.
    await forgetDevicePush().catch(() => {});
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    await clearOfflineData(queryClient);
    navigate('/login', { replace: true, state: { notice: 'Your account and all its data have been deleted.' } });
  }

  return (
    <Card id="delete-account" className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 aria-hidden className="size-5 text-destructive" /> Delete my account
        </CardTitle>
        <CardDescription>
          Permanently deletes your account and everything in it: elements, goals, history, insights, notifications and push
          devices. This can’t be undone. You may want to <a href="#export">export your data</a> first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          disabled={!online}
          title={online ? undefined : NEEDS_CONNECTION}
          onClick={() => {
            setTyped('');
            setOpen(true);
          }}
        >
          <Trash2 aria-hidden /> Delete my account
        </Button>
      </CardContent>

      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title="Delete your account for good?"
        confirmLabel={busy ? 'Deleting…' : 'Delete everything'}
        destructive
        busy={busy || typed !== WORD || !online}
        onConfirm={() => void remove()}
      >
        <p>
          Your account, every element and goal, your history, insights and notifications will be deleted straight away. There
          is no way to get them back.
        </p>
        <div className="mt-4 grid gap-1.5">
          <Label htmlFor={inputId}>Type {WORD} to confirm</Label>
          <Input
            id={inputId}
            value={typed}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value.trim())}
          />
        </div>
      </ConfirmDialog>
    </Card>
  );
}
