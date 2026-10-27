import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { clearOfflineData } from '@/lib/offlineStorage';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LAST_USER_KEY = 'pt-last-user';

function isDifferentUser(id: string): boolean {
  try {
    const last = localStorage.getItem(LAST_USER_KEY);
    return last !== null && last !== id;
  } catch {
    return false;
  }
}

function rememberUser(id: string): void {
  try {
    localStorage.setItem(LAST_USER_KEY, id);
  } catch {
    // Storage blocked: nothing to compare against next time; sign-out still clears the data.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // A session can also end without tapping Sign out (expired or revoked), and a different
      // person can sign in on the same device: in both cases drop the saved data and queue.
      if (event === 'SIGNED_OUT' || (next && isDifferentUser(next.user.id))) void clearOfflineData(queryClient);
      if (next) rememberUser(next.user.id);
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut();
    // Don't leave a copy of the user's data on a shared or lost device.
    await clearOfflineData(queryClient);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
