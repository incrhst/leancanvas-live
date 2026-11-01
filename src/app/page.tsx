"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  BotIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  FlaskConicalIcon,
  HistoryIcon,
  LightbulbIcon,
  ListChecksIcon,
  RefreshCwIcon,
  RepeatIcon,
  RotateCcwIcon,
  ShuffleIcon,
  SirenIcon,
  SmartphoneIcon,
  UserMinusIcon,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------------------------------- */

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

/** Where the risk sits on a comparison and sign-up platform, in ordinary weeks. */
const HIDDEN_RISKS = [
  {
    icon: UserMinusIcon,
    title: "The person who knows every provider hands in their notice",
    body: "Which partner needs which documents, who to call when an application stalls, why one plan is listed above another. All of it was in their head.",
  },
  {
    icon: SirenIcon,
    title: "A provider changes its rates, and your prices are wrong for a week",
    body: "Nobody owns the update, so customers compare against old numbers. The first person to notice is the one who was quoted the wrong price.",
  },
  {
    icon: ShuffleIcon,
    title: "Three customers ask the same question and get three answers",
    body: "Can a student on a visa switch plans mid-year? Support, sales and the partner each remember it differently. One of them is wrong, and it's in writing.",
  },
  {
    icon: AlertTriangleIcon,
    title: "A channel that worked once gets rolled out everywhere",
    body: "University referrals worked for one intake of students. Now the same play is aimed at people moving abroad for work, and nobody checked it works twice.",
  },
  {
    icon: RefreshCwIcon,
    title: "Why is that provider listed first?",
    body: "Nobody wrote down why you rank plans the way you do, or when you recommend one and when you stay neutral. So the argument starts again every quarter.",
  },
  {
    icon: HistoryIcon,
    title: "Commission nobody checks",
    body: "Partner statements arrive, someone glances at the total, and nobody reconciles them against the people who actually signed up. Money stays on the other side.",
  },
];

/* --- The two-minute check ------------------------------------------------------------------- */

const PARTS = [
  "Choosing which providers and plans to list",
  "Updating prices when a provider changes its rates",
  "Deciding when to recommend a plan, and when to stay neutral",
  "Winning customers: search ads, referrals, university and employer partners",
  "Following up quotes that didn't sign up",
  "Helping people through enrolment and their documents",
  "Renewals, switches and cancellations",
  "Reconciling commission with each provider",
];

type Answer = 0 | 1 | 2 | 3;

const ANSWERS: { value: Answer; label: string; short: string; tile: string; chosen: string }[] = [
  {
    value: 0,
    label: "Only I know how",
    short: "Only in your head",
    tile: "bg-rose-50 border-rose-300 text-rose-900",
    chosen: "border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200",
  },
  {
    value: 1,
    label: "Someone knows, but it isn't written down",
    short: "In someone's head",
    tile: "bg-amber-50 border-amber-300 text-amber-900",
    chosen: "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200",
  },
  {
    value: 2,
    label: "It's written down",
    short: "Written down",
    tile: "bg-teal-50 border-teal-300 text-teal-900",
    chosen: "border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-200",
  },
  {
    value: 3,
    label: "Written down, and proven to work",
    short: "Runs without you",
    tile: "bg-emerald-50 border-emerald-300 text-emerald-900",
    chosen: "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200",
  },
];

/* --- Quotes and the four stages ------------------------------------------------------------- */

type Quote = { text: string; who: string; credit?: React.ReactNode };

const TYSON: Quote = { text: "Everybody has a plan until they get punched in the mouth.", who: "Mike Tyson" };
const BEZOS: Quote = {
  text: "Good intentions never work, you need good mechanisms to make anything happen.",
  who: "Jeff Bezos",
};

/**
 * From a guess to how the business runs. Each stage pairs a household name with a respected expert,
 * and the headings, read in order, make the case on their own. Keep quote wording and attributions exact.
 */
