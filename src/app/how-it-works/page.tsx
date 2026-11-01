import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenCheckIcon,
  BotIcon,
  CameraIcon,
  CheckCheckIcon,
  FlaskConicalIcon,
  GaugeIcon,
  HistoryIcon,
  LayoutGridIcon,
  SmartphoneIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "How it works — CriticalDash by Incrementic",
  description:
    "Map the business, find the riskiest guesses, test them with a pass mark agreed up front, decide on the record, and check whether each call panned out.",
};

/** Where an idea sits, from first guess to settled call. Mirrors the evidence states in the app. */
const EVIDENCE_STATES = [
  { name: "Unknown", tint: "bg-stone-100 border-dashed border-stone-400 text-stone-600" },
  { name: "Assumption", tint: "bg-rose-50 border-rose-300 text-rose-800" },
  { name: "Observed", tint: "bg-amber-50 border-amber-300 text-amber-900" },
  { name: "Supported", tint: "bg-teal-50 border-teal-300 text-teal-900" },
  { name: "Contradicted", tint: "bg-violet-50 border-violet-300 text-violet-900" },
  { name: "Decision", tint: "bg-emerald-50 border-emerald-300 text-emerald-900" },
];

const ITEM_STATES = ["Open", "Testing", "Decided", "Done"];

type Step = {
  icon: LucideIcon;
  title: string;
  lead: string;
  points: string[];
  extra?: "evidence" | "items";
};

const STEPS: Step[] = [
  {
    icon: LayoutGridIcon,
    title: "Map the business on one canvas",
    lead: "Start with a Lean Canvas or a GTM Canvas. Each note is a claim about the business, marked by how much you actually know.",
    points: [
      "Lean: problem, customer segments, value proposition, solution, channels, revenue, costs, key metrics, unfair advantage.",
      "GTM: ideal customer, pains, positioning, messaging, channels, sales motion, pricing, 90-day launch plan, success metrics.",
      "Every change to a note is kept: who made it, when, from what to what, and why.",
    ],
    extra: "evidence",
  },
  {
    icon: GaugeIcon,
    title: "Find the guesses that could sink you",
    lead: "Run a stress test. It scores the canvas on seven dimensions and pulls out the riskiest assumptions, so you know what to test first.",
    points: [
      "Lean canvases are scored with Ash Maurya's method; GTM canvases on go-to-market criteria.",
      "Export the canvas or its riskiest assumptions as a PDF or PNG, or as a plain-language summary for someone who's never seen a canvas.",
    ],
  },
  {
    icon: TargetIcon,
    title: "Set goals and list what each one is waiting on",
    lead: "A goal is a big outcome, like a launch. Its items are the things that need a decision before you get there.",
    points: [
      "Open items look hazy on the goals view and turn sharp once they're decided, so you can see at a glance what's still unknown.",
      "Any canvas note can become an item, with its test and driver carried over.",
    ],
    extra: "items",
  },
  {
    icon: FlaskConicalIcon,
    title: "Test it, with the pass mark agreed up front",
    lead: "Give a guess a measure, a pass mark and a review date before the results come in, so nobody moves the goalposts afterwards.",
    points: [
      "Each note has a driver, the person doing the work. Every Monday they're asked one question: any new evidence?",
      "Anyone can send a result from a link on their phone, with no account. It waits for an editor to accept it.",
      "The review view groups tests by how the latest result compares with the pass mark: missed, met, too early or no result yet.",
    ],
  },
  {
    icon: CheckCheckIcon,
    title: "Decide, on the record",
    lead: "Every call is written down: what was chosen, the basis, who decided and when, and a date to check back.",
    points: [
      "The basis is one of four: a test result, existing data, an expert view or a judgment call.",
      "Need someone else to decide? Send them one question with a due date and what happens if they don't answer. They reply from their phone, no sign-in.",
      "Reopening a call keeps the old record as an earlier decision. Nothing is overwritten.",
    ],
  },
  {
    icon: HistoryIcon,
    title: "Look back: did it pan out?",
    lead: "On the review date, CriticalDash asks whether the call worked: yes, no or partly.",
    points: [
      "Over time you see how often tested decisions pan out compared with gut calls, so luck stops passing for skill.",
      "Snapshots freeze the canvas under a label, like “Day 30”, so you can compare what you believed then with what you know now.",
    ],
  },
];

