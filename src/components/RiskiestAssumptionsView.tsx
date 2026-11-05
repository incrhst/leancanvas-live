import React from "react";
import {
  ShieldAlertIcon,
  CheckCircle2Icon,
  FlaskConicalIcon,
  ArrowUpRightIcon,
  SparklesIcon,
  Loader2Icon,
  HistoryIcon,
} from "lucide-react";
import { EvidenceBadge, EVIDENCE_CONFIG } from "./EvidenceBadge";
import { blockName } from "../utils/canvasTemplates";
import type { BlockDef, EvidenceState, NoteItem, StressTestResult } from "../types/canvas";

interface RiskiestAssumptionsViewProps {
  /** The template's blocks, used to name each risk's block */
  blocks: BlockDef[];
  result: StressTestResult | null;
  notes: NoteItem[];
  canEdit?: boolean;
  canRun?: boolean;
  isRunning?: boolean;
  onRunTest?: () => void;
  onOpenNote?: (noteId: string) => void;
  onUpdateEvidence?: (noteId: string, state: EvidenceState) => void;
}

// Evidence states you'd typically move a risky assumption to after running its experiment
const RESOLUTION_STATES: EvidenceState[] = ["observed", "supported", "contradicted"];

export function statusFor(note: NoteItem | undefined) {
  if (!note) return null;
  if (note.evidenceState === "supported" || note.evidenceState === "decision") {
    return { label: "Validated", className: "bg-emerald-100 text-emerald-800" };
  }
  if (note.evidenceState === "contradicted") {
    return { label: "Invalidated", className: "bg-rose-100 text-rose-800" };
  }
  return { label: "Untested", className: "bg-amber-100 text-amber-800" };
}

export function RiskiestAssumptionsView({
  blocks,
  result,
  notes,
  canEdit = false,
  canRun = false,
  isRunning = false,
  onRunTest,
  onOpenNote,
  onUpdateEvidence,
}: RiskiestAssumptionsViewProps) {
  if (!result || result.riskiestAssumptions.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-line bg-surface p-10 text-center space-y-3">
        <ShieldAlertIcon className="mx-auto h-7 w-7 text-muted" />
        <p className="text-sm font-semibold text-ink">No riskiest assumptions yet</p>
        <p className="text-xs text-muted">
          Run the stress test to rank the assumptions most likely to sink this business model.
        </p>
        {canRun && onRunTest && (
          <button
            type="button"
            disabled={isRunning}
            onClick={onRunTest}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {isRunning ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
            {isRunning ? "Running stress test..." : "Run stress test"}
          </button>
        )}
      </div>
    );
  }

  const notesById = new Map(notes.map((n) => [n._id, n]));
  const testedAt = new Date(result.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <ShieldAlertIcon className="h-5 w-5 text-rose-600" />
            Riskiest assumptions
          </h2>
          <p className="text-xs text-muted">
            Ranked by the stress test on {testedAt}. Test #1 first: if it&apos;s wrong, the rest may not matter.
          </p>
        </div>
        {canRun && onRunTest && (
          <button
            type="button"
            disabled={isRunning}
            onClick={onRunTest}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft/80 disabled:opacity-50"
          >
            {isRunning ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <SparklesIcon className="h-3.5 w-3.5" />}
            Re-run stress test
          </button>
        )}
      </div>

      <ol className="space-y-3">
        {result.riskiestAssumptions.map((item, idx) => {
          const note = item.noteId ? notesById.get(item.noteId) : undefined;
          const status = statusFor(note);
          const changedSinceTest = !!note && note.updatedAt > result.createdAt;
          const noteDeleted = !!item.noteId && !note;

          return (
            <li
              key={`${item.noteId ?? "general"}-${idx}`}
              className="rounded-xl border border-line bg-white p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                  #{idx + 1}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {blockName(blocks, item.block)}
                </span>
                {status && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                )}
                {changedSinceTest && (
                  <span
                    className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-700"
                    title="This note was edited after the stress test ran"
                  >
                    <HistoryIcon className="h-3 w-3" />
                    Changed since test
                  </span>
                )}
                {noteDeleted && (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                    Note deleted
                  </span>
                )}
                {!item.noteId && (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                    Canvas-wide
                  </span>
                )}
              </div>

              <p className="text-sm font-medium leading-snug text-ink">
                {note ? note.content : item.assumption}
              </p>

              <p className="text-xs leading-relaxed text-muted">
                <strong className="text-ink">Why it&apos;s lethal:</strong> {item.reason}
              </p>

              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
                <FlaskConicalIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="leading-snug">
                  <strong>Experiment:</strong> {item.suggestedExperiment}
                </span>
              </div>

              {note && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    Evidence:
                    <EvidenceBadge state={note.evidenceState} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canEdit &&
                      onUpdateEvidence &&
                      RESOLUTION_STATES.filter((s) => s !== note.evidenceState).map((state) => (
                        <button
                          key={state}
                          type="button"
                          onClick={() => onUpdateEvidence(note._id, state)}
                          title={EVIDENCE_CONFIG[state].desc}
                          className={`rounded-md border px-2 py-1 text-[11px] font-medium hover:opacity-80 ${EVIDENCE_CONFIG[state].bg} ${EVIDENCE_CONFIG[state].text} ${EVIDENCE_CONFIG[state].border}`}
                        >
                          Mark {EVIDENCE_CONFIG[state].label.toLowerCase()}
                        </button>
                      ))}
                    {onOpenNote && (
                      <button
                        type="button"
                        onClick={() => onOpenNote(note._id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent-soft"
                      >
                        Show on canvas
                        <ArrowUpRightIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-600" />
        Flagged notes are also highlighted in red on the canvas.
      </p>
    </div>
  );
}
