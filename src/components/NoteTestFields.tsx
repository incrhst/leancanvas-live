import React, { useContext, useEffect, useState } from "react";
import { FlaskConicalIcon } from "lucide-react";
import { EvidenceState, LatestResult, NoteItem, Verdict } from "../types/canvas";
import { EVIDENCE_CONFIG } from "./EvidenceBadge";
import { VERDICT_CONFIG, formatPlanDate, hasTest, isReviewOverdue, todayLocal } from "../utils/testFields";
import { VERDICT_EVIDENCE, addDays, daysBetween, testStage } from "../../convex/lib/testFields";
import { LaunchDateContext } from "../utils/launchDate";

export type TestFieldsPatch = {
  measure?: string | null;
  passMark?: string | null;
  reviewDate?: string | null;
  latestResult?: LatestResult | null;
};

interface NoteTestFieldsProps {
  note: NoteItem;
  canEdit: boolean;
  onUpdate?: (patch: TestFieldsPatch) => void;
  /** Planning a first test was cancelled: the note goes back to its plain next step */
  onCancelNew?: () => void;
  /** Accepts the evidence state a result points to, saving the result as the reason */
  onApplyResult?: (state: EvidenceState, reason: string) => Promise<void>;
}

const VERDICTS: Verdict[] = ["pass", "fail", "inconclusive"];

/** Where a saved test is, by the viewer's calendar (same rules as the MCP server's list_tests) */
function stageOf(note: NoteItem) {
  return testStage(note, todayLocal()) ?? "running";
}

const textButton =
  "min-h-9 rounded-md px-2 text-[13px] text-ink/80 hover:bg-surface-2 hover:text-ink transition-colors";
const primaryButton =
  "min-h-10 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const blankInput =
  "w-full border-0 border-b-[1.5px] border-stone-400 bg-transparent px-0 py-0.5 text-sm text-ink placeholder:text-stone-400 focus:border-ink focus:outline-none focus:ring-0";

/**
 * A note's test, one step at a time: plan it as a sentence, let it run, record what we saw at the
 * review, then take the evidence state the result points to. Only the current step shows.
 */
