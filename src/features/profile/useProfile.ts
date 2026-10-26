import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TIMEZONE, todayIn } from '@/lib/engine';

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await supabase!.from('profiles').select('*').eq('id', user!.id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useTimezone(): string {
  return useProfile().data?.timezone ?? DEFAULT_TIMEZONE;
}

/** Today's date in the user's timezone (§5: days are counted in the user's timezone). */
export function useToday(): string {
  return todayIn(useTimezone());
}
