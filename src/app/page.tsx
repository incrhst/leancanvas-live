"use client";

import React from "react";
import Link from "next/link";
import {
  SparklesIcon,
  UsersIcon,
  LayoutGridIcon,
  SmartphoneIcon,
  CheckCircle2Icon,
  ClockIcon,
  FlaskConicalIcon,
  BotIcon,
  HistoryIcon,
} from "lucide-react";

const STEPS = [
  {
    icon: LayoutGridIcon,
    title: "Put the plan on one canvas",
    body:
      "Lean or go-to-market blocks. Every note says how sure you are, from assumption to decided, and can carry a test: what you'll measure, the pass mark and the date you'll look.",
  },
  {
    icon: SmartphoneIcon,
    title: "Ask the decider one question",
    body:
      "Two to four choices, a due date, and what happens if nobody decides. They get a link and answer on their phone. No account, no sign-in.",
  },
  {
    icon: CheckCircle2Icon,
    title: "The plan keeps moving",
    body:
      "The answer lands on the note, marked decided, with who answered and when. Nobody has to open a document or wait for the next meeting.",
  },
];

const FEATURES = [
  {
    icon: ClockIcon,
    tint: "bg-red-50 border-red-200 text-incrementic-red",
    title: "The default is always visible",
    body:
      "Every open decision says what happens if nobody decides, and by when. It shows on the note, the link and the review, so a decision never slides by without anyone noticing.",
  },
  {
    icon: FlaskConicalIcon,
    tint: "bg-amber-50 border-amber-200 text-amber-800",
    title: "Tests agreed before the results",
    body:
      "Set the measure and the pass mark up front. The review page shows what was met, what was missed and what is overdue. Each Monday, every driver is asked for new evidence on their notes.",
  },
  {
    icon: SparklesIcon,
    tint: "bg-violet-50 border-violet-200 text-violet-800",
    title: "A stress test before you commit",
    body:
      "AI scores the canvas on seven dimensions and lists the riskiest assumptions, each with an experiment to run next.",
  },
  {
    icon: UsersIcon,
    tint: "bg-stone-100 border-stone-200 text-incrementic-charcoal",
    title: "Share without sign-ups",
    body:
      "Send mentors, investors or your team a read-only link to the plan. Add a password if you want one. Editing stays with the people you invite.",
  },
  {
    icon: BotIcon,
    tint: "bg-sky-50 border-sky-200 text-sky-800",
    title: "Works with your AI",
    body:
      "Connect Claude and it can read the canvas, add notes, record results and ask for decisions, with every change marked as made by your AI.",
  },
  {
    icon: HistoryIcon,
    tint: "bg-emerald-50 border-emerald-200 text-emerald-800",
    title: "Snapshots and history",
    body:
      "Freeze the canvas at day 30 and compare it later. Every change to a note records who made it, when and why.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between selection:bg-incrementic-red selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* The Incrementic Red Badge / Signal */}
            <div className="w-8 h-8 rounded-lg bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-sm shadow-sm">
              LO
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg tracking-tight text-incrementic-ink">
                LeanOn
              </span>
              <span className="hidden sm:inline font-mono text-[11px] text-muted">
                by Incrementic
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="whitespace-nowrap text-xs font-semibold text-incrementic-charcoal hover:text-incrementic-red px-3 py-1.5 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="whitespace-nowrap text-xs font-semibold bg-incrementic-ink text-white hover:bg-black px-4 py-2 rounded-lg transition-all shadow-sm"
            >
              Your canvases
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative w-full bg-gradient-to-b from-[#EA5148] via-[#E84A41] to-[#D93D34] text-white overflow-hidden py-20 sm:py-28 px-6">
        {/* Halftone dot pattern overlay */}
        <div className="absolute inset-0 bg-halftone pointer-events-none opacity-40 mix-blend-overlay" />

        {/* Soft radial glow at bottom center */}
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-6xl mx-auto z-10 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="space-y-7 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/15 border border-white/30 backdrop-blur-md font-mono text-[11px] uppercase tracking-wider text-white/90">
              Lean and go-to-market plans
            </span>

            <h1 className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight text-white leading-[1.05]">
              Plans don&rsquo;t fail in meetings. They stall between them.
            </h1>

            <p className="text-white/90 text-base sm:text-lg max-w-xl font-normal leading-relaxed">
              The person who decides rarely opens the plan. LeanOn sends them one question, with what
              happens if they don&rsquo;t answer. They tap an answer on their phone, with no login, and
              the plan keeps moving.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center whitespace-nowrap px-8 py-3.5 rounded-full bg-white text-incrementic-ink font-display font-semibold text-sm hover:bg-white/95 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Start a canvas, free
              </Link>
              <span className="text-xs text-white/80">
                For consultants, fractional execs, agency leads and founders.
              </span>
            </div>
          </div>

          {/* What the decider sees */}
          <div className="w-full max-w-sm mx-auto" aria-label="Example: what the decider sees on their phone">
            <div className="rounded-[2rem] bg-incrementic-ink p-3 shadow-2xl">
              <div className="rounded-[1.5rem] bg-white text-incrementic-ink p-5 space-y-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-stone-500">
                  One question for you · due 1 November
                </div>
                <p className="font-display font-bold text-xl leading-snug">Agency or in-house?</p>
                <p className="rounded-xl bg-red-50 border border-red-200 text-[13px] leading-snug text-incrementic-red px-3 py-2.5">
                  If nothing is decided by 1 November, we sign the agency.
                </p>
                <div className="space-y-2">
                  {["Sign the agency", "Build in-house"].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-center"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="text-center text-xs text-stone-600 underline underline-offset-2">
                  Something else? Ask for a change
                </div>
                <div className="text-center text-[11px] text-stone-500">No account needed</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-8 w-full space-y-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-incrementic-red">
              01 • How it works
            </span>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-ink mt-1">
              The canvas is the plan. Nobody needs a separate document.
            </h2>
          </div>
          <p className="text-muted text-xs sm:text-sm max-w-md">
            You run the plan. The decider answers one question at a time. Drivers keep the evidence
            coming.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-2xl bg-surface border border-line p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-incrementic-red flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-base text-ink">{title}</h3>
                <p className="text-xs text-muted leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What's in it */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full space-y-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-incrementic-red">
              02 • What&rsquo;s in it
            </span>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-ink mt-1">
              Everything the operator needs. Nothing extra for anyone else.
            </h2>
          </div>
          <p className="text-muted text-xs sm:text-sm max-w-md">
            No task boards, sprints or story points. Just what you believe, how you&rsquo;ll test it,
            and who decides.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, tint, title, body }) => (
            <div
              key={title}
              className="rounded-2xl bg-surface border border-line p-6 space-y-4 hover:border-incrementic-red/40 transition-colors shadow-sm"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${tint}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-base text-ink">{title}</h3>
                <p className="text-xs text-muted leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing call to action */}
      <section className="px-6 pb-20 w-full">
        <div className="max-w-6xl mx-auto rounded-3xl bg-incrementic-ink text-white px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <h2 className="font-display font-bold text-2xl sm:text-3xl">Decisions get made.</h2>
            <p className="text-sm text-white/75 max-w-lg">
              Start with the plan you already have. Ask your first question today.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-incrementic-red text-white font-display font-semibold text-sm hover:bg-[#D93D34] shadow-lg transition-all shrink-0"
          >
            Start a canvas, free
          </Link>
        </div>
      </section>

      {/* Footer with Incrementic attribution */}
      <footer className="border-t border-line bg-surface px-6 py-8 text-center text-xs text-muted space-y-2">
        <div className="font-medium text-ink">LeanOn • Lean and go-to-market canvases</div>
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
