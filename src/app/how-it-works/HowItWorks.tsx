"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LegalLinks } from "@/components/LegalPage";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  BotIcon,
  CheckCheckIcon,
  CheckIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  GaugeIcon,
  HistoryIcon,
  LayoutGridIcon,
  LightbulbIcon,
  RepeatIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";

/*
 * One worked example runs through every step: a relocation agency that matches people moving for
 * work with landlords, movers and local services, deciding whether to lead with move-in-ready flats
 * in three cities (Lisbon, Toronto and Singapore). It matches the landing page's stage examples and
 * is labelled as an example everywhere it appears.
 */

/** How thick the fog is on an element, 0 (clear) to 1 (thick). See .fog-text in index.css. */
function fog(level: number): React.CSSProperties {
  return { ["--fog" as string]: level } as React.CSSProperties;
}

/** Guesses are hazy, tested ones less so, repeatable ones clear. */
const NOTE_FOG = [0.7, 0.35, 0];

/* ------------------------------------------------------------------------------------------------
 * Small "try it" demos, one per step. Nothing here is saved or sent.
 * ---------------------------------------------------------------------------------------------- */

const STAGE_INFO = [
  { name: "Guess", meaning: "nobody has tested it yet", tint: "border-rose-300 bg-rose-50 text-rose-900", icon: LightbulbIcon },
  { name: "Tested", meaning: "tried by hand at least once", tint: "border-amber-300 bg-amber-50 text-amber-900", icon: FlaskConicalIcon },
  { name: "Repeatable", meaning: "worked more than once, steps written down", tint: "border-teal-300 bg-teal-50 text-teal-900", icon: RepeatIcon },
];

