"use client";

// "How it's used": four businesses, each following one decision from the call,
// onto the record, into a runbook people follow, and back for a look six months on.
// The businesses and figures are made-up examples; people are named by role.

import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckIcon, FileTextIcon, HistoryIcon, ListChecksIcon, ScaleIcon, TriangleAlertIcon } from "lucide-react";

type Basis = "A test" | "Figures" | "An expert's view" | "A judgement call";

interface UseCase {
  business: string;
  question: string;
  decision: string;
  basis: Basis;
  because: string;
  decider: string;
  driver: string;
  decided: string;
  recordNote: string;
  runbook: string;
  steps: string[];
  runs: number;
  /** A step that keeps going wrong, flagged from the logged runs */
  flagged?: { step: number; note: string };
  lookBack: { when: string; verdict: "Worked" | "Partly"; note: string };
}

const CASES: UseCase[] = [
  {
    business: "Insurance broker",
    question: "Which insurer do we recommend first to families?",
    decision: "Recommend Insurer B first to families with children under five. Insurer A stays first for single travellers.",
    basis: "Figures",
    because: "Six months of claims: B paid 94% within ten days, A paid 71%.",
    decider: "Founder",
    driver: "Head of advice",
    decided: "12 March",
    recordNote: "The old ranking is kept beside it, with the date it changed and why.",
    runbook: "Recommending cover to a family",
    steps: [
      "Ask the children's ages and any conditions",
      "Check Insurer B's rules on existing conditions",
      "Quote B first, A as the alternative",
      "Note why, if you recommend anything else",
    ],
    runs: 38,
    flagged: { step: 1, note: "Missed twice. Now the form asks for it." },
    lookBack: { when: "September", verdict: "Worked", note: "Claim complaints from families fell from 7 to 2." },
  },
  {
    business: "Comparison site",
    question: "Do paying partners get shown first?",
    decision: "No. Results are ranked by price. Paying partners get one labelled slot, third on the page.",
    basis: "A test",
    because: "Four weeks, half of visitors each way: sales the same, and more people said they trusted the results.",
    decider: "Managing director",
    driver: "Partnerships lead",
    decided: "3 February",
    recordNote: "Partners who ask why they're not first get sent the record, not a fresh argument.",
    runbook: "Adding or changing a sponsored slot",
    steps: [
      "Check the partner's price is current",
      "Put the slot in third place, labelled Sponsored",
      "Screenshot the live page for the file",
      "Review clicks and complaints at month end",
    ],
    runs: 14,
    lookBack: { when: "August", verdict: "Worked", note: "Revenue held within 3%. No partner left." },
  },
  {
    business: "Relocation agency",
    question: "What do we do when a landlord changes terms overnight?",
    decision: "Pause the listing within a day, tell every affected customer the same day, and ask the landlord to hold the old terms for bookings already made.",
    basis: "An expert's view",
    because: "Our operations lead has handled over forty of these. Waiting a week cost us two customers last year.",
    decider: "Founder",
    driver: "Operations lead",
    decided: "20 January",
    recordNote: "The landlord was asked from a link on their phone, with a Friday deadline. Their yes is on the record.",
    runbook: "When a landlord changes terms",
    steps: [
      "Pause the listing",
      "Message every customer with a booking",
      "Ask the landlord to hold the old terms",
      "Update the listing once terms are agreed",
      "Check in with each customer a week later",
    ],
    runs: 9,
    lookBack: { when: "July", verdict: "Worked", note: "No customers lost to a change of terms since." },
  },
  {
    business: "Event organiser",
    question: "What happens when a venue or supplier cancels?",
    decision: "Full refund within five working days, never a voucher. We chase the supplier for the money after the customer is paid.",
    basis: "A judgement call",
    because: "Vouchers saved cash but cost us repeat bookings. We'd rather carry the gap.",
    decider: "Owner",
    driver: "Bookings manager",
    decided: "8 April",
    recordNote: "Marked as a judgement call, so it counts separately from decisions that were tested.",
    runbook: "A supplier cancels",
    steps: [
      "Tell everyone booked within a day",
      "Refund in full within five working days",
      "Invoice the supplier for what we've paid out",
      "Offer the next date first to those affected",
    ],
    runs: 3,
    flagged: { step: 2, note: "One supplier paid three months late. A chase step was added." },
    lookBack: {
      when: "October",
      verdict: "Partly",
      note: "Customers came back. Cash was tight for a month. Kept, with a deposit rule added.",
    },
  },
];

