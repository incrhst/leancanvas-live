import React, { useState } from "react";
import { InfoIcon } from "lucide-react";
import { EVIDENCE_CONFIG, EVIDENCE_STATES, EvidenceBadge } from "./EvidenceBadge";

/**
 * The six evidence states as they look on the canvas, with a tap-to-open line on what each means.
 */
export function EvidenceLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5">
      <div className="flex items-start gap-2">
        <span className="shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Evidence</span>
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {EVIDENCE_STATES.map((state) => (
            <li key={state} className="shrink-0">
              <EvidenceBadge state={state} />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Hide what the evidence states mean" : "Show what the evidence states mean"}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        >
          <InfoIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <dl className="mt-2 grid gap-x-4 gap-y-1 border-t border-line pt-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
          {EVIDENCE_STATES.map((state) => (
            <div key={state} className="flex gap-1.5">
              <dt className="shrink-0 font-semibold text-ink">{EVIDENCE_CONFIG[state].label}:</dt>
              <dd className="text-muted">{EVIDENCE_CONFIG[state].desc}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
