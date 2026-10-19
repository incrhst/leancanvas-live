import React, { useContext } from "react";
import { CheckCheckIcon, FlaskConicalIcon, GavelIcon, HandshakeIcon, LucideIcon } from "lucide-react";
import { BlockDef, NoteItem } from "../types/canvas";
import {
  decidedCount,
  PLAN_STATUSES,
  PlanStatus,
  PlanStatusReason,
  planStatusOf,
} from "../../convex/lib/planStatus";
import { defaultOutcomeLine } from "../../convex/lib/decisionText";
import { MembersContext } from "../utils/members";
import { LaunchDateContext } from "../utils/launchDate";
import { formatPlanDate, todayLocal } from "../utils/testFields";
import { outcomeLabel } from "./NoteDecision";

/**
 * How each of the three states looks. These hues (orange, sky, teal) are not used by any evidence
 * state, so "have we decided" never shares a colour with "how sure are we".
 */
export const PLAN_STATUS_CONFIG: Record<
  PlanStatus,
  { label: string; desc: string; icon: LucideIcon; column: string; heading: string; pill: string; empty: string }
> = {
  needs_call: {
    label: "Needs a call",
    desc: "Someone has to decide",
    icon: GavelIcon,
    column: "border-orange-200 bg-orange-50/70",
    heading: "text-orange-900",
    pill: "border-orange-300 bg-orange-100 text-orange-900",
    empty: "Nothing is waiting on a decision.",
  },
  testing: {
    label: "Testing",
    desc: "A test is running; no result yet",
    icon: FlaskConicalIcon,
    column: "border-sky-200 bg-sky-50/70",
    heading: "text-sky-900",
    pill: "border-sky-300 bg-sky-100 text-sky-900",
    empty: "No tests are running.",
  },
  agreed: {
    label: "Agreed",
    desc: "Decided, and nothing has gone against it",
    icon: HandshakeIcon,
    column: "border-teal-200 bg-teal-50/70",
    heading: "text-teal-900",
    pill: "border-teal-300 bg-teal-100 text-teal-900",
    empty: "Nothing is agreed yet.",
  },
};

export const DECIDED_TOOLTIP =
  "Decisions approved, or with an option chosen, out of all the decisions asked for on this canvas. Ones turned down or sent back still count as asked.";

/** "3 of 5 decided", for the canvas header and the share view. Hidden until a decision is asked for. */
export function DecidedCountChip({ notes }: { notes: NoteItem[] }) {
  const { decided, total } = decidedCount(notes);
  if (total === 0) return null;
  return (
    <span
      title={DECIDED_TOOLTIP}
      aria-label={`${decided} of ${total} decisions made. ${DECIDED_TOOLTIP}`}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-teal-300 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-900"
    >
      <CheckCheckIcon size={12} aria-hidden="true" />
      {decided} of {total} decided
    </span>
  );
}

interface PlanStatusBoardProps {
  blocks: BlockDef[];
  notes: NoteItem[];
  selectedId?: string | null;
  onOpenNote: (noteId: string) => void;
  /** Switches to the full canvas, for the notes that aren't on this board */
  onShowCanvas?: () => void;
}

