"use client";

import React from "react";
import Link from "next/link";
import { SparklesIcon, ShieldCheckIcon, UsersIcon, ArrowRightIcon } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-line bg-surface px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent text-white font-bold flex items-center justify-center text-base">
            LC
          </div>
          <span className="font-bold text-lg tracking-tight">LeanCanvas Live</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-ink px-3 py-1.5 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors shadow-sm"
          >
            Go to Canvas
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 py-16 text-center space-y-8 flex-1 flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-semibold">
          <SparklesIcon className="w-3.5 h-3.5" />
          Powered by Convex Realtime + AI Stress Engine
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-ink max-w-3xl leading-tight">
          Battle-test your business model in <span className="text-accent">realtime</span>.
        </h1>

        <p className="text-muted text-base sm:text-lg max-w-2xl leading-relaxed">
          The collaborative Lean Canvas tool built for speed. Realtime multiplayer editing,
          granular evidence tracking, anonymous read-only sharing, and instant Ash Maurya stress tests.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-ink text-surface font-semibold hover:bg-ink/90 shadow-md transition-all"
          >
            Start your Canvas
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl bg-surface border border-line font-medium text-ink hover:bg-surface-2 transition-all"
          >
            Magic Link Access
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left w-full">
          <div className="p-5 rounded-2xl bg-surface border border-line space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base">Evidence-State Tracking</h3>
            <p className="text-xs text-muted leading-relaxed">
              Tag claims as assumptions, observed, supported, or contradicted. Turn hunches into empirical milestones.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-line space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base">7-Dimension AI Stress Test</h3>
            <p className="text-xs text-muted leading-relaxed">
              Score clarity, viability, and defensibility. Spot lethal unexamined assumptions before spending capital.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-line space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
              <UsersIcon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base">Anonymous Public Share</h3>
            <p className="text-xs text-muted leading-relaxed">
              Share view-only links with investors or mentors without forcing login. Keep editing strictly authenticated.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface px-6 py-4 text-center text-xs text-muted space-y-1">
        <div>LeanCanvas Live • Built with Next.js 15, Convex & Ash Maurya&apos;s Lean Methodology</div>
        <div>
          A project of{" "}
          <a
            href="https://incrementic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink underline hover:text-accent transition-colors"
          >
            Incrementic
          </a>
        </div>
      </footer>
    </div>
  );
}
