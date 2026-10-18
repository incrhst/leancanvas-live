import React, { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Clock3Icon, GavelIcon, LinkIcon, PlusIcon, XIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DecisionStatus, NoteItem } from "../types/canvas";
import { MembersContext } from "../utils/members";
import { formatCalendarDate, formatPlanDate, todayLocal } from "../utils/testFields";
import { LaunchDateContext } from "../utils/launchDate";
import { useAuth } from "./ConvexClientProvider";
import { defaultOutcomeLine, isPastDue } from "../../convex/lib/decisionText";

export type DecisionAnswer = "approve" | "reject" | "change" | "choose";

const STATUS_LABEL: Record<DecisionStatus, string> = {
  open: "Decision needed",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  decided: "Decided",
};

const MAX_OPTIONS = 4;

/** "Approved", or the option chosen: "Decided: Build in-house". */
export function outcomeLabel(decision: { status: DecisionStatus; choice?: string }) {
  return decision.status === "decided" && decision.choice ? `Decided: ${decision.choice}` : STATUS_LABEL[decision.status];
}

/**
 * What happens if nobody decides: "If nothing is decided by 1 November, we sign the agency."
 * Past the due date on an open request, it says plainly that the default now applies. It only
 * says so; nothing on the note changes until someone answers.
 */
export function DecisionDefault({
  decision,
  size = "sm",
}: {
  decision: { defaultOutcome?: string; dueDate: string; status: DecisionStatus };
  size?: "sm" | "lg";
}) {
  const today = todayLocal();
  const line = defaultOutcomeLine(decision, today);
  if (!line) return null;
  const applies = decision.status === "open" && isPastDue(decision.dueDate, today);
  const text = size === "lg" ? "rounded-xl px-4 py-3 text-[15px] leading-snug" : "rounded-lg px-3 py-2 text-xs";
  return (
    <p
      className={`flex items-start gap-2 border ${text} ${
        applies ? "border-amber-400 bg-amber-100 text-amber-950" : "border-amber-200 bg-amber-50 text-amber-950"
      }`}
    >
      <Clock3Icon
        className={`${size === "lg" ? "mt-0.5 h-[18px] w-[18px]" : "mt-0.5 h-3.5 w-3.5"} shrink-0 text-amber-800`}
        aria-hidden="true"
      />
      <span>
        {line}
      </span>
    </p>
  );
}

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

  const decider = members.get(decision.deciderId)?.name ?? decision.deciderName;
  const overdue = decision.status === "open" && isPastDue(decision.dueDate, todayLocal());
  const fallback = defaultOutcomeLine(decision, todayLocal());
  return (
    <p
      className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] ${overdue ? "font-semibold text-rose-700" : "text-muted"}`}
      title={`${STATUS_LABEL[decision.status]}: ${decision.question}${fallback ? `\n${fallback}` : ""}`}
    >
      <GavelIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {decision.status === "open" ? (
        <>
          <span className="font-semibold text-ink">{decider ? `Waiting on ${decider.split(" ")[0]}` : "Decision needed"}</span>
          <span aria-hidden="true">·</span>
          <span>
            {overdue
              ? decision.defaultOutcome
                ? "overdue, default applies"
                : "overdue"
              : `due ${formatPlanDate(launchDate, decision.dueDate).replace(/^Day/, "day")}`}
          </span>
        </>
      ) : (
        <span className="font-semibold text-ink">Changes requested</span>
      )}
    </p>
  );
}

/**
 * The decision answer buttons, shared by the note panel and the /decisions page: approve / reject,
 * or one button per option when the request has options.
 */
export function DecisionAnswerForm({
  noteId,
  options,
  onAnswered,
}: {
  noteId: string;
  options?: string[];
  onAnswered?: (answer: DecisionAnswer, choice?: string) => void;
}) {
  const answerDecision = useMutation(api.decisions.answerDecision);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answer = async (kind: DecisionAnswer, choice?: string) => {
    if (kind === "change" && !comment.trim()) {
      setError("Say what should change, then press Ask for a change.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await answerDecision({ noteId: noteId as Id<"notes">, answer: kind, choice, comment: comment.trim() || undefined });
      onAnswered?.(kind, choice);
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
      {options ? (
        <div className="grid gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => answer("choose", option)}
              className={`${button} bg-ink text-surface hover:opacity-90`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => answer("approve")} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>
            Approve
          </button>
          <button type="button" disabled={busy} onClick={() => answer("reject")} className={`${button} bg-rose-600 text-white hover:bg-rose-700`}>
            Reject
          </button>
        </div>
      )}
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
  const replaceDecisionLink = useMutation(api.decisions.replaceDecisionLink);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [deciderId, setDeciderId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [defaultOutcome, setDefaultOutcome] = useState("");
  // null = approve / reject; otherwise the decider picks one of these
  const [options, setOptions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  useEffect(() => {
    setAsking(false);
    setError(null);
    setLinkNotice(null);
  }, [note._id]);

  const decision = note.decision;
  if (!decision && !canEdit) return null;
  // The public link has no member list: show the request read-only, without who asked
  if (members.size === 0) return decision ? <PublicDecision decision={decision} /> : null;
  const nameOf = (id: string) => members.get(id)?.name ?? "Former member";
  const isDecider = !!user && decision?.deciderId === user.id;

  const startAsking = () => {
    setQuestion(note.content);
    setDeciderId("");
    setDueDate("");
    setDefaultOutcome("");
    setOptions(null);
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
        defaultOutcome: defaultOutcome.trim() || undefined,
        options: options ? options.map((o) => o.trim()).filter(Boolean) : undefined,
      });
      setAsking(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const changeLink = async (off: boolean) => {
    setLinkNotice(null);
    try {
      await replaceDecisionLink({ noteId: note._id as Id<"notes">, off });
      setLinkNotice(off ? "Link turned off. They can still answer in the app." : "New link emailed. The old one no longer works.");
    } catch (err) {
      setLinkNotice(errorMessage(err));
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
          {decision.options && <p className="text-muted">Options: {decision.options.join(" / ")}</p>}
        </div>
        <DecisionDefault decision={decision} />
        {isDecider && <DecisionAnswerForm noteId={note._id} options={decision.options} />}
        {canEdit && (
          <div className="space-y-1">
            {!isDecider && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                {decision.linkTokenHash
                  ? "Their emailed link answers without signing in."
                  : "No answer link. They answer in the app."}
              </p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {!isDecider && (
                <button type="button" onClick={() => void changeLink(false)} className="text-[11px] text-muted underline hover:text-ink">
                  {decision.linkTokenHash ? "Send a new link" : "Send a link"}
                </button>
              )}
              {!isDecider && decision.linkTokenHash && (
                <button type="button" onClick={() => void changeLink(true)} className="text-[11px] text-muted underline hover:text-ink">
                  Turn off link
                </button>
              )}
              <button
                type="button"
                onClick={() => void withdrawDecision({ noteId: note._id as Id<"notes"> })}
                className="text-[11px] text-muted underline hover:text-rose-600"
              >
                Withdraw request
              </button>
            </div>
            {linkNotice && <p className="text-[11px] text-ink">{linkNotice}</p>}
          </div>
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
            {outcomeLabel(decision)} by {nameOf(decision.deciderId)}
          </p>
          <p className="text-muted">{decision.question}</p>
          {decision.comment && <p className="italic text-ink">“{decision.comment}”</p>}
          {decision.answeredVia === "link" && (
            <p className="text-muted">
              Answered from the emailed link
              {decision.answeredByName && decision.answeredByName !== nameOf(decision.deciderId)
                ? `, signed “${decision.answeredByName}”`
                : ""}
            </p>
          )}
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
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-muted">If nobody decides by then (optional)</span>
              <input
                type="text"
                value={defaultOutcome}
                maxLength={200}
                onChange={(e) => setDefaultOutcome(e.target.value)}
                placeholder="e.g. We sign the agency"
                className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-medium text-muted">Answers</legend>
              <div className="flex gap-1 rounded-lg border border-line p-0.5 text-xs">
                {[
                  { label: "Approve or reject", value: false },
                  { label: "Pick an option", value: true },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={(options !== null) === value}
                    onClick={() => setOptions(value ? options ?? ["", ""] : null)}
                    className={`flex-1 rounded-md px-2 py-1 font-medium ${
                      (options !== null) === value ? "bg-ink text-surface" : "text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {options && (
                <div className="space-y-1.5">
                  {options.map((option, i) => (
                    <div key={i} className="flex gap-1">
                      <input
                        type="text"
                        required={i < 2}
                        value={option}
                        maxLength={60}
                        onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                        placeholder={["e.g. Sign the agency", "e.g. Build in-house", "e.g. Ask me Friday", "Another option"][i]}
                        aria-label={`Option ${i + 1}`}
                        className="w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      {i >= 2 && (
                        <button
                          type="button"
                          onClick={() => setOptions(options.filter((_, j) => j !== i))}
                          aria-label={`Remove option ${i + 1}`}
                          className="grid w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {options.length < MAX_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => setOptions([...options, ""])}
                      className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink"
                    >
                      <PlusIcon className="h-3 w-3" aria-hidden="true" />
                      Add an option
                    </button>
                  )}
                </div>
              )}
            </fieldset>
            <p className="text-[11px] text-muted">
              They'll get an email with a link that answers from their phone, no sign-in needed, even with view-only access.
            </p>
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

