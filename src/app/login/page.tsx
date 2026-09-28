"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../components/ConvexClientProvider";
import { MailIcon, ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const { login } = useAuth();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    login(email, name);
    setSent(true);
    setTimeout(() => {
      router.push(redirectUrl);
    }, 1200);
  };

  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface border border-line p-8 shadow-sm space-y-6">
      <div className="text-center space-y-1">
        <div className="inline-flex w-10 h-10 rounded-xl bg-accent text-white font-bold items-center justify-center text-lg mb-2">
          LC
        </div>
        <h1 className="text-xl font-bold text-ink">Sign in to LeanCanvas</h1>
        <p className="text-xs text-muted">
          Enter your email to receive a magic link or start session
        </p>
      </div>

      {sent ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
          <CheckCircle2Icon className="w-8 h-8 text-emerald-600 mx-auto" />
          <div className="text-sm font-semibold text-emerald-900">Signed in!</div>
          <p className="text-xs text-emerald-700">Redirecting to your canvas...</p>
        </div>
      ) : (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Name (optional)</label>
            <input
              type="text"
              placeholder="Alex Kim"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

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

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm"
          >
            <MailIcon className="w-4 h-4" />
            Continue with Magic Link
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
