import React, { useState } from "react";
import { CheckIcon, InfoIcon } from "lucide-react";
import { EVIDENCE_CONFIG, EVIDENCE_STATES } from "./EvidenceBadge";
import { EvidenceBadge } from "./EvidenceBadge";
import { NEEDS_EVIDENCE } from "../utils/evidenceFilter";
import type { EvidenceFilter, EvidenceFilterMode } from "../utils/evidenceFilter";
import type { EvidenceState, NoteItem } from "../types/canvas";

interface EvidenceLegendProps {
  /** With a filter, the six states become toggles that focus the canvas on them. */
  filter?: EvidenceFilter;
  /** The notes being counted (already narrowed by owner and market). */
  notes?: NoteItem[];
  onToggle?: (state: EvidenceState) => void;
  onShowNeedsEvidence?: () => void;
  onClear?: () => void;
  onModeChange?: (mode: EvidenceFilterMode) => void;
}

const MODES: { value: EvidenceFilterMode; label: string }[] = [
  { value: "dim", label: "Dim others" },
  { value: "hide", label: "Hide others" },
];

/**
 * The six evidence states as they look on the canvas, with a tap-to-open line on what each means.
 * Given a filter, each one is also a toggle, with a count of its notes.
 */
export function EvidenceLegend({
  filter,
  notes = [],
  onToggle,
  onShowNeedsEvidence,
  onClear,
  onModeChange,
}: EvidenceLegendProps) {
  const [open, setOpen] = useState(false);
  const filterable = !!filter && !!onToggle;
  const filtering = filterable && filter.active.length > 0;

  const counts = EVIDENCE_STATES.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: 0 }), {});
  for (const n of notes) counts[n.evidenceState || "assumption"] += 1;
  const shown = filtering ? notes.filter((n) => filter.active.includes(n.evidenceState || "assumption")).length : notes.length;
  const needsOn =
    filtering && filter.active.length === NEEDS_EVIDENCE.length && NEEDS_EVIDENCE.every((s) => filter.active.includes(s));

  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5">
      <div className="flex items-start gap-2">
        <span className="shrink-0 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Evidence</span>
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {EVIDENCE_STATES.map((state) => {
            if (!filterable) {
              return (
                <li key={state} className="shrink-0">
                  <EvidenceBadge state={state} />
                </li>
              );
            }
            const config = EVIDENCE_CONFIG[state];
            const Icon = config.icon;
            const on = filter.active.includes(state);
            const look = on || !filtering ? `${config.bg} ${config.text} ${config.border}` : "bg-surface text-muted border-line";
            return (
              <li key={state} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(state)}
                  title={`${config.label}: ${config.desc}`}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors hover:opacity-85 md:min-h-8 ${look} ${
                    on ? "ring-2 ring-current ring-offset-1 ring-offset-surface" : ""
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {config.label}
                  <span className="rounded-full bg-white/60 px-1.5 text-[11px] tabular-nums">{counts[state]}</span>
                  {on && <CheckIcon className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Hide what the evidence states mean" : "Show what the evidence states mean"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        >
          <InfoIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {filterable && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2">
          <p aria-live="polite" className="min-w-0 text-xs text-muted">
            <strong className="font-semibold text-ink">
              {filtering ? `Showing ${shown} of ${notes.length} notes` : `Showing all ${notes.length} notes`}
            </strong>
            {filtering && <> in {filter.active.map((s) => EVIDENCE_CONFIG[s].label).join(", ")}</>}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {onShowNeedsEvidence && (
              <button
                type="button"
                aria-pressed={needsOn}
                onClick={onShowNeedsEvidence}
                className={`min-h-11 rounded-lg border px-3 text-xs font-semibold md:min-h-8 ${
                  needsOn ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                Needs evidence
              </button>
            )}
            {onModeChange && (
              <div role="group" aria-label="What happens to other notes" className="flex gap-1 rounded-lg bg-surface-2 p-0.5">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={filter.mode === m.value}
                    onClick={() => onModeChange(m.value)}
                    className={`min-h-10 rounded-md px-2.5 text-xs font-semibold md:min-h-7 ${
                      filter.mode === m.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={!filtering}
                className="min-h-11 px-2 text-xs font-semibold text-ink underline disabled:text-subtle disabled:no-underline md:min-h-8"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

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
