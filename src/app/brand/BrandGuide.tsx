"use client";

// The brand guide at /brand: how CriticalDash looks, moves and talks, taken from
// the landing page. It draws with the landing page's own pieces (the skyline,
// the headline, the sky shapes and the fog classes), so when those change the
// guide changes with them. Update the hex values here if a token moves.

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  CheckIcon,
  CopyIcon,
  FlaskConicalIcon,
  LightbulbIcon,
  ListChecksIcon,
  RepeatIcon,
  RotateCcwIcon,
  UserMinusIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { Balloon, Bird, Cloud, FLOCK, LookUpSkyline, PaperPlane } from "../../components/LookUpSkyline";
import { HeroHeadline } from "../../components/HeroHeadline";
import { SkyAccent } from "../../components/SkyAccent";

/** How thick the fog is on an element, 0 (clear) to 1 (thick). See .fog-veil and .fog-text. */
function fog(level: number): React.CSSProperties {
  return { ["--fog" as string]: level } as React.CSSProperties;
}

/* ------------------------------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------------------------------- */

type Swatch = { name: string; hex: string; use: string; dark?: boolean };

const CORE: Swatch[] = [
  { name: "Incrementic red", hex: "#EA5148", use: "Primary buttons, section labels, figures, the logo tile", dark: true },
  { name: "Red, pressed", hex: "#D93D34", use: "Hover on red, the bottom of the closing panel", dark: true },
  { name: "Ink", hex: "#2B2C31", use: "Headings, body text, dark buttons", dark: true },
  { name: "Charcoal", hex: "#4C4E56", use: "Navigation links", dark: true },
  { name: "Muted", hex: "#6B6D77", use: "Supporting text, intros, sources", dark: true },
  { name: "Line", hex: "#E6E6E8", use: "Card borders and dividers" },
  { name: "Canvas", hex: "#FAFAFA", use: "Page background" },
  { name: "Accent soft", hex: "#FDEEED", use: "Red tints behind icons" },
];

const STREET: Swatch[] = [
  { name: "Night", hex: "#0F3A33", use: "Hero ground, dark tiles", dark: true },
  { name: "Shade", hex: "#0A2622", use: "Panels and scrims over the street", dark: true },
  { name: "Lit face", hex: "#17493F", use: "Tower faces turned to the light", dark: true },
  { name: "Dark face", hex: "#0B2925", use: "Tower faces in shadow, birds, strings", dark: true },
  { name: "Edge", hex: "#34B585", use: "The bright corner on some towers", dark: true },
  { name: "Window", hex: "#3FC08F", use: "Window bands and lit panes", dark: true },
  { name: "Sky", hex: "#9FE0C2", use: "The opening between the towers, panel borders" },
  { name: "Mint", hex: "#C6EFD9", use: "Fog, clouds on a light page, text on Night" },
  { name: "Sun", hex: "#EAF6CB", use: "The sun in the sky opening" },
  { name: "Cloud", hex: "#F1FBF5", use: "Clouds and contrails in the hero" },
  { name: "Balloon red", hex: "#C8352D", use: "The balloon, and the primary button on the street", dark: true },
];

const NOTES: { name: string; fill: string; edge: string }[] = [
  { name: "Yellow", fill: "#FFF4C2", edge: "#EAD98A" },
  { name: "Pink", fill: "#FDE2E4", edge: "#F0B8BE" },
  { name: "Blue", fill: "#DDEBFF", edge: "#A9C8F2" },
  { name: "Green", fill: "#DDF3E4", edge: "#A7D9B7" },
];

/** The four stages, with the tints that mark them everywhere and how foggy each one is. */
const STAGES: { icon: LucideIcon; name: string; status: string; tint: string; fog: number }[] = [
  { icon: LightbulbIcon, name: "A guess", status: "Not yet checked", tint: "border-rose-300 bg-rose-50 text-rose-900", fog: 0.8 },
  { icon: FlaskConicalIcon, name: "A trial", status: "Being checked", tint: "border-amber-300 bg-amber-50 text-amber-900", fog: 0.5 },
  { icon: RepeatIcon, name: "It works", status: "Proven, but only a few people know it", tint: "border-teal-300 bg-teal-50 text-teal-900", fog: 0.2 },
  { icon: BookOpenCheckIcon, name: "How we do it", status: "Runs without you", tint: "border-emerald-300 bg-emerald-50 text-emerald-900", fog: 0 },
];

