"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  BotIcon,
  CheckCheckIcon,
  FlaskConicalIcon,
  HandshakeIcon,
  HeartHandshakeIcon,
  HistoryIcon,
  LightbulbIcon,
  ListChecksIcon,
  MegaphoneIcon,
  PackageCheckIcon,
  ReceiptIcon,
  RefreshCwIcon,
  RepeatIcon,
  ShieldCheckIcon,
  ShuffleIcon,
  SirenIcon,
  SmartphoneIcon,
  UserMinusIcon,
  WalletIcon,
  WrenchIcon,
} from "lucide-react";

/** The exposure. Every figure is from a cited source; keep it that way. */
const EXPOSURE = [
  {
    figure: "42%",
    body: "of what a company knows lives with one person. When they leave, it leaves with them.",
    source: "Panopto and YouGov, 1,001 US workers",
    href: "https://panopto.com/?p=2088",
  },
  {
    figure: "~3x",
    body: "slower recovery when the team improvises instead of following a playbook written in advance.",
    source: "Google, Site Reliability Engineering",
    href: "https://sre.google/sre-book/introduction/",
  },
  {
    figure: "11% → 7%",
    body: "major complications after surgery, once teams switched from memory to a written checklist.",
    source: "Haynes, Gawande et al., NEJM 2009, 7,688 patients",
    href: "https://news.harvard.edu/gazette/story/2009/01/surgical-safety-checklist-drops-deaths-and-complications-by-more-than-one-third/",
  },
  {
    figure: "61%",
    body: "of managers say at least half the time they spend deciding is wasted.",
    source: "McKinsey survey of 1,200+ managers, 2018",
    href: "https://www.mckinsey.com/capabilities/people-and-organization/our-insights/three-keys-to-faster-better-decisions",
  },
];

/** Where the risk sits today, in ordinary weeks. */
const HIDDEN_RISKS = [
  {
    icon: UserMinusIcon,
    title: "Your best operator hands in their notice",
    body: "The supplier choice, the refund rule, the discount limit, the fix for last month's outage. All of it was in their head.",
  },
  {
    icon: SirenIcon,
    title: "The same failure, improvised again",
    body: "You solved it last quarter. Nobody kept the steps, so the clock starts from zero while customers wait.",
  },
  {
    icon: AlertTriangleIcon,
    title: "A guess gets scaled as if it were proven",
    body: "The channel worked once. Now the whole team runs it, and nobody checked whether it works twice.",
  },
  {
    icon: ShuffleIcon,
    title: "Three customers, three different answers",
    body: "Support, sales and finance each remember the policy differently. One of them is wrong, and it's in writing.",
  },
  {
    icon: RefreshCwIcon,
    title: "Settled questions come back from the dead",
    body: "Nobody wrote down why you chose the price in March. So you lose another month re-arguing it.",
  },
  {
    icon: HistoryIcon,
    title: "Nobody checks whether it worked",
    body: "Calls get made and forgotten. Luck gets credited as skill, and the bad call gets copied.",
  },
];

/** The four stages from guess to runbook, and what's at risk at each. */
const STAGES = [
  {
    icon: LightbulbIcon,
    name: "Hypothesis",
    risk: "Untested",
    riskTint: "border-rose-300 bg-rose-50 text-rose-800",
    body: "A canvas box as a guess: “event organisers will pay per ticket”.",
  },
  {
    icon: FlaskConicalIcon,
    name: "Experiment",
    risk: "Being tested",
    riskTint: "border-amber-300 bg-amber-50 text-amber-900",
    body: "Tested by hand, pass mark agreed up front, the call recorded with its reason.",
  },
  {
    icon: RepeatIcon,
    name: "Repeatable play",
    risk: "Proven, in a few heads",
    riskTint: "border-teal-300 bg-teal-50 text-teal-900",
    body: "It worked more than once. The steps and rough numbers are written down.",
  },
  {
    icon: BookOpenCheckIcon,
    name: "Runbook → SOP",
    risk: "Under control",
    riskTint: "border-emerald-300 bg-emerald-50 text-emerald-900",
    body: "Anyone, or an agent, can run it and get the same result. An SOP forms above it.",
  },
];