function EvidenceStrip() {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Evidence states">
      {EVIDENCE_STATES.map((s) => (
        <span key={s.name} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.tint}`}>
          {s.name}
        </span>
      ))}
    </div>
  );
}

function ItemFlow() {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold" aria-label="Item states">
      {ITEM_STATES.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 ${
              i === 1 ? "border-dashed border-stone-400 bg-stone-50 text-stone-600" : "border-line bg-surface text-ink"
            }`}
          >
            {s}
            {i === 1 && <span className="font-normal text-muted"> (optional)</span>}
          </span>
          {i < ITEM_STATES.length - 1 && <span className="text-muted" aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-incrementic-red selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-sm shadow-sm">
              CD
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg tracking-tight text-incrementic-ink">CriticalDash</span>
              <span className="hidden sm:inline font-mono text-[11px] text-muted">by Incrementic</span>
            </div>
          </Link>
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

      {/* Intro */}
      <header className="max-w-6xl mx-auto px-6 pt-16 sm:pt-20 pb-10 w-full space-y-5">
        <span className="font-mono text-xs uppercase tracking-widest text-incrementic-red">How it works</span>
        <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-ink leading-[1.08] max-w-4xl">
          From a guess on a canvas to a call you can stand behind.
        </h1>
        <p className="text-muted text-base sm:text-lg max-w-2xl leading-relaxed">
          CriticalDash keeps every part of the business honest about what you know and what you&rsquo;re hoping.
          Six steps, repeated as often as the business changes.
        </p>
      </header>

      {/* Steps */}
      <main className="max-w-6xl mx-auto px-6 pb-16 w-full">
        <ol className="space-y-4">
          {STEPS.map(({ icon: Icon, title, lead, points, extra }, i) => (
            <li
              key={title}
              className="rounded-2xl bg-surface border border-line p-6 sm:p-8 shadow-sm grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-10"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-incrementic-red flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs text-muted">Step {String(i + 1).padStart(2, "0")}</span>
                </div>
                <h2 className="font-display font-bold text-xl sm:text-2xl text-ink leading-tight">{title}</h2>
                <p className="text-sm text-ink leading-relaxed">{lead}</p>
                {extra === "evidence" && <EvidenceStrip />}
                {extra === "items" && <ItemFlow />}
              </div>
              <ul className="space-y-3 md:border-l md:border-line md:pl-10">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-muted leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-incrementic-red shrink-0" aria-hidden="true" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        {/* Alongside every step */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 space-y-2">
            <div className="flex items-center gap-2 text-sky-800">
              <BotIcon className="w-5 h-5" aria-hidden="true" />
              <h2 className="font-display font-bold text-base text-ink">Works with your AI</h2>
            </div>
            <p className="text-sm text-sky-950 leading-relaxed">
              Add CriticalDash as a connector in Claude and it can list what&rsquo;s open, add notes, record decisions
              and log look-backs. Every change is marked as made by your AI.
            </p>
            <p className="font-mono text-[11px] text-sky-800 break-all">lean.incrementic.com/api/mcp</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6 space-y-2">
            <div className="flex items-center gap-2 text-incrementic-red">
              <SmartphoneIcon className="w-5 h-5" aria-hidden="true" />
              <h2 className="font-display font-bold text-base text-ink">Everyone can take part</h2>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Editors change the canvas, viewers comment. Deciders and drivers answer from an emailed link, and a
              read-only public link lets anyone see the canvas.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6 space-y-2">
            <div className="flex items-center gap-2 text-incrementic-red">
              <CameraIcon className="w-5 h-5" aria-hidden="true" />
              <h2 className="font-display font-bold text-base text-ink">Built for the review meeting</h2>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              One view for the meeting: tests against their pass marks, overdue reviews, open decisions and what
              changed since the last snapshot.
            </p>
          </div>
        </div>

        {/* Runbooks */}
        <div className="mt-10 rounded-3xl bg-incrementic-ink text-white p-6 sm:p-8 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpenCheckIcon className="w-5 h-5" aria-hidden="true" />
            <h2 className="font-display font-bold text-xl">Then: turn what works into runbooks</h2>
          </div>
          <p className="text-sm text-white/80 max-w-3xl leading-relaxed">
            Once a play has worked more than once, write it down as a runbook: what starts it, who owns it and the
            steps in order. It can only go live once every note it rests on is proven, so you never scale a guess.
            Anyone, or an agent, can run it as a checklist. Every run reports back, and a runbook that keeps failing at
            the same step gets flagged, because that usually means the canvas needs a rethink.
          </p>
        </div>
      </main>

      {/* Closing call to action */}
      <section className="px-6 pb-20 w-full">
        <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-b from-[#EA5148] to-[#D93D34] text-white px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <h2 className="font-display font-bold text-2xl sm:text-3xl">Start with the canvas you already have in your head.</h2>
            <p className="text-sm text-white/85 max-w-lg">Map it, mark what&rsquo;s a guess, and test the riskiest one first.</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center whitespace-nowrap px-8 py-3.5 rounded-full bg-white text-incrementic-ink font-display font-semibold text-sm hover:bg-white/95 shadow-lg transition-all shrink-0"
          >
            Find your blind spots, free
          </Link>
        </div>
      </section>

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