const TYPE_SCALE: { role: string; spec: string; sample: string; className: string }[] = [
  {
    role: "Hero headline",
    spec: "Sora 800 · 72 / 60 / 48px · leading 1.02 · tight tracking",
    sample: "You built the business.",
    className: "font-display font-extrabold text-5xl sm:text-6xl tracking-tight leading-[1.02]",
  },
  {
    role: "Section heading",
    spec: "Sora 700 · 36 / 30px · leading tight",
    sample: "If you took three months off from Monday, what would still run?",
    className: "font-display font-bold text-3xl sm:text-4xl leading-tight",
  },
  {
    role: "Card heading",
    spec: "Sora 700 · 20px · leading snug",
    sample: "A partner changes its prices, and yours are wrong for a week",
    className: "font-display font-bold text-xl leading-snug",
  },
  {
    role: "Quote",
    spec: "Sora 600 · 24 / 20px · leading snug, with curly quotes",
    sample: "“Do things that don’t scale.”",
    className: "font-display font-semibold text-xl sm:text-2xl leading-snug",
  },
  {
    role: "Body",
    spec: "Inter 400 · 18px · leading relaxed · Muted for supporting text",
    sample:
      "Which partners to work with. How to rank what they offer. When to recommend and when to stay neutral. That judgement lives in your head and a few trusted inboxes.",
    className: "text-lg leading-relaxed",
  },
  {
    role: "Section label",
    spec: "Inter 600 · 16px · Incrementic red · sentence case",
    sample: "The two-minute check",
    className: "text-base font-semibold text-incrementic-red",
  },
  {
    role: "Figure",
    spec: "Sora 800 · 48px · Incrementic red · tabular numbers",
    sample: "11% → 7%",
    className: "font-display font-extrabold text-5xl text-incrementic-red tabular-nums",
  },
  {
    role: "Data label (in the app)",
    spec: "IBM Plex Mono 600 · 11px · uppercase · 0.14em tracking",
    sample: "Where the plan stands",
    className: "font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-incrementic-red",
  },
];

const WORDS: { use: string; avoid: string; why: string }[] = [
  { use: "Decider, driver, operator", avoid: "Client, owner, user", why: "The people are named by what they do. “Owner” is taken by canvas roles." },
  { use: "A guess, a trial, it works, how we do it", avoid: "Hypothesis, experiment, validated, SOP", why: "The four stages, in words a busy founder already uses." },
  { use: "Runbook", avoid: "Playbook, process doc, workflow", why: "One word for a written, proven way of doing one job." },
  { use: "Did it pan out?", avoid: "Retrospective, post-mortem", why: "The look back is a plain question on a date." },
  { use: "Partners, providers, customers", avoid: "Stakeholders, vendors, end users", why: "The business sits between providers and customers." },
  { use: "Runs without you", avoid: "Scalable, automated, optimised", why: "The promise, said the way the reader would say it." },
];

const DO_DONT: { do: string; dont: string }[] = [
  {
    do: "A partner changes its prices, and yours are wrong for a week.",
    dont: "Mitigate pricing-sync risk across your partner ecosystem.",
  },
  {
    do: "42% of what a company knows lives with one person. (Panopto and YouGov, 1,001 US workers)",
    dont: "Most of your company’s knowledge is at risk.",
  },
  {
    do: "Nothing. Mapping your business and finding your blind spots is free.",
    dont: "Get started today with our generous free tier!",
  },
  {
    do: "A relocation agency’s hunch: people moving for work will pay more for a flat that’s ready on day one.",
    dont: "Acme Relocations’ Sarah Jones believed customers would pay more.",
  },
];

const SECTIONS = [
  ["idea", "The idea"],
  ["name", "Name and mark"],
  ["colour", "Colour"],
  ["type", "Type"],
  ["sky", "The street and sky"],
  ["fog", "Fog"],
  ["motion", "Motion"],
  ["components", "Components"],
  ["voice", "Voice"],
  ["rules", "House rules"],
] as const;

