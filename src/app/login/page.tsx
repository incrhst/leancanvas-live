"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { MailIcon, CheckCircle2Icon } from "lucide-react";

function safeRedirect(target: string | null): string {
  // Only allow same-origin relative paths
  if (!target || !target.startsWith("/") || target.startsWith("//")) return "/dashboard";
  return target;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  // Google is the way in; email is the fallback for people without a Google account
  const [useEmail, setUseEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectUrl = safeRedirect(searchParams.get("redirect"));
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  // Once signed in (e.g. after the magic link lands back here), continue to the target.
  // Full navigation so API routes like the OAuth authorize screen also work.
  useEffect(() => {
    if (isAuthenticated) window.location.assign(redirectUrl);
  }, [isAuthenticated, redirectUrl]);

  const handleGoogle = async () => {
    setError(null);
    try {
      // Redirects to Google, then back here; the effect above continues to the target.
      await signIn("google", { redirectTo: `/login?redirect=${encodeURIComponent(redirectUrl)}` });
    } catch (err) {
      console.error(err);
      setError("Could not start Google sign-in. Please try again.");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn("resend", {
        email: email.trim().toLowerCase(),
        redirectTo: `/login?redirect=${encodeURIComponent(redirectUrl)}`,
      });
      setSent(true);
    } catch (err) {
      console.error(err);
      setError("Could not send the sign-in link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface border border-line p-8 shadow-sm space-y-6">
      <div className="text-center space-y-1">
        <div className="inline-flex w-10 h-10 rounded-xl bg-accent text-white font-bold items-center justify-center text-lg mb-2">
          LO
        </div>
        <h1 className="text-xl font-bold text-ink">Sign in to CriticalDash</h1>
      </div>

      {sent ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
          <CheckCircle2Icon className="w-8 h-8 text-emerald-600 mx-auto" />
          <div className="text-sm font-semibold text-emerald-900">Check your email</div>
          <p className="text-xs text-emerald-700">
            We sent a sign-in link to <strong>{email}</strong>. Open it on this device to continue.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-ink/20 text-ink rounded-lg text-sm font-semibold hover:bg-canvas transition-colors shadow-sm"
          >
            <GoogleIcon className="w-4 h-4" />
            Continue with Google
          </button>

          {useEmail ? (
            <form onSubmit={handleSignIn} className="space-y-2 pt-2 border-t border-line">
              <label htmlFor="login-email" className="block pt-2 text-xs font-semibold text-ink">
                We&apos;ll email you a sign-in link
              </label>
              <div className="flex gap-2">
                <input
                  id="login-email"
                  type="email"
                  required
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-w-0 flex-1 text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="shrink-0 disabled:opacity-60 inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-surface text-ink rounded-lg text-xs font-semibold hover:bg-surface-2 transition-colors"
                >
                  <MailIcon className="w-3.5 h-3.5" />
                  {submitting ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setUseEmail(true)}
              className="block w-full text-center text-xs text-muted underline underline-offset-2 hover:text-ink"
            >
              Use email instead
            </button>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      )}

      <p className="text-center text-[11px] text-muted">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-ink">Terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">Privacy policy</Link>.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center px-4">
      <Suspense fallback={<div className="text-xs text-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