export function NoteTestFields({ note, canEdit, onUpdate, onCancelNew, onApplyResult }: NoteTestFieldsProps) {
  const editable = canEdit && !!onUpdate;
  // "plan" and "record" are local editing modes; otherwise the saved test decides what shows
  const [mode, setMode] = useState<"view" | "plan" | "record">(hasTest(note) ? "view" : "plan");
  const [rerun, setRerun] = useState(false);

  useEffect(() => {
    setMode(hasTest(note) ? "view" : "plan");
    setRerun(false);
    // Only when another note opens; a test saved here keeps the mode the buttons set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note._id]);

  if (!hasTest(note) && mode !== "plan") return null;
  if (!editable) return <ReadOnlyTest note={note} />;

  if (mode === "plan") {
    return (
      <PlanTest
        note={note}
        rerun={rerun}
        onStart={(patch) => {
          onUpdate!(rerun ? { ...patch, latestResult: null } : patch);
          setMode("view");
          setRerun(false);
        }}
        onCancel={() => {
          setRerun(false);
          if (hasTest(note)) setMode("view");
          else onCancelNew?.();
        }}
      />
    );
  }

  const stage = stageOf(note);
  if (mode === "record" || stage === "due") {
    return (
      <RecordResult
        note={note}
        due={stage === "due"}
        onSave={(latestResult) => {
          onUpdate!({ latestResult });
          setMode("view");
        }}
        onCancel={mode === "record" ? () => setMode("view") : undefined}
      />
    );
  }

  if (stage === "result") {
    return (
      <TestResult
        note={note}
        onApplyResult={onApplyResult}
        onRunAnother={() => {
          setRerun(true);
          setMode("plan");
        }}
        onEditResult={() => setMode("record")}
      />
    );
  }

  return <TestRunning note={note} onEdit={() => setMode("plan")} onRecord={() => setMode("record")} />;
}

function TestHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
      <FlaskConicalIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/** "We watch X. It passes if Y." from whichever parts are set */
function TestSentence({ note }: { note: NoteItem }) {
  if (!note.measure && !note.passMark) return null;
  return (
    <p className="text-sm leading-relaxed text-ink/80">
      {note.measure && (
        <>
          We watch <strong className="font-semibold text-ink">{note.measure}</strong>.{" "}
        </>
      )}
      {note.passMark && (
        <>
          It passes if <strong className="font-semibold text-ink">{note.passMark}</strong>.
        </>
      )}
    </p>
  );
}

/** "Day 30, in 12 days" / "8 Nov, today" */
function useReviewLabel(date: string) {
  const launchDate = useContext(LaunchDateContext);
  const days = daysBetween(todayLocal(), date);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : days > 1 ? `in ${days} days` : null;
  return `${formatPlanDate(launchDate, date)}${when ? `, ${when}` : ""}`;
}

function TestRunning({ note, onEdit, onRecord }: { note: NoteItem; onEdit: () => void; onRecord: () => void }) {
  const review = useReviewLabel(note.reviewDate ?? todayLocal());
  return (
    <div className="space-y-2">
      <TestHeading>
        Test running{note.reviewDate ? ` · review ${review}` : " · no review date"}
      </TestHeading>
      <TestSentence note={note} />
      <div className="-ml-2 flex flex-wrap gap-1">
        <button type="button" onClick={onEdit} className={textButton}>
          Edit
        </button>
        <button type="button" onClick={onRecord} className={textButton}>
          Record a result now
        </button>
      </div>
    </div>
  );
}

function PlanTest({
  note,
  rerun,
  onStart,
  onCancel,
}: {
  note: NoteItem;
  rerun: boolean;
  onStart: (patch: TestFieldsPatch) => void;
  onCancel: () => void;
}) {
  const launchDate = useContext(LaunchDateContext);
  const [measure, setMeasure] = useState(note.measure ?? "");
  // A fresh run needs a review date that hasn't passed
  const [reviewDate, setReviewDate] = useState(
    !rerun && note.reviewDate ? note.reviewDate : addDays(todayLocal(), 30)
  );
  const [passMark, setPassMark] = useState(note.passMark ?? "");
  const ready = !!measure.trim() && !!passMark.trim() && !!reviewDate;
  const id = `test-${note._id}`;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onStart({ measure: measure.trim(), passMark: passMark.trim(), reviewDate });
      }}
    >
      <TestHeading>How we'd know if this is wrong</TestHeading>
      <div className="space-y-1.5 text-sm leading-relaxed text-ink/80">
        <label htmlFor={`${id}-measure`} className="block">
          We watch
        </label>
        <input
          id={`${id}-measure`}
          value={measure}
          maxLength={200}
          autoFocus
          onChange={(e) => setMeasure(e.target.value)}
          placeholder="e.g. cost per budget-tool start, by post"
          className={blankInput}
        />
        <label htmlFor={`${id}-pass`} className="block pt-1">
          and it passes if
        </label>
        <input
          id={`${id}-pass`}
          value={passMark}
          maxLength={200}
          onChange={(e) => setPassMark(e.target.value)}
          placeholder="e.g. below $2 per start"
          className={blankInput}
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          <label htmlFor={`${id}-review`}>We look again on</label>
          <input
            id={`${id}-review`}
            type="date"
            value={reviewDate}
            min={todayLocal()}
            onChange={(e) => setReviewDate(e.target.value)}
            className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
          />
          {launchDate && reviewDate && (
            <span className="text-xs text-muted">{formatPlanDate(launchDate, reviewDate)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button type="submit" disabled={!ready} className={primaryButton}>
          {rerun ? "Start new test" : "Start test"}
        </button>
        <button type="button" onClick={onCancel} className={textButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RecordResult({
  note,
  due,
  onSave,
  onCancel,
}: {
  note: NoteItem;
  due: boolean;
  onSave: (result: LatestResult) => void;
  onCancel?: () => void;
}) {
  const launchDate = useContext(LaunchDateContext);
  // Editing a result picks up where it was; a new one starts blank
  const existing = note.latestResult && stageOf(note) === "result" ? note.latestResult : null;
  const [text, setText] = useState(existing?.text ?? "");
  const [verdict, setVerdict] = useState<Verdict | undefined>(existing?.verdict);
  const overdue = isReviewOverdue(note);
  const id = `result-${note._id}`;

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || !verdict) return;
        onSave({ text: text.trim(), verdict, date: existing?.date ?? todayLocal() });
      }}
    >
      {due && note.reviewDate ? (
        <p className="inline-flex rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
          Review {overdue && note.reviewDate < todayLocal() ? "overdue" : "due"} ·{" "}
          {formatPlanDate(launchDate, note.reviewDate)}
        </p>
      ) : (
        <TestHeading>Record a result</TestHeading>
      )}
      {note.passMark && (
        <p className="text-[13px] text-muted">
          Passes if <strong className="font-semibold text-ink">{note.passMark}</strong>
        </p>
      )}
      <label htmlFor={id} className="block text-xs font-semibold text-muted">
        What did we see?
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. $3.10 per start"
        className="w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
      />
      <div role="group" aria-label="Verdict" className="grid grid-cols-3 gap-1.5">
        {VERDICTS.map((v) => {
          const conf = VERDICT_CONFIG[v];
          const active = verdict === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              onClick={() => setVerdict(active ? undefined : v)}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-1 text-xs transition-colors ${
                active
                  ? `border-2 border-current bg-surface font-semibold ${conf.text}`
                  : "border border-line bg-surface text-ink/80 hover:bg-surface-2"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${conf.dot}`} aria-hidden="true" />
              {conf.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <button type="submit" disabled={!text.trim() || !verdict} className={primaryButton}>
          Save result
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={textButton}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ResultLine({ note }: { note: NoteItem }) {
  const launchDate = useContext(LaunchDateContext);
  const result = note.latestResult;
  if (!result) return null;
  const conf = result.verdict ? VERDICT_CONFIG[result.verdict] : null;
  return (
    <p className="text-sm leading-relaxed text-ink/80">
      {conf && <strong className={`font-bold ${conf.text}`}>{conf.label} · </strong>}
      {result.text} <span className="text-muted">({formatPlanDate(launchDate, result.date)})</span>
    </p>
  );
}

function TestResult({
  note,
  onApplyResult,
  onRunAnother,
  onEditResult,
}: {
  note: NoteItem;
  onApplyResult?: (state: EvidenceState, reason: string) => Promise<void>;
  onRunAnother: () => void;
  onEditResult: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState<EvidenceState | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const result = note.latestResult!;
  const target: EvidenceState | undefined =
    result.verdict && result.verdict !== "inconclusive" ? VERDICT_EVIDENCE[result.verdict] : undefined;
  const pending = target && note.evidenceState !== target ? target : null;
  const unclear = result.verdict === "inconclusive";
  const suggest = !dismissed && !applied && ((pending && onApplyResult) || unclear);

  const apply = async () => {
    if (!pending || !onApplyResult) return;
    setStatus("saving");
    try {
      const verdict = result.verdict ? `${VERDICT_CONFIG[result.verdict].label}: ` : "";
      await onApplyResult(pending, `${verdict}${result.text}`);
      setApplied(pending);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="space-y-2.5">
      <TestHeading>Test result</TestHeading>
      <ResultLine note={note} />
      {suggest && (
        <div className="space-y-2.5 rounded-lg border border-line bg-surface-2 p-3">
          <p className="text-[13px] text-ink/80">
            {pending
              ? result.verdict === "pass"
                ? "The result backs this note."
                : "The result goes against this note."
              : "Not clear either way. Try a sharper test?"}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {pending ? (
              <button type="button" onClick={apply} disabled={status === "saving"} className={primaryButton}>
                Mark as {EVIDENCE_CONFIG[pending].label.toLowerCase()}
              </button>
            ) : (
              <button type="button" onClick={onRunAnother} className={primaryButton}>
                Plan another test
              </button>
            )}
            <button type="button" onClick={() => setDismissed(true)} className={textButton}>
              Not yet
            </button>
          </div>
          {status === "error" && (
            <p className="text-[11px] text-rose-700">Couldn't update the note. Try again.</p>
          )}
        </div>
      )}
      {applied && (
        <p className="text-xs text-muted" aria-live="polite">
          Marked {EVIDENCE_CONFIG[applied].label.toLowerCase()}. The result is saved as the reason in history.
        </p>
      )}
      <div className="-ml-2 flex flex-wrap gap-1">
        {!(suggest && unclear) && (
          <button type="button" onClick={onRunAnother} className={textButton}>
            Run another test
          </button>
        )}
        <button type="button" onClick={onEditResult} className={textButton}>
          Edit result
        </button>
      </div>
    </div>
  );
}

/** What viewers without edit rights see: the same stages, without the actions */
function ReadOnlyTest({ note }: { note: NoteItem }) {
  const launchDate = useContext(LaunchDateContext);
  const stage = stageOf(note);
  return (
    <div className="space-y-2">
      <TestHeading>
        {stage === "result"
          ? "Test result"
          : stage === "due" && note.reviewDate
            ? `Test · review ${isReviewOverdue(note) ? "overdue" : "due"}, ${formatPlanDate(launchDate, note.reviewDate)}`
            : note.reviewDate
              ? `Test running · review ${formatPlanDate(launchDate, note.reviewDate)}`
              : "Test running"}
      </TestHeading>
      <TestSentence note={note} />
      {stage === "result" && <ResultLine note={note} />}
    </div>
  );
}