/** Each canvas box becomes a family of runbooks, and each family closes a specific risk. */
const FAMILIES = [
  {
    icon: MegaphoneIcon,
    box: "Customer segments + channels",
    runbooks: "Outbound sequence, event follow-up, referral ask, partner intro",
    risk: "Pipeline that dries up when one person stops chasing",
  },
  {
    icon: HeartHandshakeIcon,
    box: "Customer relationships",
    runbooks: "Onboarding, check-ins, renewal, win-back",
    risk: "Churn nobody saw coming",
  },
  {
    icon: PackageCheckIcon,
    box: "Value proposition",
    runbooks: "The delivery steps that produce the promised outcome",
    risk: "A promise only your best people can keep",
  },
  {
    icon: ListChecksIcon,
    box: "Key activities",
    runbooks: "The list of runbooks you need to write",
    risk: "A key activity with no runbook lives only in someone's head",
  },
  {
    icon: HandshakeIcon,
    box: "Key resources + partners",
    runbooks: "Vendor setup, partner handoffs, what to do when a critical resource fails",
    risk: "No plan B when a supplier or system goes down",
  },
  {
    icon: ReceiptIcon,
    box: "Revenue streams",
    runbooks: "Quoting, invoicing, collections, pricing changes",
    risk: "Cash stuck in unsent invoices and side deals",
  },
  {
    icon: WalletIcon,
    box: "Cost structure",
    runbooks: "Monthly cost review, vendor renegotiation, tool audit",
    risk: "Costs that creep for months before anyone looks",
  },
];

type Quote = { text: string; who: string; credit?: React.ReactNode };

const TYSON: Quote = { text: "Everybody has a plan until they get punched in the mouth.", who: "Mike Tyson" };
const BEZOS: Quote = {
  text: "Good intentions never work, you need good mechanisms to make anything happen.",
  who: "Jeff Bezos",
};

/**
 * The argument in four stages. Each pairs a household name with a respected expert,
 * and the headings read in order make the case on their own. Keep wording and attributions exact.
 */
const QUOTE_STAGES: { heading: string; stage: string; quotes: [Quote, Quote] }[] = [
  {
    heading: "Your business model is a guess",
    stage: "Hypothesis",
    quotes: [
      TYSON,
      {
        text: "A startup is a temporary organization designed to search for a repeatable and scalable business model.",
        who: "Steve Blank",
        credit: (
          <>
            Silicon Valley entrepreneur, Stanford lecturer and co-author of <i>The Startup Owner&rsquo;s Manual</i>
          </>
        ),
      },
    ],
  },
  {
    heading: "Do it by hand before you systemise it",
    stage: "Experiment",
    quotes: [
      { text: "Genius is one percent inspiration, ninety-nine percent perspiration.", who: "Thomas Edison" },
      {
        text: "Do things that don't scale.",
        who: "Paul Graham",
        credit: "co-founder of Y Combinator, the accelerator behind Airbnb, Dropbox and Stripe",
      },
    ],
  },
  {
    heading: "Ship, then learn from what happens",
    stage: "Repeatable play",
    quotes: [
      { text: "Real artists ship.", who: "Steve Jobs" },
      {
        text: "The only way to win is to learn faster than anyone else.",
        who: "Eric Ries",
        credit: (
          <>
            author of <i>The Lean Startup</i>
          </>
        ),
      },
    ],
  },
  {
    heading: "Turn what works into mechanisms",
    stage: "Runbook → SOP",
    quotes: [
      BEZOS,
      {
        text: "Civilization advances by extending the number of important operations which we can perform without thinking about them.",
        who: "Alfred North Whitehead",
        credit: (
          <>
            British mathematician and philosopher, co-author of <i>Principia Mathematica</i>
          </>
        ),
      },
    ],
  },
];

/** One quote, attributed. `tone` switches between the red hero and the light page. */
function QuoteBlock({ q, tone = "light" }: { q: Quote; tone?: "light" | "hero" }) {
  const hero = tone === "hero";
  return (
    <figure className="space-y-2">
      <blockquote
        className={`font-display leading-snug ${hero ? "text-white text-lg sm:text-xl font-semibold" : "text-ink text-[15px] font-semibold"}`}
      >
        &ldquo;{q.text}&rdquo;
      </blockquote>
      <figcaption className={`text-xs leading-snug ${hero ? "text-white/80" : "text-muted"}`}>
        <span className={`font-semibold ${hero ? "text-white" : "text-ink"}`}>{q.who}</span>
        {q.credit && <>, {q.credit}</>}
      </figcaption>
    </figure>
  );
}

