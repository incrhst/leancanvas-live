import { testStage } from "./testFields";

/**
 * The simple view of a plan for everyone who isn't the operator: each note is either waiting on a
 * call, being tested, or agreed. It answers "have we decided?" only; "how sure are we?" stays on the
 * note's evidence state, which the operator sees in full on the canvas. All the rules live here.
 */
export type PlanStatus = "needs_call" | "testing" | "agreed";

/** Why a note is where it is, so the card can say it in plain words. */
export type PlanStatusReason =
  // needs_call
  | "decision_open"
  | "decision_overdue"
  | "changes_requested"
  | "rejected"
  | "contradicted_after_agreed"
  | "contradicted"
  | "result_in"
  // testing
  | "test_running"
  | "test_due"
  // agreed
  | "decision_agreed"
  | "committed";

export const PLAN_STATUSES: PlanStatus[] = ["needs_call", "testing", "agreed"];

/** The fields the rules read. Works for a stored note and for the client's NoteItem. */
export interface PlanStatusNote {
  evidenceState: string;
  measure?: string;
  passMark?: string;
  reviewDate?: string;
  latestResult?: { date: string };
  decision?: { status: string; dueDate: string };
}

/**
 * Where a note stands, or null when nothing is in motion on it (no decision asked, no test, not
 * contradicted, not committed). Checked in this order; the first rule that matches wins:
 *
 * With a decision request on the note:
 * 1. open: needs a call (overdue once the due date has passed)
 * 2. changes requested or rejected: needs a call (the decider sent it back or turned it down)
 * 3. approved or an option chosen, but the evidence now goes against it: needs a call
 * 4. approved or an option chosen: agreed
 *
 * Without one:
 * 5. contradicted: needs a call (a test said no; someone has to decide what changes)
 * 6. committed (evidence state "decision"): agreed
 * 7. a test with no result yet: testing (still testing once its review date passes)
 * 8. a test whose result is in: needs a call (nobody has agreed what it means)
 *
 * `today` is YYYY-MM-DD.
 */
export function planStatusOf(
  note: PlanStatusNote,
  today: string
): { status: PlanStatus; reason: PlanStatusReason } | null {
  const decision = note.decision;
  if (decision) {
    if (decision.status === "open") {
      return { status: "needs_call", reason: decision.dueDate < today ? "decision_overdue" : "decision_open" };
    }
    if (decision.status === "changes_requested") return { status: "needs_call", reason: "changes_requested" };
    if (decision.status === "rejected") return { status: "needs_call", reason: "rejected" };
    if (isAgreed(decision.status)) {
      if (note.evidenceState === "contradicted") return { status: "needs_call", reason: "contradicted_after_agreed" };
      return { status: "agreed", reason: "decision_agreed" };
    }
  }

  if (note.evidenceState === "contradicted") return { status: "needs_call", reason: "contradicted" };
  if (note.evidenceState === "decision") return { status: "agreed", reason: "committed" };

  const stage = testStage(note, today);
  if (stage === "running") return { status: "testing", reason: "test_running" };
  if (stage === "due") return { status: "testing", reason: "test_due" };
  if (stage === "result") return { status: "needs_call", reason: "result_in" };
  return null;
}

/** A decision counts as made when it was approved or one of its options was chosen. */
function isAgreed(status: string) {
  return status === "approved" || status === "decided";
}

/**
 * "X of N decided": decisions approved (or with an option chosen) out of every decision asked for
 * on the canvas. Rejected and sent-back requests count toward N but not X; withdrawn ones are gone.
 */
export function decidedCount(notes: { decision?: { status: string } }[]): { decided: number; total: number } {
  let decided = 0;
  let total = 0;
  for (const note of notes) {
    if (!note.decision) continue;
    total++;
    if (isAgreed(note.decision.status)) decided++;
  }
  return { decided, total };
}
