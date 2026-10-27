import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { NotificationRow, ProfileRow } from '@/lib/database.types';

const INBOX_KEY = (userId?: string) => ['notifications', userId] as const;

/** The in-app notification centre: the latest 50 in-app alerts, newest first. */
export function useInbox() {
  const { user } = useAuth();
  return useQuery({
    queryKey: INBOX_KEY(user?.id),
    enabled: !!supabase && !!user,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase!
        .from('notification_log')
        .select('*')
        .eq('channel', 'in_app')
        .order('sent_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

/** "22:00:00" → "22:00" for <input type="time">. */
export function toTimeInput(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '';
}

export function unreadCount(rows: NotificationRow[] | undefined): number {
  return rows?.filter((r) => !r.read_at).length ?? 0;
}

/** Shows the unread count on the installed app's icon where the browser supports it. */
export function useAppBadge(count: number): void {
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    void (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => {});
    // Signing out unmounts the bell: don't leave the last user's count on the icon.
    return () => void nav.clearAppBadge?.()?.catch(() => {});
  }, [count]);
}

export function useMarkRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase!.from('notification_log').update({ read_at: new Date().toISOString() }).in('id', ids);
      if (error) throw error;
    },
    onMutate: (ids) => {
      const now = new Date().toISOString();
      qc.setQueryData<NotificationRow[]>(INBOX_KEY(user?.id), (rows) =>
        rows?.map((r) => (ids.includes(r.id) && !r.read_at ? { ...r, read_at: now } : r)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: INBOX_KEY(user?.id) }),
  });
}

type ProfilePatch = Partial<
  Pick<ProfileRow, 'push_enabled' | 'email_digest_enabled' | 'in_app_enabled' | 'quiet_hours_start' | 'quiet_hours_end' | 'timezone'>
>;

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { error } = await supabase!.from('profiles').update(patch).eq('id', user!.id);
      if (error) throw error;
    },
    onMutate: (patch) => {
      qc.setQueryData<ProfileRow>(['profile', user?.id], (p) => (p ? { ...p, ...patch } : p));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
  });
}

/** How many devices this user has push turned on for (all of them, not just this one). */
export function usePushDevices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['push-devices', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!.from('push_subscriptions').select('id, endpoint, device_label, created_at');
      if (error) throw error;
      return data;
    },
  });
}