const CONTROLS = [
  {
    icon: ListChecksIcon,
    tint: "bg-red-50 border-red-200 text-incrementic-red",
    title: "Needs you",
    body: "Calls about to go overdue, test results that are in, decisions ready to look back on. Nothing slips by unnoticed.",
  },
  {
    icon: CheckCheckIcon,
    tint: "bg-teal-50 border-teal-200 text-teal-800",
    title: "A record for every decision",
    body: "What was chosen, the basis (a test, data, an expert, or a judgment call), who decided and when. Old calls are kept, never overwritten.",
  },
  {
    icon: HistoryIcon,
    tint: "bg-violet-50 border-violet-200 text-violet-800",
    title: "A track record that tells the truth",
    body: "See how often tested decisions pan out compared with gut calls, so luck stops passing for skill.",
  },
  {
    icon: FlaskConicalIcon,
    tint: "bg-amber-50 border-amber-200 text-amber-800",
    title: "Tests agreed before the results",
    body: "The measure and the pass mark are set up front, so nobody moves the goalposts once the numbers arrive.",
  },
  {
    icon: SmartphoneIcon,
    tint: "bg-stone-100 border-stone-200 text-incrementic-charcoal",
    title: "Decisions don't wait on a login",
    body: "Send the decider one question, a due date and what happens if they don't answer. They reply from their phone.",
  },
  {
    icon: BotIcon,
    tint: "bg-sky-50 border-sky-200 text-sky-800",
    title: "Works with your AI",
    body: "Connect Claude and it can list what's open, record decisions and log look-backs, every change marked as made by your AI.",
  },
];

/** A small picture of the business as a risk map: which boxes are still guesses, which run without you. */
function RiskMapPreview() {
  const boxes = [
    { name: "Customer segments", state: "Codified", tint: "bg-emerald-50 border-emerald-300 text-emerald-900", fog: "" },
    { name: "Channels", state: "Repeatable", tint: "bg-teal-50 border-teal-300 text-teal-900", fog: "" },
    { name: "Value proposition", state: "Codified", tint: "bg-emerald-50 border-emerald-300 text-emerald-900", fog: "" },
    { name: "Relationships", state: "Tested", tint: "bg-amber-50 border-amber-300 text-amber-900", fog: "" },
    { name: "Key activities", state: "Guess", tint: "bg-stone-100 border-dashed border-stone-400 text-stone-600", fog: "blur-[0.4px]" },
    { name: "Key partners", state: "Guess", tint: "bg-stone-100 border-dashed border-stone-400 text-stone-600", fog: "blur-[0.4px]" },
    { name: "Revenue streams", state: "Repeatable", tint: "bg-teal-50 border-teal-300 text-teal-900", fog: "" },
    { name: "Cost structure", state: "Tested", tint: "bg-amber-50 border-amber-300 text-amber-900", fog: "" },
  ];
  return (
    <div className="w-full max-w-md mx-auto space-y-3" aria-label="Example: a canvas shown as a risk map">
      <div className="rounded-2xl bg-white text-incrementic-ink p-5 shadow-2xl space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="font-display font-bold text-lg">Kingston events platform</p>
          <span className="text-[11px] text-stone-500">example</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {boxes.map((b) => (
            <div key={b.name} className={`rounded-lg border px-2.5 py-2 ${b.tint}`}>
              <p className={`text-[12px] font-semibold leading-tight ${b.fog}`}>{b.name}</p>
              <p className="text-[10.5px] opacity-80">{b.state}</p>
            </div>
          ))}
        </div>
        <p className="text-sm">
          <b>2 of 8</b> parts run without you. <b className="text-incrementic-red">2 are still guesses.</b>
        </p>
      </div>
      <div className="rounded-2xl border-2 border-white/60 bg-white/15 backdrop-blur-md p-4 text-white text-sm space-y-1">
        <p className="font-semibold">Needs you</p>
        <p>Key partners: no plan B if the ticketing provider fails</p>
        <p className="text-white/80">Event follow-up runbook failed at step 3, twice this week</p>
      </div>
    </div>
  );
}

function SectionHead({ n, label, title, aside }: { n: string; label: string; title: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <span className="font-mono text-xs uppercase tracking-widest text-incrementic-red">
          {n} • {label}
        </span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-ink mt-1 max-w-3xl">{title}</h2>
      </div>
      {aside && <p className="text-muted text-xs sm:text-sm max-w-md">{aside}</p>}
    </div>
  );
}

