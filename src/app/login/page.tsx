"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { MailIcon, ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

function safeRedirect(target: string | null): string {
  // Only allow same-origin relative paths
  if (!target || !target.startsWith("/") || target.startsWith("//")) return "/dashboard";
  return target;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
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
          LC
        </div>
        <h1 className="text-xl font-bold text-ink">Sign in to LeanCanvas</h1>
        <p className="text-xs text-muted">
          Enter your email and we&apos;ll send you a magic sign-in link
        </p>
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
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Email Address</label>
            <input
              type="email"
              required
              placeholder="alex@startup.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full disabled:opacity-60 flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm"
          >
            <MailIcon className="w-4 h-4" />
            {submitting ? "Sending link..." : "Continue with Magic Link"}
          </button>
        </form>
      )}
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
