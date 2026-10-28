import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Mail, Target } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";

// A light check (the sign-in link is the real proof); no zod on the first screen, for speed.
function checkEmail(
  value: string,
): { ok: true; email: string } | { ok: false; message: string } {
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
    ? { ok: true, email }
    : {
        ok: false,
        message: "Enter a valid email address, like name@example.com.",
      };
}

function redirectUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export function LoginPage() {
  const { session } = useAuth();
  // A message passed along from another screen, e.g. after deleting an account.
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function sendMagicLink(e: FormEvent) {
    e.preventDefault();
    const parsed = checkEmail(email);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: parsed.email,
      options: { emailRedirectTo: redirectUrl() },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSentTo(parsed.email);
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl() },
    });
    if (err) setError(err.message);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>
      <div className="glass w-full max-w-md rounded-lg p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Target aria-hidden className="size-6" />
          </span>
          <div>
            <h1 className="text-h2 font-bold leading-tight">
              Progress Tracker
            </h1>
            <p className="text-secondary text-muted-foreground">
              Never miss a deadline again.
            </p>
          </div>
        </div>

        {notice && (
          <p
            role="status"
            className="mb-4 rounded-md border border-border/70 bg-surface/70 px-4 py-3"
          >
            {notice}
          </p>
        )}

        {sentTo ? (
          <div role="status" className="space-y-3">
            <h2 className="text-h3 font-semibold">Check your email</h2>
            <p>
              We sent a sign-in link to <strong>{sentTo}</strong>. Open it on
              this device to sign in.
            </p>
            <Button
              variant="link"
              className="px-0"
              onClick={() => setSentTo(null)}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={sendMagicLink} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={busy}
              >
                <Mail aria-hidden />
                {busy ? "Sending link…" : "Email me a sign-in link"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-label text-muted-foreground">
              <span className="h-px flex-1 bg-border/60" />
              or
              <span className="h-px flex-1 bg-border/60" />
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={signInWithGoogle}
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-5">
                <path
                  fill="#4285F4"
                  d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"
                />
              </svg>
              Continue with Google
            </Button>
          </>
        )}

        {error && (
          <p
            id="login-error"
            role="alert"
            className="mt-4 text-secondary font-medium text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