function ComingNext() {
  return (
    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-incrementic-red">
      Coming next
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between selection:bg-incrementic-red selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-sm shadow-sm">
              CD
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg tracking-tight text-incrementic-ink">CriticalDash</span>
              <span className="hidden sm:inline font-mono text-[11px] text-muted">by Incrementic</span>
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
              Your dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative w-full bg-gradient-to-b from-[#EA5148] via-[#E84A41] to-[#D93D34] text-white overflow-hidden py-20 sm:py-28 px-6">
        <div className="absolute inset-0 bg-halftone pointer-events-none opacity-40 mix-blend-overlay" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-6xl mx-auto z-10 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="space-y-7 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/15 border border-white/30 backdrop-blur-md font-mono text-[11px] uppercase tracking-wider text-white/90">
              Take the risk out of how your business runs
            </span>

            <h1 className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight text-white leading-[1.05]">
              Your business is one resignation away from forgetting how it works.
            </h1>

            <p className="text-white/90 text-base sm:text-lg max-w-xl font-normal leading-relaxed">
              Most of what keeps it running is either a guess nobody tested, or a process that lives in one
              person&rsquo;s head. CriticalDash shows you which is which, and turns each part into a proven,
              written runbook, before the gap costs you a customer, a launch or your best hire.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center whitespace-nowrap px-8 py-3.5 rounded-full bg-white text-incrementic-ink font-display font-semibold text-sm hover:bg-white/95 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Find your blind spots, free
              </Link>
              <span className="text-xs text-white/80">For founders, operators, and teams running a platform, an event or a business.</span>
            </div>
          </div>

          <RiskMapPreview />
        </div>

        {/* The plan breaks, so build mechanisms */}
        <div className="relative z-10 max-w-6xl mx-auto mt-14 sm:mt-16 rounded-2xl border border-white/30 bg-white/10 backdrop-blur-md p-6 sm:p-8 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 items-center">
          <QuoteBlock q={TYSON} tone="hero" />
          <span className="justify-self-center md:justify-self-auto inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-white">
            So
            <ArrowRightIcon className="w-3.5 h-3.5 rotate-90 md:rotate-0" aria-hidden="true" />
          </span>
          <QuoteBlock q={BEZOS} tone="hero" />
        </div>
      </header>

      {/* The argument, in four stages */}
      <section className="max-w-6xl mx-auto px-6 pt-20 w-full space-y-8" aria-labelledby="four-stages">
        <div className="space-y-1">
          <span className="font-mono text-xs uppercase tracking-widest text-incrementic-red">The argument, in four stages</span>
          <h2 id="four-stages" className="font-display font-bold text-2xl sm:text-3xl text-ink max-w-3xl">
            It&rsquo;s been said before, by people who&rsquo;d know.
          </h2>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUOTE_STAGES.map(({ heading, stage, quotes }, i) => (
            <li key={heading} className="rounded-2xl bg-surface border border-line p-5 shadow-sm flex flex-col gap-4">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-incrementic-red">
                  {String(i + 1).padStart(2, "0")} • {stage}
                </span>
                <h3 className="font-display font-bold text-lg text-ink leading-tight">{heading}</h3>
              </div>
              <div className="space-y-4 divide-y divide-line [&>*+*]:pt-4">
                {quotes.map((q) => (
                  <QuoteBlock key={q.who} q={q} />
                ))}
              </div>
            </li>
          ))}
        </ol>
        <p className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950">
          <BotIcon className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
          <span>
            <b>Whitehead wrote that in 1911.</b> It&rsquo;s the case for handing operations to agents: once a runbook
            is proven, anyone, or your AI, can run it without having to think it through again.
          </span>
        </p>
      </section>

      {/* Exposure */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-4 w-full space-y-10">
        <SectionHead
          n="01"
          label="The exposure"
          title="Every process that isn't written down is a risk you're carrying right now."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {EXPOSURE.map((c) => (
            <div key={c.figure} className="rounded-2xl bg-surface border border-line p-6 space-y-3 shadow-sm">
              <p className="font-display font-extrabold text-4xl text-incrementic-red tabular-nums whitespace-nowrap">{c.figure}</p>
              <p className="text-sm text-ink leading-snug">{c.body}</p>
              <a href={c.href} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-muted hover:underline">
                {c.source}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Hidden risks */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full space-y-10">
        <SectionHead
          n="02"
          label="Where it's hiding"
          title="It won't be the big bet that hurts you. It'll be the thing everyone assumed someone else knew."
          aside="Pricing, suppliers, refunds, onboarding, incidents. The day-to-day runs the business, and it's the part nobody writes down."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HIDDEN_RISKS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl bg-surface border border-line p-6 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-incrementic-red flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-base text-ink">{title}</h3>
              <p className="text-xs text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Canvas to runbooks */}
      <section className="max-w-6xl mx-auto px-6 py-8 w-full space-y-10">
        <SectionHead
          n="03"
          label="From guess to runbook"
          title="Your canvas is the business as guesses. Runbooks are the business, proven. The gap between them is your risk."
          aside="Growing a business is moving every part from one end to the other. Until it's written down, it only runs while the person who knows it is in the room."
        />

        {/* Four stages */}
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map(({ icon: Icon, name, risk, riskTint, body }, i) => (
            <li key={name} className="rounded-2xl bg-surface border border-line p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="w-5 h-5 text-incrementic-red" />
                <h3 className="font-display font-bold text-base text-ink">{name}</h3>
              </div>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskTint}`}>{risk}</span>
              <p className="text-xs text-muted leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <b>Don&rsquo;t scale a guess.</b> A box still searching for what works gets experiments, not runbooks.
          Writing a runbook for an untested idea just spreads the mistake faster.
        </p>

        {/* Families */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-bold text-xl text-ink">Every box becomes a family of runbooks</h3>
            <ComingNext />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FAMILIES.map(({ icon: Icon, box, runbooks, risk }) => (
              <div key={box} className="rounded-2xl bg-surface border border-line p-5 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-incrementic-red" />
                  <p className="font-display font-bold text-sm text-ink">{box}</p>
                </div>
                <p className="text-xs text-ink leading-relaxed">{runbooks}</p>
                <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[11.5px] text-rose-900">
                  <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Without it: {risk.charAt(0).toLowerCase() + risk.slice(1)}</span>
                </p>
              </div>
            ))}
            <div className="rounded-2xl border border-incrementic-red/40 bg-red-50/60 p-5 space-y-2 md:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2">
                <WrenchIcon className="w-4 h-4 text-incrementic-red" />
                <p className="font-display font-bold text-sm text-ink">Every run reports back</p>
              </div>
              <p className="text-xs text-ink leading-relaxed">
                Each run logs what happened: leads converted, delivery time, cost to serve. That confirms the canvas
                box or forces a rethink. A runbook that keeps failing at the same step is a canvas problem showing up
                in operations: the wrong segment, the wrong channel, or a price the market won&rsquo;t pay. You find
                out while it&rsquo;s one failed step, not a lost quarter.
              </p>
            </div>
          </div>
        </div>

        {/* Built */}
        <div className="rounded-3xl bg-incrementic-ink text-white p-6 sm:p-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-white" />
              <h3 className="font-display font-bold text-xl">Know exactly how much of your business runs without you</h3>
              <ComingNext />
            </div>
            <p className="text-sm text-white/80 max-w-2xl">
              Every box shows whether it&rsquo;s a guess, tested, repeatable or codified, with its runbooks linked.
              You&rsquo;re close to built when most boxes are codified, and you could hand the canvas and its
              runbooks to someone new and they could run the business. Running a platform or a conference? Start
              from the runbooks and keep the canvas as the evidence.
            </p>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {["bg-stone-500 border border-dashed border-stone-300", "bg-amber-400", "bg-teal-400", "bg-emerald-500"].map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={`h-10 w-14 rounded-md ${c}`} />
                <span className="text-[10.5px] text-white/70">{["Guess", "Tested", "Repeatable", "Codified"].at(i)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Controls available today */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full space-y-12">
        <SectionHead
          n="04"
          label="Your controls, today"
          title="Every call on record. Every call checked. No more learning from luck."
          aside="Goals, the items each one is waiting on, and the decision that settled every one."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CONTROLS.map(({ icon: Icon, tint, title, body }) => (
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
        <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-b from-[#EA5148] to-[#D93D34] text-white px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <h2 className="font-display font-bold text-2xl sm:text-3xl">Every week you wait, more of the business walks out the door in someone&rsquo;s head.</h2>
            <p className="text-sm text-white/85 max-w-lg">
              Map what&rsquo;s still a guess and what&rsquo;s proven, while the people who know are still here.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center whitespace-nowrap px-8 py-3.5 rounded-full bg-white text-incrementic-ink font-display font-semibold text-sm hover:bg-white/95 shadow-lg transition-all shrink-0"
          >
            Find your blind spots, free
          </Link>
        </div>
      </section>

      {/* Footer with Incrementic attribution */}
      <footer className="border-t border-line bg-surface px-6 py-8 text-center text-xs text-muted space-y-2">
        <div className="font-medium text-ink">CriticalDash • From guesses to runbooks</div>
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