/** The plan in three columns: Needs a call, Testing, Agreed. Stacked on phones. */
export function PlanStatusBoard({ blocks, notes, selectedId, onOpenNote, onShowCanvas }: PlanStatusBoardProps) {
  const today = todayLocal();
  const columns: Record<PlanStatus, { note: NoteItem; reason: PlanStatusReason }[]> = {
    needs_call: [],
    testing: [],
    agreed: [],
  };
  let notInPlay = 0;
  // Block order, then note order, so cards read like the canvas
  const blockIndex = new Map(blocks.map((b, i) => [b.id, i]));
  const sorted = [...notes].sort(
    (a, b) => (blockIndex.get(a.block) ?? 99) - (blockIndex.get(b.block) ?? 99) || a.order - b.order
  );
  for (const note of sorted) {
    const status = planStatusOf(note, today);
    if (status) columns[status.status].push({ note, reason: status.reason });
    else notInPlay++;
  }
  // Overdue decisions first: they're the ones holding the plan up
  columns.needs_call.sort((a, b) => Number(b.reason === "decision_overdue") - Number(a.reason === "decision_overdue"));

  const { decided, total } = decidedCount(notes);
  const blockTitle = (id: string) => blocks.find((b) => b.id === id)?.title ?? id;

  return (
    <section aria-label="Where the plan stands" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Where the plan stands</p>
          <p className="text-lg font-semibold text-ink" title={total ? DECIDED_TOOLTIP : undefined}>
            {total ? `${decided} of ${total} decided` : "No decisions asked for yet"}
          </p>
          {total > 0 && <p className="text-xs text-muted">Approved, or an option chosen, out of every decision asked for.</p>}
        </div>
        <nav aria-label="Jump to" className="flex flex-wrap gap-1.5">
          {PLAN_STATUSES.map((status) => {
            const config = PLAN_STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <a
                key={status}
                href={`#plan-${status}`}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium ${config.pill}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {config.label}
                <span className="font-semibold">{columns[status].length}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-start">
        {PLAN_STATUSES.map((status) => {
          const config = PLAN_STATUS_CONFIG[status];
          const Icon = config.icon;
          const items = columns[status];
          return (
            <div
              key={status}
              id={`plan-${status}`}
              className={`scroll-mt-3 rounded-xl border p-2.5 ${config.column}`}
            >
              <h2 className={`flex items-center gap-1.5 px-1 pb-2 text-sm font-semibold ${config.heading}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {config.label}
                <span className="ml-auto text-xs font-medium opacity-80">{items.length}</span>
              </h2>
              {items.length === 0 ? (
                <p className="px-1 pb-1 text-xs text-muted">{config.empty}</p>
              ) : (
                <ul className="space-y-2">
                  {items.map(({ note, reason }) => (
                    <li key={note._id}>
                      <PlanStatusCard
                        note={note}
                        reason={reason}
                        blockTitle={blockTitle(note.block)}
                        today={today}
                        selected={selectedId === note._id}
                        onOpen={() => onOpenNote(note._id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {notInPlay > 0 && (
        <p className="px-1 text-xs text-muted">
          {notInPlay} more {notInPlay === 1 ? "note isn't" : "notes aren't"} being tested or decided yet.{" "}
          {onShowCanvas && (
            <button type="button" onClick={onShowCanvas} className="font-medium text-ink underline">
              See the full canvas
            </button>
          )}
        </p>
      )}
    </section>
  );
}

function PlanStatusCard({
  note,
  reason,
  blockTitle,
  today,
  selected,
  onOpen,
}: {
  note: NoteItem;
  reason: PlanStatusReason;
  blockTitle: string;
  today: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const members = useContext(MembersContext);
  const launchDate = useContext(LaunchDateContext);
  const decision = note.decision;
  const decider = decision ? (members.get(decision.deciderId)?.name ?? decision.deciderName) : undefined;
  const firstName = decider?.split(" ")[0];
  const date = (d: string) => formatPlanDate(launchDate, d).replace(/^Day/, "day");
  const urgent = reason === "decision_overdue" || reason === "contradicted_after_agreed" || reason === "test_due";

  let line: string;
  switch (reason) {
    case "decision_open":
      line = `${firstName ? `Waiting on ${firstName}` : "Decision needed"} · due ${date(decision!.dueDate)}`;
      break;
    case "decision_overdue":
      line = `${firstName ? `Waiting on ${firstName}` : "Decision needed"} · overdue since ${date(decision!.dueDate)}`;
      break;
    case "changes_requested":
      line = `${firstName ?? "The decider"} asked for changes`;
      break;
    case "rejected":
      line = `${firstName ?? "The decider"} turned it down`;
      break;
    case "contradicted_after_agreed":
      line = "Agreed, but the evidence now goes against it";
      break;
    case "contradicted":
      line = "A test went against it";
      break;
    case "result_in":
      line = "The result is in; nobody has agreed what it means";
      break;
    case "test_running":
      line = note.reviewDate ? `Result due ${date(note.reviewDate)}` : "Test running";
      break;
    case "test_due":
      line = `Result was due ${date(note.reviewDate!)}`;
      break;
    case "decision_agreed":
      line = `${outcomeLabel(decision!)}${firstName ? ` by ${firstName}` : ""}`;
      break;
    case "committed":
      line = "The team committed to this";
      break;
  }

  const fallback = decision && (reason === "decision_open" || reason === "decision_overdue")
    ? defaultOutcomeLine(decision, today)
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={`block w-full rounded-lg border bg-surface p-3 text-left shadow-sm transition-colors hover:border-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? "border-ink/50" : "border-line"
      }`}
    >
      <span className="block font-mono text-[10px] uppercase tracking-wider text-muted">{blockTitle}</span>
      <span className="mt-0.5 block text-sm font-medium leading-snug text-ink">{note.content}</span>
      {decision && reason !== "decision_agreed" && (
        <span className="mt-1.5 block text-xs leading-snug text-ink/80">
          <span className="text-muted">Asked: </span>
          {decision.question}
        </span>
      )}
      <span className={`mt-1.5 block text-xs ${urgent ? "font-semibold text-ink" : "text-muted"}`}>{line}</span>
      {fallback && <span className="mt-1 block text-[11px] leading-snug text-muted">{fallback}</span>}
    </button>
  );
}