/** A decision on the public link: what's asked, by when, the default, and the outcome once made. */
function PublicDecision({ decision }: { decision: NonNullable<NoteItem["decision"]> }) {
  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <GavelIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Decision
      </span>
      <div className="space-y-1 rounded-lg border border-line bg-surface-2 p-3 text-xs">
        <p className="font-semibold text-ink">
          {decision.status === "open"
            ? `${decision.deciderName ? `Waiting on ${decision.deciderName}` : "Decision needed"} · due ${formatCalendarDate(decision.dueDate)}`
            : outcomeLabel(decision)}
        </p>
        <p className="text-muted">{decision.question}</p>
        {decision.status === "open" && decision.options && <p className="text-muted">Options: {decision.options.join(" / ")}</p>}
      </div>
      <DecisionDefault decision={decision} />
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
  defaultOutcome?: string;
  options?: string[];
  requestedBy: string;
}

/** One decision on the /decisions page: what's asked, by whom, by when, and the answer buttons. */
export function DecisionCard({
  decision: d,
  onAnswered,
}: {
  decision: WaitingDecision;
  onAnswered?: (answer: DecisionAnswer, choice?: string) => void;
}) {
  const overdue = isPastDue(d.dueDate, todayLocal());
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
      <DecisionDefault decision={{ ...d, status: "open" }} />
      <DecisionAnswerForm noteId={d.noteId} options={d.options} onAnswered={onAnswered} />
    </article>
  );
}
