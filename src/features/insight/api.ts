import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { AiSummaryRow } from '@/lib/database.types';

const KEY = (userId?: string) => ['ai-summaries', userId] as const;
const STATUS_KEY = (userId?: string) => ['ai-status', userId] as const;

export interface AiStatus {
  /** The server has an AI key. Without one the insight card never shows (acceptance test 14). */
  configured: boolean;
  /** Refreshes left today, counted by the server. */
  left: number;
}

/** Reads the readable error a function sends back in its JSON body. */
async function functionError(error: unknown): Promise<{ error?: string; left?: number }> {
  return ((await (error as { context?: Response }).context?.json?.().catch(() => null)) ?? {}) as { error?: string; left?: number };
}

/** Asks the server whether the AI is set up. Kept (and saved on the device) so the card doesn't flicker. */
export function useAiStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: STATUS_KEY(user?.id),
    enabled: !!supabase && !!user,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<AiStatus> => {
      const { data, error } = await supabase!.functions.invoke<AiStatus>('ai-summary', { body: { probe: true } });
      // A failed check (offline, function not deployed) counts as "not set up": hide the card.
      if (error || !data) return { configured: false, left: 0 };
      return data;
    },
  });
}

/** The latest insight. */
export function useLatestInsight() {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY(user?.id),
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<AiSummaryRow | null> => {
      const { data, error } = await supabase!.from('ai_summaries').select('*').order('created_at', { ascending: false }).limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

export function useRefreshInsight() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const setLeft = (left: number | undefined, configured = true) => {
    if (left === undefined) return;
    qc.setQueryData<AiStatus>(STATUS_KEY(user?.id), { configured, left });
  };
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase!.functions.invoke<{ left: number }>('ai-summary', { body: {} });
      if (error) {
        const body = await functionError(error);
        if (body.error === 'unavailable') setLeft(0, false);
        else setLeft(body.left);
        throw new Error(body.error === 'unavailable' ? 'The AI insight isn’t available.' : (body.error ?? error.message));
      }
      setLeft(data?.left);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY(user?.id) }),
  });
}
