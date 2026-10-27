import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { unreadCount, useAppBadge, useInbox, useMarkRead } from './api';
import { safePath } from '../../../supabase/functions/notify/messages';

const URGENT = new Set(['overdue', 'abandoned', 'element_abandoned', 'due_today']);

/** Header bell: unread count, and the notification centre (§9 in-app channel). */
export function NotificationBell() {
  const inbox = useInbox();
  const markRead = useMarkRead();
  const [open, setOpen] = useState(false);
  const unread = unreadCount(inbox.data);
  useAppBadge(unread);

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Opening the centre counts as reading what's in it.
    if (!next) {
      const ids = inbox.data?.filter((r) => !r.read_at).map((r) => r.id) ?? [];
      if (ids.length) markRead.mutate(ids);
    }
  }

  const label = unread ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="relative inline-flex min-h-tap min-w-tap items-center justify-center rounded-full hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell aria-hidden className="size-6" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 flex min-w-6 items-center justify-center rounded-full bg-destructive px-1 text-[0.8125rem] font-bold leading-6 text-destructive-foreground"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription className="sr-only">Your latest reminders and alerts.</DialogDescription>
          {inbox.isLoading ? (
            <p role="status" className="mt-4">
              Loading…
            </p>
          ) : !inbox.data?.length ? (
            <div className="mt-6 flex flex-col items-center gap-2 pb-4 text-center text-muted-foreground">
              <BellOff aria-hidden className="size-8" />
              <p>No notifications yet. Reminders appear here at 07:00 when a deadline is coming up.</p>
            </div>
          ) : (
            <ul className="-mx-2 mt-4 grid gap-1">
              {inbox.data.map((n) => (
                <li key={n.id}>
                  <Link
                    to={safePath(n.link)}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'block rounded-md border-l-4 px-3 py-2.5 text-foreground no-underline hover:bg-muted',
                      URGENT.has(n.kind) ? 'border-destructive' : 'border-primary/60',
                      !n.read_at && 'bg-primary/5',
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className={cn('min-w-0', !n.read_at && 'font-semibold')}>{n.title}</span>
                      {!n.read_at && <span className="sr-only">(unread)</span>}
                    </span>
                    {n.body && <span className="mt-0.5 block text-secondary text-muted-foreground">{n.body}</span>}
                    <span className="mt-0.5 block text-label text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(n.sent_at), { addSuffix: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