/* ------------------------------------------------------------------------------------------------
 * Pieces
 * ---------------------------------------------------------------------------------------------- */

function SectionHead({
  id,
  label,
  title,
  intro,
  accent,
}: {
  id: string;
  label: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  accent?: React.ReactNode;
}) {
  return (
    <div className="relative space-y-3 max-w-3xl">
      {accent && <div className="absolute left-full top-2 ml-16">{accent}</div>}
      <p className="text-base font-semibold text-incrementic-red">{label}</p>
      <h2 id={id} className="scroll-mt-24 font-display font-bold text-3xl sm:text-4xl text-ink leading-tight text-balance">
        {title}
      </h2>
      {intro && <p className="text-lg text-muted leading-relaxed">{intro}</p>}
    </div>
  );
}

function CopyHex({ hex, onDark }: { hex: string; onDark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Some views refuse the clipboard; the hex is selectable text beside the button.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${hex}`}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-mono text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-incrementic-red ${
        onDark ? "border-white/40 text-white hover:bg-white/10" : "border-black/15 text-incrementic-ink hover:bg-black/5"
      }`}
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? "Copied" : hex}
    </button>
  );
}

function SwatchCard({ s }: { s: Swatch }) {
  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
      <div className="flex h-24 items-end justify-end p-3" style={{ background: s.hex }}>
        <CopyHex hex={s.hex} onDark={s.dark} />
      </div>
      <div className="space-y-1 p-4">
        <p className="font-display font-bold text-base text-ink">{s.name}</p>
        <p className="text-sm text-muted leading-snug">{s.use}</p>
      </div>
    </div>
  );
}

