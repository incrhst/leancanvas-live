import React, { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { GavelIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DecisionStatus, NoteItem } from "../types/canvas";
import { MembersContext } from "../utils/members";
import { LaunchDateContext, formatCalendarDate, formatPlanDate, todayLocal } from "../utils/testFields";
import { useAuth } from "./ConvexClientProvider";

export type DecisionAnswer = "approve" | "reject" | "change";

const STATUS_LABEL: Record<DecisionStatus, string> = {
  open: "Decision needed",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
};

function errorMessage(err: unknown) {
  const data = (err as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  return err instanceof Error ? err.message.replace(/^.*Uncaught (ConvexError|Error): /, "").split("\n")[0] : "Something went wrong";
}

/** One line on a note card while a decision is open or was sent back. Answered decisions show as the Decision state. */
export function DecisionSummary({ note }: { note: NoteItem }) {
  const members = useContext(MembersContext);
  const launchDate = useContext(LaunchDateContext);
  const decision = note.decision;
  if (!decision || (decision.status !== "open" && decision.status !== "changes_requested")) return null;

  const decider = members.get(decision.deciderId)?.name;
  const overdue = decision.status === "open" && decision.dueDate < todayLocal();
  return (
    <p
      className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] ${overdue ? "font-semibold text-rose-700" : "text-muted"}`}
      title={`${STATUS_LABEL[decision.status]}: ${decision.question}`}
    >
      <GavelIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {decision.status === "open" ? (
        <>
          <span className="font-semibold text-ink">{decider ? `Waiting on ${decider.split(" ")[0]}` : "Decision needed"}</span>
          <span aria-hidden="true">·</span>
          <span>{overdue ? "overdue" : `due ${formatPlanDate(launchDate, decision.dueDate).replace(/^Day/, "day")}`}</span>
        </>
      ) : (
        <span className="font-semibold text-ink">Changes requested</span>
      )}
    </p>
  );
}

/** The decision answer buttons, shared by the note panel and the /decisions page. */
export function DecisionAnswerForm({
  noteId,
  onAnswered,
}: {
  noteId: string;
  onAnswered?: (answer: DecisionAnswer) => void;
}) {
  const answerDecision = useMutation(api.decisions.answerDecision);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answer = async (choice: DecisionAnswer) => {
    if (choice === "change" && !comment.trim()) {
      setError("Say what should change, then press Ask for a change.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await answerDecision({ noteId: noteId as Id<"notes">, answer: choice, comment: comment.trim() || undefined });
      onAnswered?.(choice);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const button = "flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors";
  return (
    <div className="space-y-2">
      <textarea
        rows={2}
        value={comment}
        maxLength={500}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (needed if you ask for a change)"
        className="w-full resize-none rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => answer("approve")} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>
          Approve
        </button>
        <button type="button" disabled={busy} onClick={() => answer("reject")} className={`${button} bg-rose-600 text-white hover:bg-rose-700`}>
          Reject
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => answer("change")}
        className={`${button} w-full border border-line bg-surface text-ink hover:bg-surface-2`}
      >
        Ask for a change
      </button>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}

/**
 * The decision section of the note panel: ask for a decision (editors), answer it (the decider,
 * whatever their role), withdraw it (editors), or read the outcome.
 */
export function NoteDecisionSection({ note, canEdit }: { note: NoteItem; canEdit: boolean }) {
  const members = useContext(MembersContext);
  const { user } = useAuth();
  const requestDecision = useMutation(api.decisions.requestDecision);
  const withdrawDecision = useMutation(api.decisions.withdrawDecision);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [deciderId, setDeciderId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAsking(false);
    setError(null);
  }, [note._id]);

  const decision = note.decision;
  // Nothing to show on the public link, or to a viewer when no decision was ever requested
  if (members.size === 0 || (!decision && !canEdit)) return null;
  const nameOf = (id: string) => members.get(id)?.name ?? "Former member";
  const isDecider = !!user && decision?.deciderId === user.id;

  const startAsking = () => {
    setQuestion(note.content);
    setDeciderId("");
    setDueDate("");
    setError(null);
    setAsking(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestDecision({
        noteId: note._id as Id<"notes">,
        question,
        deciderId: deciderId as Id<"users">,
        dueDate,
      });
      setAsking(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const heading = (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
      <GavelIcon className="h-3.5 w-3.5" aria-hidden="true" />
      Decision
    </span>
  );

  if (decision?.status === "open") {
    return (
      <div className="space-y-2">
        {heading}
        <div className="space-y-1 rounded-lg border border-line bg-surface-2 p-3 text-xs">
          <p className="text-sm font-semibold text-ink">{decision.question}</p>
          <p className="text-muted">
            {nameOf(decision.requestedBy)} asked {isDecider ? "you" : nameOf(decision.deciderId)} · due{" "}
            {formatCalendarDate(decision.dueDate)}
          </p>
        </div>
        {isDecider && <DecisionAnswerForm noteId={note._id} />}
        {canEdit && (
          <button
            type="button"
            onClick={() => void withdrawDecision({ noteId: note._id as Id<"notes"> })}
            className="text-[11px] text-muted underline hover:text-rose-600"
          >
            Withdraw request
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {heading}
      {decision && (
        <div className="space-y-1 rounded-lg border border-line bg-surface-2 p-3 text-xs">
          <p className="font-semibold text-ink">
            {STATUS_LABEL[decision.status]} by {nameOf(decision.deciderId)}
          </p>
          <p className="text-muted">{decision.question}</p>
          {decision.comment && <p className="italic text-ink">“{decision.comment}”</p>}
        </div>
      )}

      {canEdit &&
        (asking ? (
          <form onSubmit={submit} className="space-y-2 rounded-lg border border-line p-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-muted">Question</span>
              <textarea
                rows={2}
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full resize-none rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted">Who decides</span>
                <select
                  required
                  value={deciderId}
                  onChange={(e) => setDeciderId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {[...members.values()]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted">Needed by</span>
                <input
                  type="date"
                  required
                  value={dueDate}
                  min={todayLocal()}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
            </div>
            <p className="text-[11px] text-muted">They'll get an email with a link to answer, even with view-only access.</p>
            {error && <p className="text-xs text-rose-700">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-surface">
                Send request
              </button>
              <button type="button" onClick={() => setAsking(false)} className="rounded-md px-3 py-1.5 text-xs text-muted hover:text-ink">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={startAsking}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-2"
          >
            {decision ? "Ask again" : "Ask for a decision"}
          </button>
        ))}
    </div>
  );
}

/** "2 decisions for you", linking to /decisions. Hidden when there are none. */
export function DecisionsWaitingChip() {
  const open = useQuery(api.decisions.myOpenDecisions);
  if (!open || open.length === 0) return null;
  return (
    <Link
      href="/decisions"
      title={`${open.length} ${open.length === 1 ? "decision" : "decisions"} waiting for you`}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-ink bg-ink px-2 py-0.5 text-[11px] font-semibold text-surface hover:opacity-90"
    >
      <GavelIcon size={12} aria-hidden="true" />
      {open.length}
      <span className="hidden sm:inline">{open.length === 1 ? "decision" : "decisions"} for you</span>
    </Link>
  );
}

export interface WaitingDecision {
  noteId: string;
  canvasId: string;
  canvasTitle: string;
  noteText: string;
  question: string;
  dueDate: string;
  requestedBy: string;
}

/** One decision on the /decisions page: what's asked, by whom, by when, and the answer buttons. */
export function DecisionCard({
  decision: d,
  onAnswered,
}: {
  decision: WaitingDecision;
  onAnswered?: (answer: DecisionAnswer) => void;
}) {
  const overdue = d.dueDate < todayLocal();
  return (
    <article className="space-y-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          <Link href={`/canvas/${d.canvasId}`} className="hover:underline">
            {d.canvasTitle}
          </Link>
        </p>
        <h2 className="text-base font-semibold leading-snug text-ink">{d.question}</h2>
        <p className={`text-xs ${overdue ? "font-semibold text-rose-700" : "text-muted"}`}>
          Asked by {d.requestedBy} · {overdue ? "overdue, was " : ""}due {formatCalendarDate(d.dueDate)}
        </p>
      </div>
      {d.noteText !== d.question && <p className="rounded-lg bg-surface-2 p-2.5 text-sm text-ink">{d.noteText}</p>}
      <DecisionAnswerForm noteId={d.noteId} onAnswered={onAnswered} />
    </article>
  );
}
