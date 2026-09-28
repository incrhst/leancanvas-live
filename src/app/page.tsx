"use client";

import React from "react";
import Link from "next/link";
import { SparklesIcon, ShieldCheckIcon, UsersIcon, ArrowRightIcon } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between selection:bg-incrementic-red selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* The Incrementic Red Badge / Signal */}
            <div className="w-8 h-8 rounded-lg bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-sm shadow-sm">
              LC
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg tracking-tight text-incrementic-ink">
                LeanCanvas Live
              </span>
              <span className="hidden sm:inline font-mono text-[11px] text-muted">
                by Incrementic
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-incrementic-charcoal hover:text-incrementic-red px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-semibold bg-incrementic-ink text-white hover:bg-black px-4 py-2 rounded-lg transition-all shadow-sm"
            >
              Launch Canvas
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section inspired by user uploaded image + Incrementic Red / Halftone */}
      <header className="relative w-full bg-gradient-to-b from-[#EA5148] via-[#E84A41] to-[#D93D34] text-white overflow-hidden py-24 sm:py-32 px-6">
        {/* Halftone dot pattern overlay */}
        <div className="absolute inset-0 bg-halftone pointer-events-none opacity-40 mix-blend-overlay" />
        
        {/* Soft radial glow at bottom center */}
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center space-y-7 z-10 flex flex-col items-center">
          {/* Eyebrow Capsule (matching the pill in inspiration) */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/30 backdrop-blur-md text-white text-xs font-medium hover:bg-white/25 transition-all shadow-sm group"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/90">
              Shape & Ship • Ash Maurya Framework
            </span>
            <div className="w-4 h-4 rounded-full bg-white text-incrementic-red flex items-center justify-center text-[10px] font-bold group-hover:translate-x-0.5 transition-transform">
              →
            </div>
          </Link>

          {/* Punchy Hero Title (Sora font, tight leading) */}
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl md:text-7xl tracking-tight text-white leading-[1.05] max-w-3xl">
            The shortest distance to your next validated business.
          </h1>

          {/* Subtitle */}
          <p className="text-white/90 text-base sm:text-lg max-w-2xl font-normal leading-relaxed">
            Realtime multiplayer Lean Canvas with automated 7-dimension AI stress testing,
            evidence-state claim tracking, and instant anonymous read-only sharing.
          </p>

          {/* Call to Action Button */}
          <div className="pt-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-white text-incrementic-ink font-display font-semibold text-sm hover:bg-white/95 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Start building for free
            </Link>
          </div>
        </div>
      </header>

      {/* Feature Highlights with Incrementic clean grid */}
      <section className="max-w-6xl mx-auto px-6 py-20 w-full space-y-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-incrementic-red">
              01 • Framework
            </span>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-ink mt-1">
              Built for speed, rigor, and clarity.
            </h2>
          </div>
          <p className="text-muted text-xs sm:text-sm max-w-md">
            Cut filler, test riskiest assumptions, and prove market demand before investing capital.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="rounded-2xl bg-surface border border-line p-6 space-y-4 hover:border-incrementic-red/40 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-base text-ink">
                Evidence States on Claims
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Categorize each note as <em>assumption</em>, <em>observed</em>, <em>supported</em>, or <em>contradicted</em>. Never mistake an unproven hypothesis for traction.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl bg-surface border border-line p-6 space-y-4 hover:border-incrementic-red/40 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-incrementic-red flex items-center justify-center font-bold">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-base text-ink">
                7-Dimension AI Stress Engine
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Instant diagnostic on Clarity, Desirability, Viability, Feasibility, Defensibility, Timing, and Mission with concrete recommended experiments.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl bg-surface border border-line p-6 space-y-4 hover:border-incrementic-red/40 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 text-incrementic-charcoal flex items-center justify-center font-bold">
              <UsersIcon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-base text-ink">
                Secure Anonymous View Links
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Share a read-only snapshot with mentors or angels in one click without forcing signups. Keep edits strictly authenticated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer with Incrementic attribution */}
      <footer className="border-t border-line bg-surface px-6 py-8 text-center text-xs text-muted space-y-2">
        <div className="font-medium text-ink">
          LeanCanvas Live • Ash Maurya Lean Startup Framework
        </div>
        <div className="flex items-center justify-center gap-1.5 text-muted">
          <span>A project of</span>
          <a
            href="https://incrementic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-incrementic-red hover:underline transition-colors"
          >
            Incrementic
          </a>
          <span>— The shortest distance to your next big thing.</span>
        </div>
      </footer>
    </div>
  );
}
