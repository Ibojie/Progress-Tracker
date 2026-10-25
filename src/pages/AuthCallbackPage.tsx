import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { FullPageMessage } from '@/components/FullPageMessage';

/** Supabase exchanges the ?code= for a session automatically (detectSessionInUrl). */
export function AuthCallbackPage() {
  const { session } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const errorText = new URLSearchParams(window.location.search).get('error_description');

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 10000);
    return () => window.clearTimeout(t);
  }, []);

  if (session) return <Navigate to="/" replace />;
  if (errorText || timedOut) {
    return (
      <FullPageMessage title="Sign-in didn't finish">
        <p>{errorText ?? 'The link may have expired or was opened in a different browser.'}</p>
        <Link to="/login" className="font-semibold text-primary underline">
          Back to sign in
        </Link>
      </FullPageMessage>
    );
  }
  return <FullPageMessage title="Signing you in…" />;
}