const BASIS_TINT: Record<Basis, string> = {
  "A test": "bg-teal-50 border-teal-300 text-teal-900",
  Figures: "bg-teal-50 border-teal-300 text-teal-900",
  "An expert's view": "bg-sky-50 border-sky-300 text-sky-900",
  "A judgement call": "bg-amber-50 border-amber-300 text-amber-900",
};

function Step({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-5 sm:p-6 space-y-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-[#0F3A33] text-[#C6EFD9] flex items-center justify-center shrink-0">
          <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
        </span>
        <h4 className="font-display font-bold text-lg text-ink">
          <span className="text-muted font-semibold mr-1.5">{n}.</span>
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-base font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function UseCases() {
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const c = CASES[active];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2" role="tablist" aria-label="Example businesses">
        {CASES.map((u, i) => {
          const selected = i === active;
          return (
            <button
              key={u.business}
              type="button"
              role="tab"
              id={`use-tab-${i}`}
              aria-selected={selected}
              aria-controls="use-panel"
              onClick={() => setActive(i)}
              className={`min-h-[64px] rounded-2xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-incrementic-red focus-visible:ring-offset-2 ${
                selected ? "bg-[#0F3A33] border-[#0F3A33] text-white" : "bg-surface border-line text-ink hover:border-[#0F3A33]/40"
              }`}
            >
              <span className="block font-display font-bold text-base">{u.business}</span>
              <span className={`block text-sm leading-snug ${selected ? "text-[#C6EFD9]" : "text-muted"}`}>{u.question}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          id="use-panel"
          role="tabpanel"
          aria-labelledby={`use-tab-${active}`}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <Step n={1} icon={ScaleIcon} title="The call">
            <p className="text-sm font-semibold text-muted">{c.question}</p>
            <p className="text-lg text-ink leading-relaxed">{c.decision}</p>
            <div className="flex flex-wrap items-start gap-3">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${BASIS_TINT[c.basis]}`}>
                Based on: {c.basis.toLowerCase()}
              </span>
              <p className="text-base text-muted leading-relaxed flex-1 min-w-[12rem]">{c.because}</p>
            </div>
          </Step>

          <Step n={2} icon={FileTextIcon} title="On the record">
            <dl className="grid grid-cols-3 gap-3">
              <Meta label="Decider" value={c.decider} />
              <Meta label="Driver" value={c.driver} />
              <Meta label="Decided" value={c.decided} />
            </dl>
            <p className="text-base text-muted leading-relaxed">{c.recordNote}</p>
          </Step>

          <Step n={3} icon={ListChecksIcon} title="Put to work">
            <p className="text-base text-ink">
              Runbook: <span className="font-semibold">{c.runbook}</span>
            </p>
            <ol className="space-y-1.5">
              {c.steps.map((s, i) => {
                const flagged = c.flagged?.step === i;
                return (
                  <li key={s} className="flex items-start gap-2.5 text-base text-ink">
                    <span
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        flagged ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-teal-50 border-teal-300 text-teal-700"
                      }`}
                    >
                      {flagged ? <TriangleAlertIcon className="w-3 h-3" aria-hidden="true" /> : <CheckIcon className="w-3 h-3" aria-hidden="true" />}
                    </span>
                    <span>
                      {s}
                      {flagged && <span className="block text-sm text-amber-800">Flagged: {c.flagged?.note}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="text-sm text-muted">
              Run {c.runs} {c.runs === 1 ? "time" : "times"} by the team, each run logged.
            </p>
          </Step>

          <Step n={4} icon={HistoryIcon} title="Checked">
            <p className="text-base text-muted">Looked back on in {c.lookBack.when}: did it pan out?</p>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${
                c.lookBack.verdict === "Worked" ? "bg-teal-50 border-teal-300 text-teal-900" : "bg-amber-50 border-amber-300 text-amber-900"
              }`}
            >
              {c.lookBack.verdict}
            </span>
            <p className="text-lg text-ink leading-relaxed">{c.lookBack.note}</p>
          </Step>
        </motion.div>
      </AnimatePresence>

      <p className="text-sm text-muted">Example businesses and figures, to show how it works.</p>
    </div>
  );
}