const STAGES: {
  icon: LucideIcon;
  name: string;
  heading: string;
  status: string;
  statusTint: string;
  looksLike: string;
  example: string;
  weDo: React.ReactNode;
  quotes: [Quote, Quote];
}[] = [
  {
    icon: LightbulbIcon,
    name: "A guess",
    heading: "Your business model is a guess",
    status: "Not yet checked",
    statusTint: "border-rose-300 bg-rose-50 text-rose-900",
    looksLike: "A type of customer, a channel or a way of ranking plans that you believe works, but haven't checked.",
    example: "\u201cStudents will pick the plan their university accepts, even if it costs more.\u201d",
    weDo: "Puts it on one page with the rest of the business, marked as a guess. A stress test ranks the riskiest guesses, so you check those first.",
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
    icon: FlaskConicalIcon,
    name: "A trial",
    heading: "Do it by hand before you systemise it",
    status: "Being checked",
    statusTint: "border-amber-300 bg-amber-50 text-amber-900",
    looksLike: "You try it for real, small and by hand, having agreed up front what result counts as a pass.",
    example: "Show \u201caccepted by your university\u201d on plans for one intake. Pass mark: 1 in 4 quotes sign up.",
    weDo: "Keeps the measure, the pass mark and the date to check. Whoever is doing the work gets one short question each Monday, and can reply from their phone.",
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
    icon: RepeatIcon,
    name: "It works",
    heading: "Ship, then learn from what happens",
    status: "Proven, but only a few people know it",
    statusTint: "border-teal-300 bg-teal-50 text-teal-900",
    looksLike: "It has worked more than once. The steps are known, but mostly by the people who did them.",
    example: "It beat the pass mark for two intakes in a row. Decided: lead with university acceptance for students.",
    weDo: "Records each decision with its reason, who made it and when. On the review date it asks the question most businesses never ask: did it pan out?",
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
    icon: BookOpenCheckIcon,
    name: "How we do it",
    heading: "Turn what works into mechanisms",
    status: "Runs without you",
    statusTint: "border-emerald-300 bg-emerald-50 text-emerald-900",
    looksLike: "It's written down clearly enough that someone new, or an AI assistant, can do it and get the same result.",
    example: "\u201cNew intake\u201d runbook: check each university's requirements, tag the plans that meet them, update the comparison, brief support.",
    weDo: "Writes it up as a runbook: what starts it, who owns it and the steps in order. It can only go live once what it rests on has been proven, and every run reports back, so a step that keeps breaking gets flagged.",
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

const CONTROLS = [
  {
    icon: ListChecksIcon,
    tint: "bg-red-50 border-red-200 text-incrementic-red",
    title: "See what runs without you",
    body: "Every part of the platform, from listing providers to reconciling commission, shows whether it's still a guess, being tested, proven or written up as a runbook.",
  },
  {
    icon: CheckCheckIcon,
    tint: "bg-teal-50 border-teal-200 text-teal-800",
    title: "A record of every decision",
    body: "What was chosen, why (a test, figures, an expert's view or a judgement call), who decided and when. Old decisions are kept, never written over.",
  },
  {
    icon: HistoryIcon,
    tint: "bg-violet-50 border-violet-200 text-violet-800",
    title: "An honest track record",
    body: "See how often checked decisions work out compared with gut calls, so luck stops passing for skill.",
  },
  {
    icon: BookOpenCheckIcon,
    tint: "bg-emerald-50 border-emerald-200 text-emerald-800",
    title: "Runbooks anyone can follow",
    body: "Write down how a job is done, step by step. Anyone can run it as a checklist and log how it went, and a step that keeps failing gets flagged.",
  },
  {
    icon: SmartphoneIcon,
    tint: "bg-stone-100 border-stone-200 text-incrementic-charcoal",
    title: "Answers from a phone, no password",
    body: "Ask a provider contact or an adviser one question, like \u201clist the new plan from 1 December, or wait?\u201d, with a date and what happens if they don't answer. They reply from a link on their phone.",
  },
  {
    icon: BotIcon,
    tint: "bg-sky-50 border-sky-200 text-sky-800",
    title: "Works with AI, if you want it",
    body: "Entirely optional. If you use Claude, it can list what's open and record decisions, and every change it makes is labelled as made by AI.",
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Who is it for?",
    a: "Businesses that sit between providers and customers. It started with platforms that compare plans and help people sign up, like cover for people living, studying or working abroad, so that's the example used on this page. The same decisions run insurance and benefits brokers, broadband and energy comparison, study-abroad and visa agents, travel agencies, recruitment agencies, letting and relocation agencies, IT resellers and event organisers. If you depend on partners, see their terms change and earn per placement, it fits.",
  },
  {
    q: "Do I need to be good with computers?",
    a: "If you can use email and a web browser, you can use CriticalDash. People who only need to answer a question or send a result do it from a link on their phone, with no account and no password.",
  },
  {
    q: "What does it cost to start?",
    a: "Nothing. Mapping your business and finding your blind spots is free.",
  },
  {
    q: "Who can see what I put in?",
    a: "Only the people you invite, and you choose whether each one can make changes or only look. There's also a read-only link you can share, which is off until you turn it on and can be protected with a password.",
  },
  {
    q: "Do I have to use AI?",
    a: "No. Everything works without it. If you already use Claude, you can connect it, and every change it makes is clearly labelled.",
  },
  {
    q: "What's a runbook?",
    a: "A written, step-by-step way of doing one job, like a recipe or a pilot's checklist, that has been proven to work and is clear enough for someone new to follow. In CriticalDash a runbook can only go live once the guesses it rests on have been proven, and anyone can tick through it as a checklist and log how the run went.",
  },
  {
    q: "I've seen plenty of business tools come and go. Why this one?",
    a: "Most tools store documents. CriticalDash keeps track of whether what you believe about your customers, partners and prices has actually been checked, and whether your decisions worked out. That's the record a new hire, a partner's due diligence or a buyer will ask for.",
  },
];

/* ------------------------------------------------------------------------------------------------
 * Pieces
 * ---------------------------------------------------------------------------------------------- */

function QuoteBlock({ q, tone = "light", size = "md" }: { q: Quote; tone?: "light" | "hero"; size?: "md" | "lg" }) {
  const hero = tone === "hero";
  return (
    <figure className="space-y-2.5">
      <blockquote
        className={`font-display font-semibold leading-snug ${hero ? "text-white" : "text-ink"} ${
          size === "lg" ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
        }`}
      >
        &ldquo;{q.text}&rdquo;
      </blockquote>
      <figcaption className={`text-base leading-snug ${hero ? "text-white/90" : "text-muted"}`}>
        <span className={`font-semibold ${hero ? "text-white" : "text-ink"}`}>{q.who}</span>
        {q.credit && <>, {q.credit}</>}
      </figcaption>
    </figure>
  );
}

function SectionHead({ label, title, intro }: { label: string; title: React.ReactNode; intro?: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-base font-semibold text-incrementic-red">{label}</p>
      <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink leading-tight">{title}</h2>
      {intro && <p className="text-lg text-muted leading-relaxed">{intro}</p>}
    </div>
  );
}

/** "If you took three months off from Monday, what would still run?" Nothing is stored or sent. */
function TwoMinuteCheck() {
  const [answers, setAnswers] = useState<(Answer | null)[]>(() => PARTS.map(() => null));
  const answered = answers.filter((a) => a !== null).length;
  const done = answered === PARTS.length;
  const runsWithoutYou = answers.filter((a) => a === 3).length;
  const inHeads = answers.filter((a) => a === 0 || a === 1).length;
  const onlyYou = answers.filter((a) => a === 0).length;

  const set = (i: number, v: Answer) => setAnswers((prev) => prev.map((a, j) => (j === i ? v : a)));
  const reset = () => setAnswers(PARTS.map(() => null));

  let verdict: string;
  if (inHeads >= 5) {
    verdict =
      "Most of the platform lives in people's heads. That's common when it grew on its founders' judgement and a few provider relationships, and it's the first thing worth fixing.";
  } else if (runsWithoutYou >= 6) {
    verdict =
      "You're in better shape than most. CriticalDash helps keep it that way, and shows you when something that used to work stops working.";
  } else {
    verdict =
      "Some of it is written down. The parts still in people's heads are where a resignation, a provider's rate change or a busy intake would hurt most.";
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
      {/* Questions */}
      <div>
      <ol className="space-y-4">
        {PARTS.map((part, i) => (
          <li key={part}>
            <fieldset className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <legend className="sr-only">{part}</legend>
              <p className="font-display font-bold text-lg text-ink mb-3" aria-hidden="true">
                <span className="text-muted font-normal mr-2">{i + 1}.</span>
                {part}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ANSWERS.map((opt) => {
                  const checked = answers[i] === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-base transition-colors focus-within:ring-2 focus-within:ring-incrementic-red focus-within:ring-offset-2 ${
                        checked ? opt.chosen : "border-line bg-surface text-ink hover:bg-stone-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`part-${i}`}
                        value={opt.value}
                        checked={checked}
                        onChange={() => set(i, opt.value)}
                        className="h-5 w-5 shrink-0 accent-incrementic-red"
                      />
                      <span className={checked ? "font-semibold" : ""}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      {/* On small screens the result sits below the questions; keep progress in view while answering. */}
      <div className="lg:hidden sticky bottom-3 z-20 mt-4">
        <a
          href="#check-result"
          className="flex min-h-[56px] items-center justify-between gap-3 rounded-full bg-incrementic-ink px-5 text-base font-semibold text-white shadow-xl"
        >
          <span>
            {answered} of {PARTS.length} answered
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {done ? "See result" : "Result"}
            <ArrowDownIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        </a>
      </div>
      </div>

      {/* Live result */}
      <aside id="check-result" className="scroll-mt-20 lg:sticky lg:top-24 space-y-4" aria-live="polite">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-md space-y-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display font-bold text-xl text-ink">Your business at a glance</h3>
            <span className="text-base text-muted whitespace-nowrap">
              {answered} of {PARTS.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PARTS.map((part, i) => {
              const a = answers[i];
              const opt = a === null ? null : ANSWERS[a];
              return (
                <div
                  key={part}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${
                    opt ? opt.tile : "border-dashed border-stone-300 bg-stone-50 text-stone-500"
                  }`}
                >
                  <p className="text-sm font-semibold leading-tight">{part}</p>
                  <p className="text-sm mt-0.5">{opt ? opt.short : "Not answered yet"}</p>
                </div>
              );
            })}
          </div>

          {done ? (
            <div className="space-y-3 border-t border-line pt-5">
              <p className="font-display font-bold text-2xl text-ink leading-snug">
                {runsWithoutYou} of {PARTS.length} parts would run without you.
              </p>
              {onlyYou > 0 && (
                <p className="text-lg text-incrementic-red font-semibold">
                  {onlyYou === 1 ? "1 part is" : `${onlyYou} parts are`} known only to you.
                </p>
              )}
              <p className="text-lg text-ink leading-relaxed">{verdict}</p>
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-incrementic-red px-6 text-base font-semibold text-white shadow-md hover:bg-[#D93D34] transition-colors"
                >
                  Map it properly, free
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 text-base font-semibold text-ink hover:bg-stone-50"
                >
                  <RotateCcwIcon className="h-4 w-4" aria-hidden="true" />
                  Start again
                </button>
              </div>
            </div>
          ) : (
            <p className="border-t border-line pt-5 text-lg text-muted leading-relaxed">
              Answer all {PARTS.length} to see how much of the business would keep running if you stepped away. Nothing
              you choose here is saved or sent anywhere.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

/** Step through the four stages, one at a time. */
function StageExplorer() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];
  const Icon = stage.icon;
  const last = STAGES.length - 1;

  return (
    <div className="space-y-6">
      {/* Stage picker */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="tablist" aria-label="The four stages">
        {STAGES.map((s, i) => {
          const selected = i === active;
          const SIcon = s.icon;
          return (
            <button
              key={s.name}
              type="button"
              role="tab"
              id={`stage-tab-${i}`}
              aria-selected={selected}
              aria-controls="stage-panel"
              onClick={() => setActive(i)}
              className={`flex min-h-[64px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-incrementic-red focus-visible:ring-offset-2 ${
                selected
                  ? "border-incrementic-ink bg-incrementic-ink text-white shadow-md"
                  : "border-line bg-surface text-ink hover:bg-stone-50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                  selected ? "bg-white text-incrementic-ink" : "bg-red-50 text-incrementic-red border border-red-200"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-display font-bold text-base sm:text-lg leading-tight">
                  <SIcon className="hidden sm:block h-4 w-4 shrink-0" aria-hidden="true" />
                  {s.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Stage panel */}
      <div
        id="stage-panel"
        role="tabpanel"
        aria-labelledby={`stage-tab-${active}`}
        className="rounded-3xl border border-line bg-surface p-6 sm:p-10 shadow-sm"
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-incrementic-red">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${stage.statusTint}`}>
                {stage.status}
              </span>
            </div>
            <h3 className="font-display font-extrabold text-3xl sm:text-4xl text-ink leading-tight">
              {stage.heading}
            </h3>
            <dl className="space-y-4 text-lg leading-relaxed">
              <div>
                <dt className="font-semibold text-ink">What it looks like</dt>
                <dd className="text-muted">{stage.looksLike}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">For example</dt>
                <dd className="text-ink">{stage.example}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">What CriticalDash does</dt>
                <dd className="text-muted">{stage.weDo}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-6 rounded-2xl bg-stone-50 border border-line p-6 sm:p-8">
            <QuoteBlock q={stage.quotes[0]} size="lg" />
            <div className="border-t border-line" />
            <QuoteBlock q={stage.quotes[1]} size="lg" />
            {active === last && (
              <p className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-base text-sky-950">
                <BotIcon className="mt-1 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                <span>
                  <b>Whitehead wrote that in 1911.</b> It&rsquo;s the case for handing routine work to AI: once a way of
                  doing something is proven and written down, it can run without anyone having to think it through again.
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => setActive((a) => Math.max(0, a - 1))}
            disabled={active === 0}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-line bg-surface px-5 text-base font-semibold text-ink hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
          <span className="text-base text-muted whitespace-nowrap">
            <span className="hidden sm:inline">Stage </span>
            {active + 1} of {STAGES.length}
          </span>
          <button
            type="button"
            onClick={() => setActive((a) => Math.min(last, a + 1))}
            disabled={active === last}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-incrementic-ink px-5 text-base font-semibold text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-lg text-amber-950">
        <AlertTriangleIcon className="mt-1 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <span>
          <b>Don&rsquo;t write down a guess as if it were proven.</b> Something you haven&rsquo;t checked needs a trial, not
          a procedure. Writing up an untested idea just spreads the mistake faster.
        </span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------------------------------- */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between selection:bg-incrementic-red selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-md px-5 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-sm shadow-sm">
              CD
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-incrementic-ink">
                CriticalDash
              </span>
              <span className="hidden md:inline text-sm text-muted">by Incrementic</span>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/how-it-works"
              className="hidden md:inline-flex min-h-[44px] items-center whitespace-nowrap text-base font-semibold text-incrementic-charcoal hover:text-incrementic-red px-3 transition-colors"
            >
              How it works
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center whitespace-nowrap text-base font-semibold text-incrementic-charcoal hover:text-incrementic-red px-3 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex min-h-[44px] items-center whitespace-nowrap text-base font-semibold bg-incrementic-ink text-white hover:bg-black px-5 rounded-full transition-all shadow-sm"
            >
              Your dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative w-full bg-gradient-to-b from-[#EA5148] via-[#E84A41] to-[#D93D34] text-white overflow-hidden py-16 sm:py-24 px-5 sm:px-6">
        <div className="absolute inset-0 bg-halftone pointer-events-none opacity-30 mix-blend-overlay" />
        <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="space-y-7">
            <p className="text-lg font-semibold text-white/95">For businesses that sit between providers and customers</p>
            <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.02]">
              You built the business.
              <br />
              Would it run without you?
            </h1>
            <p className="text-xl text-white leading-relaxed max-w-xl">
              Brokers, comparison sites, agencies, resellers, organisers. Which providers to work with. How to rank
              what they offer. When to recommend and when to stay neutral. What to do when a partner changes its
              terms overnight. That judgement lives in your head and a few trusted
              inboxes. CriticalDash gets it out, checks what really works, and writes it down as runbooks your team,
              or an AI assistant, can follow.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <a
                href="#check"
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-white px-7 font-display font-semibold text-lg text-incrementic-ink shadow-xl hover:bg-white/95 transition-all"
              >
                Take the 2-minute check
                <ArrowDownIcon className="h-5 w-5" aria-hidden="true" />
              </a>
              <Link
                href="/dashboard"
                className="inline-flex min-h-[56px] items-center justify-center rounded-full border-2 border-white/80 px-7 font-display font-semibold text-lg text-white hover:bg-white/10 transition-colors"
              >
                Start free
              </Link>
            </div>
          </div>

          {/* The plan breaks, so build mechanisms */}
          <div className="rounded-3xl border border-white/30 bg-white/10 backdrop-blur-md p-6 sm:p-8 space-y-6">
            <QuoteBlock q={TYSON} tone="hero" size="lg" />
            <div className="flex items-center gap-3 text-white/90" aria-hidden="true">
              <span className="h-px flex-1 bg-white/40" />
              <span className="text-base font-semibold">so</span>
              <span className="h-px flex-1 bg-white/40" />
            </div>
            <QuoteBlock q={BEZOS} tone="hero" size="lg" />
          </div>
        </div>
      </header>

      {/* The check */}
      <section id="check" className="scroll-mt-20 max-w-6xl mx-auto px-5 sm:px-6 pt-20 pb-8 w-full space-y-10">
        <SectionHead
          label="The two-minute check"
          title="If you took three months off from Monday, what would still run?"
          intro="Go through eight jobs every business between providers and customers depends on. The wording uses a comparison platform as the example; read it for your own partners and customers. Pick the answer that's honestly true today."
        />
        <TwoMinuteCheck />
      </section>

      {/* Exposure */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 w-full space-y-10">
        <SectionHead
          label="Why it matters"
          title="Every process that isn't written down is a risk you're already carrying."
          intro="These aren't our numbers. Each one links to its source."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {EXPOSURE.map((c) => (
            <div key={c.figure} className="rounded-2xl bg-surface border border-line p-6 space-y-3 shadow-sm">
              <p className="font-display font-extrabold text-5xl text-incrementic-red tabular-nums whitespace-nowrap">
                {c.figure}
              </p>
              <p className="text-lg text-ink leading-snug">{c.body}</p>
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-base text-muted underline underline-offset-2 hover:text-ink"
              >
                {c.source}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Hidden risks */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 w-full space-y-10">
        <SectionHead
          label="Where it's hiding"
          title="It's rarely the big bet that hurts. It's the provider detail everyone assumed someone else knew."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {HIDDEN_RISKS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl bg-surface border border-line p-6 space-y-3 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-incrementic-red flex items-center justify-center">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-display font-bold text-xl text-ink leading-snug">{title}</h3>
              <p className="text-lg text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Four stages */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 w-full space-y-10">
        <SectionHead
          label="From a guess to how we do it"
          title="Every part of a business goes through four stages. Step through them."
          intro="Pick a stage, or use Next. Each one comes with what the people who'd know have said about it."
        />
        <StageExplorer />
      </section>

      {/* Controls available today */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 w-full space-y-10">
        <SectionHead
          label="What you can use today"
          title="Every decision on record. Every decision checked."
          intro={
            <>
              Want the detail?{" "}
              <Link href="/how-it-works" className="font-semibold text-incrementic-red underline underline-offset-2">
                See how it works, step by step
              </Link>
              .
            </>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CONTROLS.map(({ icon: Icon, tint, title, body }) => (
            <div key={title} className="rounded-2xl bg-surface border border-line p-6 space-y-4 shadow-sm">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tint}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display font-bold text-xl text-ink">{title}</h3>
                <p className="text-lg text-muted leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Plain answers */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-16 w-full space-y-8">
        <SectionHead label="Plain answers" title="The questions people usually ask first" />
        <div className="rounded-2xl border border-line bg-surface shadow-sm divide-y divide-line">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-display font-bold text-lg sm:text-xl text-ink hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-incrementic-red [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDownIcon
                  className="h-6 w-6 shrink-0 text-incrementic-red transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-6 pb-6 text-lg text-muted leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing call to action */}
      <section className="px-5 sm:px-6 pt-4 pb-20 w-full">
        <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-b from-[#EA5148] to-[#D93D34] text-white px-6 sm:px-10 py-12 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="space-y-3">
            <h2 className="font-display font-bold text-3xl sm:text-4xl leading-tight">
              Get it written down while the people who know are still here.
            </h2>
            <p className="text-xl text-white/95 max-w-xl">
              Start with the decision only you know the reason for: why you list who you list.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[56px] items-center justify-center whitespace-nowrap px-8 rounded-full bg-white text-incrementic-ink font-display font-semibold text-lg hover:bg-white/95 shadow-lg transition-all shrink-0"
          >
            Find your blind spots, free
          </Link>
        </div>
      </section>

      {/* Footer with Incrementic attribution */}
      <footer className="border-t border-line bg-surface px-6 py-10 text-center text-base text-muted space-y-3">
        <div className="font-semibold text-ink">CriticalDash • Decisions and runbooks for businesses between providers and customers</div>
        <div>
          <Link href="/how-it-works" className="font-semibold text-ink underline underline-offset-2 hover:text-incrementic-red">
            How it works
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-1.5">
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