function DemoFrame({ title, children, onReset }: { title: string; children: React.ReactNode; onReset?: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-stone-50 p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-ink">{title}</p>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink hover:bg-white"
          >
            <RotateCcwIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function StageNotesDemo() {
  const notes = [
    { text: "People moving for work will pay more for a flat that's ready on day one", market: "All cities" },
    { text: "Toronto landlords want a local guarantor", market: "Toronto" },
    { text: "Employers' HR teams refer their new hires to us", market: "All cities" },
  ];
  const [stages, setStages] = useState<number[]>([0, 0, 0]);
  const bump = (i: number) => setStages((s) => s.map((v, j) => (j === i ? (v + 1) % STAGE_INFO.length : v)));
  const weakest = Math.min(...stages);
  return (
    <DemoFrame title="Try it: tap a note to change its stage" onReset={() => setStages([0, 0, 0])}>
      <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display font-bold text-lg text-ink">Customer segments: people moving for work</p>
          <span className={`rounded-full border px-3 py-0.5 text-sm font-semibold ${STAGE_INFO[weakest].tint}`}>
            Box: {STAGE_INFO[weakest].name}
          </span>
        </div>
        <div className="space-y-2">
          {notes.map((n, i) => {
            const st = STAGE_INFO[stages[i]];
            const Icon = st.icon;
            return (
              <button
                key={n.text}
                type="button"
                onClick={() => bump(i)}
                className={`flex w-full min-h-[64px] items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${st.tint}`}
              >
                <span className="space-y-1">
                  <span className="fog-text block text-base font-semibold" style={fog(NOTE_FOG[stages[i]])}>
                    {n.text}
                  </span>
                  <span className="inline-flex rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-sm">
                    {n.market}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {st.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-base text-muted leading-relaxed">
        A box is only as solid as its weakest note. The fourth stage, <b className="text-ink">Codified</b>, can&rsquo;t be
        picked by hand: it comes only from a live runbook (step 7).
      </p>
    </DemoFrame>
  );
}

function StressTestDemo() {
  const [ran, setRan] = useState(false);
  const risks = [
    "People moving for work will pay more for a flat that's ready on day one",
    "Employers' HR teams refer their new hires to us",
    "Toronto landlords want a local guarantor",
  ];
  return (
    <DemoFrame title="Try it: run the example stress test" onReset={ran ? () => setRan(false) : undefined}>
      {!ran ? (
        <button
          type="button"
          onClick={() => setRan(true)}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-incrementic-ink px-6 text-base font-semibold text-white hover:bg-black"
        >
          <GaugeIcon className="h-5 w-5" aria-hidden="true" />
          Run the stress test
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-base text-ink">The riskiest guesses, most dangerous first:</p>
          <ol className="space-y-2">
            {risks.map((r, i) => (
              <li key={r} className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-rose-300 font-bold text-rose-800">
                  {i + 1}
                </span>
                <span className="text-base font-semibold text-rose-950">{r}</span>
              </li>
            ))}
          </ol>
          <p className="text-base text-muted">So the first thing to check is whether people really pay more for a flat that\u2019s ready on day one.</p>
        </div>
      )}
    </DemoFrame>
  );
}

const ITEM_STATES = [
  { name: "Open", note: "Nobody knows yet." },
  { name: "Testing", note: "A trial is running. (This stage is optional.)" },
  { name: "Decided", note: "A call has been made, with its reason." },
  { name: "Done", note: "The call has been acted on. A date is set to check whether it worked." },
];

function ItemDemo() {
  const [state, setState] = useState(0);
  const last = ITEM_STATES.length - 1;
  return (
    <DemoFrame title="Try it: move an item along" onReset={state > 0 ? () => setState(0) : undefined}>
      <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
        <div>
          <p className="text-sm text-muted">Goal: Place more people from the spring arrivals</p>
          <p className={`font-display font-bold text-lg text-ink transition ${state === 0 ? "blur-[0.6px] opacity-70" : ""}`}>
            Item: Should we lead with move-in-ready flats?
          </p>
        </div>
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Item states">
          {ITEM_STATES.map((s, i) => (
            <li
              key={s.name}
              className={`rounded-lg border px-3 py-2 text-center text-base font-semibold ${
                i === state
                  ? "border-incrementic-ink bg-incrementic-ink text-white"
                  : i < state
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-line bg-surface text-muted"
              }`}
            >
              {i < state && <CheckIcon className="mr-1 inline h-4 w-4" aria-hidden="true" />}
              {s.name}
            </li>
          ))}
        </ol>
        <p className="text-base text-ink" aria-live="polite">
          {ITEM_STATES[state].note}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setState((s) => Math.min(last, s + 1))}
        disabled={state === last}
        className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-incrementic-ink px-6 text-base font-semibold text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Move it along
        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      <p className="text-base text-muted">Open items look hazy on the goals view and turn sharp once they&rsquo;re decided.</p>
    </DemoFrame>
  );
}

const MARKETS = ["Lisbon", "Toronto", "Singapore"];
const START_RESULTS = [28, 31, 22];

function PassMarkDemo() {
  const passMark = 25;
  const [results, setResults] = useState<number[]>(START_RESULTS);
  const passing = results.filter((r) => r >= passMark).length;
  return (
    <DemoFrame title="Try it: drag each city's result" onReset={() => setResults(START_RESULTS)}>
      <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
          <dt className="text-muted">We watch</dt>
          <dd className="font-semibold text-ink">Share of enquiries that book</dd>
          <dt className="text-muted">Pass mark</dt>
          <dd className="font-semibold text-ink">{passMark}% or more per city, agreed first</dd>
          <dt className="text-muted">Check on</dt>
          <dd className="font-semibold text-ink">After the spring arrivals</dd>
        </dl>
        <div className="space-y-4">
          {MARKETS.map((m, i) => {
            const met = results[i] >= passMark;
            return (
              <div key={m} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={`market-${i}`} className="text-base font-semibold text-ink">
                    {m}: <span className="tabular-nums">{results[i]}%</span> booked
                  </label>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${
                      met ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"
                    }`}
                  >
                    {met ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    {met ? "Met" : "Missed"}
                  </span>
                </div>
                <input
                  id={`market-${i}`}
                  type="range"
                  min={0}
                  max={50}
                  value={results[i]}
                  onChange={(e) => setResults((r) => r.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                  className="w-full h-3 accent-incrementic-red cursor-pointer"
                />
              </div>
            );
          })}
        </div>
        <p
          aria-live="polite"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-lg font-semibold ${
            passing > 0 ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"
          }`}
        >
          {passing > 0 ? <CheckCheckIcon className="h-5 w-5" aria-hidden="true" /> : <TargetIcon className="h-5 w-5" aria-hidden="true" />}
          {passing === MARKETS.length
            ? "All three cities passed"
            : passing === 0
              ? "No city has passed yet"
              : `${passing} of ${MARKETS.length} cities passed`}
        </p>
      </div>
      <p className="text-base text-muted">
        One pass mark, set before the numbers came in, so every city is judged the same way and nobody moves
        the goalposts for a favourite partner.
      </p>
    </DemoFrame>
  );
}

const BASES = [
  { key: "test", label: "A test result", detail: "Lisbon 28% and Toronto 31% of enquiries booked; Singapore 22%. Pass mark: 25%" },
  { key: "data", label: "Existing figures", detail: "last season's bookings, by employer" },
  { key: "expert", label: "An expert's view", detail: "a landlord partner's view on what new arrivals ask for" },
  { key: "judgment", label: "A judgement call", detail: "the team's years helping people move" },
];

function DecisionDemo() {
  const [basis, setBasis] = useState<string | null>(null);
  const chosen = BASES.find((b) => b.key === basis);
  return (
    <DemoFrame title="Try it: choose what the decision rests on" onReset={basis ? () => setBasis(null) : undefined}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Basis for the decision">
        {BASES.map((b) => (
          <button
            key={b.key}
            type="button"
            role="radio"
            aria-checked={basis === b.key}
            onClick={() => setBasis(b.key)}
            className={`min-h-[52px] rounded-xl border px-4 py-2.5 text-left text-base font-semibold transition-colors ${
              basis === b.key ? "border-incrementic-ink bg-incrementic-ink text-white" : "border-line bg-surface text-ink hover:bg-white"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-surface p-4" aria-live="polite">
        <p className="text-sm font-semibold text-muted mb-2">The decision record</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
          <dt className="text-muted">Decided</dt>
          <dd className="font-semibold text-ink">Lead with move-in-ready flats in Lisbon and Toronto; keep testing in Singapore</dd>
          <dt className="text-muted">Because of</dt>
          <dd className={chosen ? "font-semibold text-ink" : "text-subtle italic"}>
            {chosen ? `${chosen.label}: ${chosen.detail}` : "Pick one above"}
          </dd>
          <dt className="text-muted">Decided by</dt>
          <dd className="text-ink">The founder, 3 October</dd>
          <dt className="text-muted">Check again</dt>
          <dd className="text-ink">3 April, six months on</dd>
        </dl>
      </div>
    </DemoFrame>
  );
}

function LookBackDemo() {
  const [answer, setAnswer] = useState<"yes" | "partly" | "no" | null>(null);
  const replies = {
    yes: "Recorded. It counts towards how often decisions based on a test work out.",
    partly: "Recorded, with a note on what didn't go to plan. Partly is an honest answer, and it's kept.",
    no: "Recorded. The item can be reopened for a new call; the old decision stays on file as an earlier one.",
  };
  return (
    <DemoFrame title="Try it: six months on. Did it pan out?" onReset={answer ? () => setAnswer(null) : undefined}>
      <div className="flex flex-wrap gap-2">
        {(["yes", "partly", "no"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAnswer(a)}
            aria-pressed={answer === a}
            className={`min-h-[52px] min-w-[96px] rounded-full border px-6 text-lg font-semibold capitalize transition-colors ${
              answer === a ? "border-incrementic-ink bg-incrementic-ink text-white" : "border-line bg-surface text-ink hover:bg-white"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      <p className="min-h-[3rem] text-base text-ink leading-relaxed" aria-live="polite">
        {answer ? replies[answer] : "Pick an answer."}
      </p>
    </DemoFrame>
  );
}

function RunbookDemo() {
  const steps = [
    "Confirm the flat and the move-in date with the landlord",
    "Book the movers and set up the utilities",
    "Update the listing if the landlord has changed its terms",
    "Send the welcome pack, and check in after the first week",
  ];
  const [ticked, setTicked] = useState<boolean[]>(steps.map(() => false));
  const [logged, setLogged] = useState<string | null>(null);
  const all = ticked.every(Boolean);
  const reset = () => {
    setTicked(steps.map(() => false));
    setLogged(null);
  };
  return (
    <DemoFrame title="Try it: run the example runbook" onReset={ticked.some(Boolean) || logged ? reset : undefined}>
      <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
        <div>
          <p className="font-display font-bold text-lg text-ink">Get ready for a new arrival</p>
          <p className="text-base text-muted">Starts: two weeks before someone arrives · Owner: the partnerships lead</p>
        </div>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s}>
              <label
                className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-base transition-colors ${
                  ticked[i] ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-line bg-surface text-ink hover:bg-stone-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={ticked[i]}
                  onChange={() => setTicked((t) => t.map((v, j) => (j === i ? !v : v)))}
                  className="h-5 w-5 shrink-0 accent-emerald-600"
                />
                <span>
                  <span className="text-muted mr-1.5">{i + 1}.</span>
                  {s}
                </span>
              </label>
            </li>
          ))}
        </ol>
      </div>
      {all && !logged && (
        <div className="space-y-2">
          <p className="text-base font-semibold text-ink">Log this run. Did it work?</p>
          <div className="flex flex-wrap gap-2">
            {["Yes", "Partly", "No"].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setLogged(o)}
                className="min-h-[48px] min-w-[88px] rounded-full border border-line bg-surface px-5 text-base font-semibold text-ink hover:bg-white"
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-base text-ink leading-relaxed" aria-live="polite">
        {logged
          ? `Run logged: ${logged.toLowerCase()}. If a run fails, you note the step where it broke. Fail at the same step twice in five runs and the runbook is flagged.`
          : all
            ? ""
            : "Tick each step as you go."}
      </p>
    </DemoFrame>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The seven steps
 * ---------------------------------------------------------------------------------------------- */

type Step = {
  icon: LucideIcon;
  short: string;
  title: string;
  lead: string;
  points: string[];
  example: string;
  Demo: () => React.JSX.Element;
};

const STEPS: Step[] = [
  {
    icon: LayoutGridIcon,
    short: "One page",
    title: "Put the whole business on one page",
    lead: "Start with a Lean Canvas or a Go-to-market Canvas: one page with a box for each part of the business, such as customers, what you offer, how you sell, prices and costs.",
    points: [
      "Each note in a box is something you believe, marked by how far it has been proven: a guess, tested, repeatable or codified.",
      "Tag a note with the markets it applies to. A note with no tag holds for every market, so a guess about one country isn't quietly assumed for the rest.",
      "Every change is kept: who made it, when, what it said before and why.",
    ],
    example: "The founder adds “People moving for work will pay more for a flat that's ready on day one” for every city, and “Toronto landlords want a local guarantor” for Toronto only. Every note starts as a guess.",
    Demo: StageNotesDemo,
  },
  {
    icon: GaugeIcon,
    short: "Riskiest guesses",
    title: "Find the guesses that could sink you",
    lead: "Run a stress test. It scores the page on seven points and lists the riskiest guesses, so you know what to check first.",
    points: [
      "Lean canvases are scored with Ash Maurya's method; go-to-market canvases on go-to-market criteria.",
      "Print it or save it as a PDF, or get a plain-language summary for someone who has never seen a canvas.",
    ],
    example: "Top of the list: nobody has checked whether people really pay more for a move-in-ready flat when a cheaper one sits beside it.",
    Demo: StressTestDemo,
  },
  {
    icon: TargetIcon,
    short: "Goals",
    title: "Set a goal and list what it's waiting on",
    lead: "A goal is a big outcome, like a launch. Its items are the questions that need an answer before you get there.",
    points: [
      "Each item moves from open to decided to done, with an optional testing stage while a trial runs.",
      "Any note on the page can become an item, bringing its test and the person doing the work with it.",
    ],
    example: "Goal: place more people from the spring arrivals. First item: should we lead with move-in-ready flats?",
    Demo: ItemDemo,
  },
  {
    icon: FlaskConicalIcon,
    short: "Try it",
    title: "Try it, with the pass mark agreed first",
    lead: "Before anything is tried, write down what you'll watch, what result counts as a pass and when you'll check.",
    points: [
      "Each note has one person doing the work. Every Monday they get one question by email: any news?",
      "Anyone can send in a result from a link on their phone, with no account. It waits until an editor accepts it.",
      "The review page groups every test by how it's doing against its pass mark.",
    ],
    example: "Offer move-in-ready flats to one month's arrivals in each city. Pass mark: 25% of enquiries book.",
    Demo: PassMarkDemo,
  },
  {
    icon: CheckCheckIcon,
    short: "Decide",
    title: "Make the call, on the record",
    lead: "Every decision is written down: what was chosen, what it rests on, who decided, when, and a date to check back.",
    points: [
      "What it rests on is one of four: a test result, existing figures, an expert's view or a judgement call.",
      "Need someone else to decide? Send them one question with a date to answer by and what happens if they don't. They reply from their phone, no password.",
      "Changing your mind keeps the old decision on file. Nothing is written over.",
    ],
    example: "Lisbon and Toronto passed; Singapore didn't. The founder decides to lead with move-in-ready flats in those two, and keeps testing in Singapore.",
    Demo: DecisionDemo,
  },
  {
    icon: HistoryIcon,
    short: "Look back",
    title: "Look back: did it pan out?",
    lead: "On the check-back date, CriticalDash asks one question: did it work? Yes, no or partly.",
    points: [
      "Over time you see how often decisions based on a test work out, compared with gut calls.",
      "Snapshots freeze the page under a name like “Day 30”, so you can compare what you believed then with what you know now.",
    ],
    example: "Six months on, after the next season's arrivals, the founder answers: yes, it worked.",
    Demo: LookBackDemo,
  },
  {
    icon: BookOpenCheckIcon,
    short: "Runbook",
    title: "Write it up as a runbook",
    lead: "Once something has worked more than once, write it down as a runbook: what starts it, who owns it and the steps in order.",
    points: [
      "A runbook can only go live once every guess it rests on has been proven. That stops a hunch being rolled out as if it were fact.",
      "Anyone, or an AI assistant, can run it as a checklist and log how it went. Going live marks its notes as codified.",
      "Runbooks can be grouped into standard procedures, so a whole area of the business can be handed over.",
    ],
    example: "Getting ready for an arrival becomes a runbook, so the next arrival, and the next city, go the same way without the founders.",
    Demo: RunbookDemo,
  },
];

function StepWalkthrough() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  const Icon = step.icon;
  const last = STEPS.length - 1;
  const Demo = step.Demo;

  const go = (i: number) => {
    setActive(i);
    document.getElementById("step-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      {/* Step list */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2 lg:sticky lg:top-24"
        role="tablist"
        aria-label="The seven steps"
        aria-orientation="vertical"
      >
        {STEPS.map((s, i) => {
          const selected = i === active;
          const doneBefore = i < active;
          return (
            <button
              key={s.title}
              type="button"
              role="tab"
              id={`step-tab-${i}`}
              aria-selected={selected}
              aria-controls="step-panel"
              onClick={() => setActive(i)}
              className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-incrementic-red focus-visible:ring-offset-2 ${
                selected
                  ? "border-incrementic-ink bg-incrementic-ink text-white shadow-md"
                  : "border-line bg-surface text-ink hover:bg-stone-50"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                  selected
                    ? "bg-white text-incrementic-ink"
                    : doneBefore
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                      : "bg-red-50 text-incrementic-red border border-red-200"
                }`}
              >
                {doneBefore ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={`font-display font-bold text-base leading-tight ${i > active ? "fog-text" : ""}`}
                style={i > active ? fog(Math.min(0.75, 0.3 + (i - active) * 0.15)) : undefined}
              >
                {s.short}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step panel */}
      <div
        id="step-panel"
        role="tabpanel"
        aria-labelledby={`step-tab-${active}`}
        className="scroll-mt-24 rounded-3xl border border-line bg-surface p-6 sm:p-10 shadow-sm space-y-8"
      >
        <div className="grid gap-8 xl:grid-cols-2 xl:gap-10">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-incrementic-red">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-base font-semibold text-muted">
                Step {active + 1} of {STEPS.length}
              </span>
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink leading-tight">{step.title}</h2>
            <p className="text-xl text-ink leading-relaxed">{step.lead}</p>
            <ul className="space-y-3">
              {step.points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-lg text-muted leading-relaxed">
                  <CheckIcon className="mt-1.5 h-5 w-5 shrink-0 text-incrementic-red" aria-hidden="true" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <ClipboardListIcon className="mt-1 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <p className="text-lg text-amber-950 leading-relaxed">
                <b>In the example:</b> {step.example}
              </p>
            </div>
          </div>
          {/* key forces a fresh demo per step */}
          <Demo key={active} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => go(Math.max(0, active - 1))}
            disabled={active === 0}
            className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-line bg-surface px-5 text-base font-semibold text-ink hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
          {active < last ? (
            <button
              type="button"
              onClick={() => go(active + 1)}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-incrementic-ink px-6 text-base font-semibold text-white hover:bg-black"
            >
              Next: {STEPS[active + 1].short}
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-incrementic-red px-6 text-base font-semibold text-white hover:bg-[#D93D34]"
            >
              Start free
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------------------------------- */

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-incrementic-red selection:text-white">
      {/* Top Navbar (matches the landing page) */}
      <nav className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-md px-5 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-sm shadow-sm">
              CD
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-incrementic-ink">CriticalDash</span>
              <span className="hidden md:inline text-sm text-muted">by Incrementic</span>
            </div>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="hidden md:inline-flex min-h-[44px] items-center whitespace-nowrap text-base font-semibold text-incrementic-charcoal hover:text-incrementic-red px-3 transition-colors"
            >
              Home
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

      {/* Intro */}
      <header className="max-w-6xl mx-auto px-5 sm:px-6 pt-14 sm:pt-20 pb-10 w-full space-y-5">
        <p className="text-base font-semibold text-incrementic-red">How it works</p>
        <h1 className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight text-ink leading-[1.05] max-w-4xl">
          Seven steps from a hunch to something that runs without you.
        </h1>
        <p className="text-xl text-muted max-w-3xl leading-relaxed">
          We&rsquo;ll follow one example all the way through: a relocation agency that matches people moving for work
          with landlords, movers and local services, deciding whether to lead with flats that are ready on day one. The
          same steps work for any business that sits between providers and customers: brokers, comparison sites,
          agencies, resellers and organisers. Each step has a small example you can try for yourself. Nothing you do
          here is saved.
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-6 pb-16 w-full space-y-16">
        <StepWalkthrough />

        {/* Alongside every step */}
        <section className="space-y-6">
          <h2 className="font-display font-bold text-3xl text-ink">Alongside every step</h2>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-6 space-y-3 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-stone-100 border border-stone-200 text-incrementic-charcoal flex items-center justify-center">
                <SmartphoneIcon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-display font-bold text-xl text-ink">Everyone can take part</h3>
              <p className="text-lg text-muted leading-relaxed">
                Editors change the page; viewers can comment. People asked to decide or report a result answer from a link
                on their phone, with no account.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6 space-y-3 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-incrementic-red flex items-center justify-center">
                <ClipboardListIcon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-display font-bold text-xl text-ink">Ready for the weekly meeting</h3>
              <p className="text-lg text-muted leading-relaxed">
                One page for the meeting: tests against their pass marks, overdue check-backs, decisions waiting, and what
                changed since last time.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 space-y-3">
              <div className="w-11 h-11 rounded-xl bg-white border border-sky-200 text-sky-800 flex items-center justify-center">
                <BotIcon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-display font-bold text-xl text-ink">AI, only if you want it</h3>
              <p className="text-lg text-sky-950 leading-relaxed">
                If you use Claude, add CriticalDash as a connector and it can do much of the above for you. Every change
                it makes is labelled.
              </p>
              <p className="font-mono text-sm text-sky-800 break-all">lean.incrementic.com/api/mcp</p>
            </div>
          </div>
        </section>
      </main>

      {/* Closing call to action */}
      <section className="px-5 sm:px-6 pb-20 w-full">
        <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-b from-[#EA5148] to-[#D93D34] text-white px-6 sm:px-10 py-12 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="space-y-3">
            <h2 className="font-display font-bold text-3xl sm:text-4xl leading-tight">
              Start with the decision only you know the reason for.
            </h2>
            <p className="text-xl text-white/95 max-w-xl">Why you work with who you work with. Put it on the page, mark what&rsquo;s a guess, and check the riskiest one first.</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[56px] items-center justify-center whitespace-nowrap px-8 rounded-full bg-white text-incrementic-ink font-display font-semibold text-lg hover:bg-white/95 shadow-lg transition-all shrink-0"
          >
            Find your blind spots, free
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-surface px-6 py-10 text-center text-base text-muted space-y-3">
        <div className="font-semibold text-ink">CriticalDash • Decisions and runbooks for businesses between providers and customers</div>
        <LegalLinks />
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