/** One sky shape on its own little patch of sky, with what it's for. */
function SkyTile({ title, body, view, children }: { title: string; body: string; view: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
      <div className="flex h-36 items-center justify-center bg-[#9FE0C2]">
        <svg viewBox={view} className="h-24 w-full overflow-visible" aria-hidden="true">
          {children}
        </svg>
      </div>
      <div className="space-y-1.5 p-5">
        <h3 className="font-display font-bold text-lg text-ink">{title}</h3>
        <p className="text-base text-muted leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

/** The app icon, drawn as in public/icon.svg. */
function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="CriticalDash app icon">
      <defs>
        <linearGradient id="brand-icon-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EA5148" />
          <stop offset="100%" stopColor="#D93D34" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#brand-icon-bg)" />
      <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="8" />
      <g transform="translate(96, 96)">
        <rect x="0" y="0" width="320" height="320" rx="40" fill="none" stroke="#FFFFFF" strokeWidth="24" strokeOpacity="0.9" />
        <line x1="160" y1="0" x2="160" y2="320" stroke="#FFFFFF" strokeWidth="20" strokeOpacity="0.8" />
        <line x1="0" y1="160" x2="320" y2="160" stroke="#FFFFFF" strokeWidth="20" strokeOpacity="0.8" />
        <circle cx="160" cy="160" r="32" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4 border-t border-line py-3 first:border-t-0">
      <dt className="sm:w-48 shrink-0 text-base font-semibold text-ink">{label}</dt>
      <dd className="min-w-0 text-base text-muted leading-relaxed">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------------------------------- */

export default function BrandGuide() {
  const heroRef = useRef<HTMLElement>(null);
  // Remounting the headline replays its entrance.
  const [take, setTake] = useState(0);

  return (
    // Clipped sideways: the sky accents beside headings can reach past the edge on narrower wide screens.
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink selection:bg-incrementic-red selection:text-white">
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
              <span className="hidden md:inline text-sm text-muted">Brand guide</span>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap text-base font-semibold text-incrementic-charcoal hover:text-incrementic-red px-3 transition-colors"
          >
            <span className="hidden sm:inline">See the landing page</span>
            <span className="sm:hidden">Home</span>
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </nav>

      {/* Hero: the same street the landing page opens on */}
      <header ref={heroRef} className="relative w-full bg-[#0F3A33] text-white overflow-hidden py-16 sm:py-24 px-5 sm:px-6">
        <LookUpSkyline className="absolute inset-0" zoom={1.2} track={heroRef} />
        <div aria-hidden="true" className="absolute inset-0 bg-[#0A2622]/60 pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto space-y-7">
          <p className="text-lg font-semibold text-white/95">CriticalDash brand guide</p>
          <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.02] max-w-4xl text-balance">
            Look up. Clear the fog. Write it down.
          </h1>
          <p className="text-xl text-white leading-relaxed max-w-2xl">
            How CriticalDash looks, moves and talks, taken from the landing page as it stands in November 2026. Use it
            for anything new: a page, an email, a deck, a video, a screen in the app.
          </p>
          <nav aria-label="Sections" className="flex flex-wrap gap-2 pt-1">
            {SECTIONS.map(([id, name]) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex min-h-[44px] items-center rounded-full border border-[#9FE0C2]/50 bg-[#0A2622]/70 px-4 text-base font-semibold text-white hover:bg-[#0A2622] transition-colors"
              >
                {name}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-6 w-full">
        {/* The idea */}
        <section className="pt-20 pb-16 space-y-10">
          <SectionHead
            id="idea"
            label="The idea"
            title="You built the business. Would it run without you?"
            intro="Everything in the brand serves that one question, asked of businesses that sit between providers and customers: brokers, comparison sites, agencies, resellers and organisers."
            accent={<SkyAccent kind="cloud" className="w-44" />}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: "Looking up between towers",
                body: "The hero is a view straight up from the street. The towers are the business you built; the opening of sky is where the headline sits and where the eye lands.",
              },
              {
                title: "Fog is what hasn't been checked",
                body: "A guess looks hazy. As it's tested, proven and written down, the haze lifts. The fog is felt, never explained on the page.",
              },
              {
                title: "Notes adrift in the sky",
                body: "The canvas's sticky notes float through the sky, and one folds itself into a paper plane. The work leaves your head and goes somewhere others can see it.",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl bg-surface border border-line p-6 space-y-2 shadow-sm">
                <h3 className="font-display font-bold text-xl text-ink leading-snug">{c.title}</h3>
                <p className="text-lg text-muted leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Name and mark */}
        <section className="py-16 space-y-10">
          <SectionHead
            id="name"
            label="Name and mark"
            title="CriticalDash, by Incrementic."
            intro="One word, capital C and capital D. Incrementic is the maker and is named after it, never instead of it."
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-line bg-surface p-8 flex items-center justify-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-incrementic-red text-white font-display font-bold flex items-center justify-center text-base shadow-sm">
                  CD
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-bold text-2xl tracking-tight text-incrementic-ink">CriticalDash</span>
                  <span className="text-sm text-muted">by Incrementic</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[#9FE0C2]/40 bg-[#0F3A33] p-8 flex items-center justify-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#C8352D] text-white font-display font-bold flex items-center justify-center text-base">
                  CD
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-bold text-2xl tracking-tight text-white">CriticalDash</span>
                  <span className="text-sm text-[#C6EFD9]">by Incrementic</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-8 flex items-center justify-center gap-6 shadow-sm">
              {/* The app icon: a canvas grid with Incrementic's pulse dot at its centre */}
              <AppIcon className="h-24 w-24 shrink-0" />
              <p className="text-base text-muted leading-relaxed max-w-[12rem]">
                The app icon: the canvas as a grid, with Incrementic&rsquo;s pulse dot at the centre.
              </p>
            </div>
          </div>
          <dl className="rounded-2xl border border-line bg-surface px-6 py-2 shadow-sm">
            <Spec label="Lockup">
              The red CD tile, then CriticalDash in Sora 700 with tight tracking. &ldquo;by Incrementic&rdquo; follows in
              Muted, and drops on small screens.
            </Spec>
            <Spec label="On the street">The tile turns Balloon red and the attribution turns Mint.</Spec>
            <Spec label="Tagline">
              Decisions and runbooks for businesses between providers and customers. Incrementic&rsquo;s own line, used
              in the footer: The shortest distance to your next big thing.
            </Spec>
            <Spec label="Don't">Write Critical Dash, Criticaldash or CRITICALDASH, or set the name in a script, outline or gradient.</Spec>
          </dl>
        </section>

        {/* Colour */}
        <section className="py-16 space-y-12">
          <SectionHead
            id="colour"
            label="Colour"
            title="Incrementic red on a light page. A deep green street with a mint sky."
            intro="Two worlds. The page is near-white, ink and red. The hero, and anything that shows the street, is a family of greens with one red balloon in it. Tap a hex to copy it."
            accent={<SkyAccent kind="flock" className="w-32 mt-6" />}
          />

          <div className="space-y-4">
            <h3 className="font-display font-bold text-xl text-ink">The page</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CORE.map((s) => (
                <SwatchCard key={s.hex} s={s} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-display font-bold text-xl text-ink">The street and sky</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STREET.map((s) => (
                <SwatchCard key={s.hex} s={s} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-display font-bold text-xl text-ink">Notes</h3>
              <p className="text-lg text-muted leading-relaxed">
                The sticky-note colours from the canvas. Each has a darker edge for its fold. They float in the sky and
                tint the canvas; they are not for buttons or text.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {NOTES.map((n) => (
                  <div key={n.name} className="space-y-2">
                    <div
                      className="aspect-square max-w-full rounded-md border shadow-sm"
                      style={{ background: n.fill, borderColor: n.edge }}
                    />
                    <p className="text-sm font-semibold text-ink">{n.name}</p>
                    <p className="font-mono text-xs text-muted">
                      {n.fill}
                      <br />
                      {n.edge}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-display font-bold text-xl text-ink">Stages</h3>
              <p className="text-lg text-muted leading-relaxed">
                Rose, amber, teal, emerald: always in this order, always meaning the same four stages. A tinted fill,
                a full border and dark text of the same hue, from Tailwind&rsquo;s 50, 300 and 900.
              </p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <span key={s.name} className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${s.tint}`}>
                    {s.name}: {s.status}
                  </span>
                ))}
              </div>
              <p className="text-base text-muted leading-relaxed">
                Sky blue is kept for anything to do with AI, and violet for the track record. Neither stands for a
                stage.
              </p>
            </div>
          </div>
        </section>

        {/* Type */}
        <section className="py-16 space-y-10">
          <SectionHead
            id="type"
            label="Type"
            title="Sora to say it. Inter to explain it."
            intro="Sora carries headlines, card titles, quotes and figures. Inter carries everything you read at length. IBM Plex Mono is for small data labels inside the app, and stays off marketing pages."
          />
          <div className="rounded-2xl border border-line bg-surface shadow-sm divide-y divide-line">
            {TYPE_SCALE.map((t) => (
              <div key={t.role} className="grid gap-3 p-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
                <div className="space-y-1">
                  <p className="font-display font-bold text-base text-ink">{t.role}</p>
                  <p className="text-sm text-muted leading-snug">{t.spec}</p>
                </div>
                <p className={`min-w-0 text-ink ${t.className}`}>{t.sample}</p>
              </div>
            ))}
          </div>
          <dl className="rounded-2xl border border-line bg-surface px-6 py-2 shadow-sm">
            <Spec label="Body size">18px on marketing pages. The readers are busy owners, often on a phone; nothing they need to read goes below 16px.</Spec>
            <Spec label="Labels">Sentence case in red, never uppercase. Uppercase is only for the mono data labels in the app.</Spec>
            <Spec label="Weights">Sora 800 for the hero and figures, 700 for headings, 600 for quotes and buttons. Inter 600 for emphasis in running text.</Spec>
          </dl>
        </section>

        {/* The street and sky */}
        <section className="py-16 space-y-10">
          <SectionHead
            id="sky"
            label="The street and sky"
            title="Four things pass through the sky. They can follow you down the page."
            intro="The same shapes the hero draws, used as small accents beside headings and the closing panel. They are decoration only: hidden from screen readers, shown on wide screens only, and still when someone has asked for reduced motion."
            accent={<SkyAccent kind="paper" className="w-16 mt-8 ml-20" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <SkyTile
              title="Cloud"
              view="-90 -60 180 90"
              body="Drifts side to side. On the light page it turns Mint, because the hero's near-white cloud vanishes there."
            >
              <Cloud scale={0.9} />
            </SkyTile>
            <SkyTile title="Flock" view="-60 -40 120 80" body="Five birds in Dark face, wings flapping out of step. Crosses a margin, then leaves it empty for a while.">
              {FLOCK.map(([x, y, k], i) => (
                <Bird key={i} x={x} y={y} scale={k} delay={i * 0.13} wingClass="sky-accent-wing" />
              ))}
            </SkyTile>
            <SkyTile title="Paper plane" view="-30 -20 60 40" body="A yellow note folded into a plane. The one thing in the sky that is clearly a note on its way somewhere.">
              <g transform="scale(1.4)">
                <PaperPlane />
              </g>
            </SkyTile>
            <SkyTile title="Balloon" view="-20 -24 40 92" body="The only red in the street. In the hero it floats free; on the page it is tied to the closing panel.">
              <g className="sky-accent-balloon">
                <g transform="scale(1.3)">
                  <Balloon />
                </g>
              </g>
            </SkyTile>
          </div>
          <dl className="rounded-2xl border border-line bg-surface px-6 py-2 shadow-sm">
            <Spec label="How many">One accent per section at most, and not every section. They sit in empty margin to the right of a heading, never over text.</Spec>
            <Spec label="The street">
              Sixteen towers converge on the vanishing point behind the headline. Faces alternate Lit and Dark; some
              carry a bright Edge. Windows come in three kinds: grids, bands and lit panes.
            </Spec>
            <Spec label="Don't">Add new creatures, logos or people to the sky, or put the street behind long reading text without a Shade scrim.</Spec>
          </dl>
        </section>

        {/* Fog */}
        <section className="py-16 space-y-10">
          <SectionHead
            id="fog"
            label="Fog"
            title="Guesses look hazy. They clear as they're proven."
            intro="Fog is the brand's way of showing how sure we are, without a word of explanation. It lifts when you hover over or focus something, so nothing is ever hard to read for long. Hover over the four stages below."
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STAGES.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.name} tabIndex={0} className={`fog-veil rounded-2xl border p-5 space-y-2 ${s.tint}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <p className="font-display font-bold text-lg leading-tight">{s.name}</p>
                  <p className="text-sm leading-snug">{s.status}</p>
                  <p className="font-mono text-xs opacity-80">--fog: {s.fog}</p>
                  <span aria-hidden="true" className="fog-veil-layer" style={fog(s.fog)} />
                </div>
              );
            })}
          </div>
          <dl className="rounded-2xl border border-line bg-surface px-6 py-2 shadow-sm">
            <Spec label="Levels">
              One number, <code className="font-mono text-sm text-ink">--fog</code>, from 0 (clear) to 1 (thick). Stages
              use 0.8, 0.5, 0.2 and 0. Two-minute check answers use 0.85, 0.55, 0.2 and 0.
            </Spec>
            <Spec label="Classes">
              <code className="font-mono text-sm text-ink">.fog-veil</code> lays a white haze over a block;{" "}
              <code className="font-mono text-sm text-ink">.fog-text</code> blurs and fades text itself. Both are in{" "}
              <code className="font-mono text-sm text-ink">src/index.css</code>.
            </Spec>
            <Spec label="Don't">Fog anything someone must act on (buttons, form labels, prices), or explain the fog in copy.</Spec>
          </dl>
        </section>

        {/* Motion */}
        <section className="py-16 space-y-10">
          <SectionHead
            id="motion"
            label="Motion"
            title="One orchestrated moment, then a sky that never looks like a loop."
            intro="The headline arrives the way it reads. After that, motion stays slow and in the background."
          />
          <div className="rounded-3xl border border-[#9FE0C2]/40 bg-[#0F3A33] text-white p-8 sm:p-12 space-y-8">
            <HeroHeadline key={take} className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.02]" />
            <button
              type="button"
              onClick={() => setTake((t) => t + 1)}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-white/80 bg-[#0A2622]/60 px-5 font-display font-semibold text-base text-white hover:bg-[#0A2622]/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE0C2]"
            >
              <RotateCcwIcon className="h-4 w-4" aria-hidden="true" />
              Play it again
            </button>
          </div>
          <dl className="rounded-2xl border border-line bg-surface px-6 py-2 shadow-sm">
            <Spec label="The first line">
              Each word rises from below its own baseline, like a storey going up: 0.7s, 0.12s apart, easing
              (0.2, 0.8, 0.2, 1).
            </Spec>
            <Spec label="The question">Comes out of the fog a word at a time: from 12px blur to sharp over 0.9s, 0.16s apart.</Spec>
            <Spec label="&ldquo;you?&rdquo;">Arrives, mists over for a beat, long enough to picture the business without you, then clears. 3.4s in all.</Spec>
            <Spec label="The sky">
              Each thing crosses on its own cycle (clouds take 64 to 120 seconds) and the cycles don&rsquo;t divide into
              each other. Fog layers lean with the pointer and scroll, nearer layers more.
            </Spec>
            <Spec label="Reduced motion">The headline shows whole, the sky holds still, and the accents that travel are hidden.</Spec>
          </dl>
        </section>

        {/* Components */}
        <section className="py-16 space-y-10">
          <SectionHead
            id="components"
            label="Components"
            title="Pills to act. Rounded cards to read. Tints, borders and icons to show state."
            accent={<SkyAccent kind="cloud" className="w-36 mt-4" />}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-line bg-surface p-6 space-y-4 shadow-sm">
              <h3 className="font-display font-bold text-lg text-ink">On the page</h3>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-incrementic-red px-6 text-base font-semibold text-white shadow-md">
                  Map it properly, free
                </span>
                <span className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-incrementic-ink px-6 text-base font-semibold text-white">
                  Your dashboard
                </span>
                <span className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line bg-surface px-6 text-base font-semibold text-ink">
                  Start again
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-[#9FE0C2]/40 bg-[#0F3A33] p-6 space-y-4">
              <h3 className="font-display font-bold text-lg text-white">On the street</h3>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#C8352D] px-7 font-display font-semibold text-lg text-white shadow-xl">
                  Take the 2-minute check
                  <ArrowDownIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="inline-flex min-h-[56px] items-center justify-center rounded-full border-2 border-white/80 bg-[#0A2622]/60 px-7 font-display font-semibold text-lg text-white">
                  Start free
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-b from-[#EA5148] to-[#D93D34] p-6 space-y-4">
              <h3 className="font-display font-bold text-lg text-white">On red</h3>
              <span className="inline-flex min-h-[56px] items-center justify-center px-8 rounded-full bg-white text-incrementic-ink font-display font-semibold text-lg shadow-lg">
                Find your blind spots, free
              </span>
              <p className="text-sm text-white/95">The closing panel is the only gradient on the page.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="rounded-2xl bg-surface border border-line p-6 space-y-3 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-incrementic-red flex items-center justify-center">
                <UserMinusIcon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-display font-bold text-xl text-ink leading-snug">The person who knows every partner hands in their notice</h3>
              <p className="text-lg text-muted leading-relaxed">
                A card: 16px radius, a Line border, a small shadow, and a tinted icon tile with a full border.
              </p>
            </div>
            <div className="rounded-2xl bg-surface border border-line p-6 space-y-3 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-[#0F3A33] text-[#C6EFD9] flex items-center justify-center">
                <ListChecksIcon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-display font-bold text-xl text-ink leading-snug">A step in a decision&rsquo;s life</h3>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold bg-teal-50 border-teal-300 text-teal-900">Based on: figures</span>
                <span className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold bg-sky-50 border-sky-300 text-sky-900">Based on: an expert&rsquo;s view</span>
                <span className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold bg-amber-50 border-amber-300 text-amber-900">Based on: a judgement call</span>
              </div>
              <p className="text-base text-muted leading-relaxed">Night icon tiles mark the steps of a use case. Basis chips say what a call rests on.</p>
            </div>
            <div className="space-y-3">
              <p className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-lg text-amber-950">
                <AlertTriangleIcon className="mt-1 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>
                  <b>Don&rsquo;t write down a guess as if it were proven.</b> A callout has a full border, a tint and an
                  icon.
                </span>
              </p>
              <p className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-base text-muted">
                <XIcon className="mt-0.5 h-5 w-5 shrink-0 text-incrementic-red" aria-hidden="true" />
                <span>Never a coloured stripe down one edge of a card, note, panel or callout.</span>
              </p>
            </div>
          </div>

          <dl className="rounded-2xl border border-line bg-surface px-6 py-2 shadow-sm">
            <Spec label="Shape">Buttons are full pills. Cards are 16px; large panels and the closing panel are 24px. Icon tiles are 12px.</Spec>
            <Spec label="Touch">Every button and link is at least 44px tall; main calls to action are 52 to 56px.</Spec>
            <Spec label="Focus">A 2px Incrementic red ring with a 2px offset. On the street the ring turns Sky.</Spec>
          </dl>
        </section>

        {/* Voice */}
        <section className="py-16 space-y-10">
          <SectionHead
            id="voice"
            label="Voice"
            title="Plain words, real examples, nothing we can't back up."
            intro="We talk to a founder who is busy and sceptical, as a colleague who has seen this before would. Second person, short sentences, British spelling: organisation, systemise, judgement."
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {DO_DONT.map((d) => (
              <div key={d.do} className="rounded-2xl border border-line bg-surface p-6 space-y-4 shadow-sm">
                <p className="flex items-start gap-3 text-lg text-ink leading-relaxed">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800">
                    <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Write</span>
                  </span>
                  {d.do}
                </p>
                <p className="flex items-start gap-3 text-lg text-muted leading-relaxed line-through decoration-rose-300">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rose-300 bg-rose-50 text-rose-800 no-underline">
                    <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Not</span>
                  </span>
                  {d.dont}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-line bg-surface shadow-sm overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-6 py-4 font-display font-bold text-base text-ink">Say</th>
                  <th className="px-6 py-4 font-display font-bold text-base text-ink">Not</th>
                  <th className="px-6 py-4 font-display font-bold text-base text-ink">Because</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {WORDS.map((w) => (
                  <tr key={w.use}>
                    <td className="px-6 py-4 text-base font-semibold text-ink">{w.use}</td>
                    <td className="px-6 py-4 text-base text-muted">{w.avoid}</td>
                    <td className="px-6 py-4 text-base text-muted leading-relaxed">{w.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="rounded-2xl border border-line bg-surface px-6 py-2 shadow-sm">
            <Spec label="Examples">Made-up businesses named by kind (an insurance broker, a relocation agency), with people named by role. No real people or companies.</Spec>
            <Spec label="Figures">Every figure links to its source. If we can&rsquo;t cite it, we don&rsquo;t use it.</Spec>
            <Spec label="Quotes">Exact wording and attribution. A household name is paired with an expert, and the expert gets a line saying who they are.</Spec>
            <Spec label="AI">Optional, and said so. Anything an assistant changes is labelled as made by AI.</Spec>
          </dl>
        </section>

        {/* House rules */}
        <section className="pt-16 pb-20 space-y-8">
          <SectionHead id="rules" label="House rules" title="The short list." />
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "No coloured stripe on one edge of anything. Use a full border, a tint, an icon and a label.",
              "Section labels are red and in sentence case, never uppercase eyebrows.",
              "Numbered markers only where the order matters, like the four stages or a runbook's steps.",
              "The stage colours mean the stages. Don't borrow rose, amber, teal or emerald for anything else.",
              "One gradient: the red closing panel. No purple, no blue-to-purple, no glows.",
              "Red is the accent on the page; on the street it's the balloon and the main button, nothing else.",
              "Every figure cites a source. Every example is made up and named by kind.",
              "Decoration hides from screen readers and holds still under reduced motion.",
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-lg text-ink leading-relaxed shadow-sm">
                <CheckIcon className="mt-1.5 h-4 w-4 shrink-0 text-incrementic-red" aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line bg-surface px-6 py-10 text-center text-base text-muted space-y-3">
        <div className="font-semibold text-ink">CriticalDash • Brand guide</div>
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
