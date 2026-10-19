import { describe, expect, test } from "vitest";
import { decidedCount, planStatusOf, PlanStatusNote } from "./planStatus";

const today = "2026-10-19";

function note(patch: Partial<PlanStatusNote> = {}): PlanStatusNote {
  return { evidenceState: "assumption", ...patch };
}

const decision = (status: string, dueDate = "2026-10-30") => ({ status, dueDate });

describe("planStatusOf", () => {
  test("a note with nothing in motion is left out", () => {
    expect(planStatusOf(note(), today)).toBeNull();
    expect(planStatusOf(note({ evidenceState: "unknown" }), today)).toBeNull();
    // How sure we are is not whether we've decided
    expect(planStatusOf(note({ evidenceState: "supported" }), today)).toBeNull();
    expect(planStatusOf(note({ evidenceState: "observed" }), today)).toBeNull();
  });

  test("an open decision needs a call, and says when it's overdue", () => {
    expect(planStatusOf(note({ decision: decision("open") }), today)).toEqual({
      status: "needs_call",
      reason: "decision_open",
    });
    expect(planStatusOf(note({ decision: decision("open", today) }), today)?.reason).toBe("decision_open");
    expect(planStatusOf(note({ decision: decision("open", "2026-10-18") }), today)).toEqual({
      status: "needs_call",
      reason: "decision_overdue",
    });
  });

  test("an open decision wins over a running test", () => {
    const n = note({ measure: "Signups", reviewDate: "2026-11-01", decision: decision("open") });
    expect(planStatusOf(n, today)?.status).toBe("needs_call");
  });

  test("sent back or turned down needs another call", () => {
    expect(planStatusOf(note({ decision: decision("changes_requested") }), today)).toEqual({
      status: "needs_call",
      reason: "changes_requested",
    });
    expect(planStatusOf(note({ decision: decision("rejected") }), today)).toEqual({
      status: "needs_call",
      reason: "rejected",
    });
  });

  test("approved, or an option chosen, is agreed", () => {
    expect(planStatusOf(note({ decision: decision("approved") }), today)).toEqual({
      status: "agreed",
      reason: "decision_agreed",
    });
    expect(planStatusOf(note({ decision: decision("decided") }), today)?.status).toBe("agreed");
    // Even past its due date: it was answered
    expect(planStatusOf(note({ decision: decision("approved", "2026-01-01") }), today)?.status).toBe("agreed");
    // Even while a new test runs on it
    const testing = note({ measure: "Repeat bookings", reviewDate: "2026-11-01", decision: decision("approved") });
    expect(planStatusOf(testing, today)?.status).toBe("agreed");
  });

  test("a contradicted note behind an agreed decision needs a call", () => {
    expect(planStatusOf(note({ evidenceState: "contradicted", decision: decision("approved") }), today)).toEqual({
      status: "needs_call",
      reason: "contradicted_after_agreed",
    });
    expect(planStatusOf(note({ evidenceState: "contradicted", decision: decision("decided") }), today)?.reason).toBe(
      "contradicted_after_agreed"
    );
  });

  test("a contradicted note with no decision needs a call", () => {
    expect(planStatusOf(note({ evidenceState: "contradicted" }), today)).toEqual({
      status: "needs_call",
      reason: "contradicted",
    });
    // Even with its test still open
    const n = note({ evidenceState: "contradicted", measure: "Signups", reviewDate: "2026-11-01" });
    expect(planStatusOf(n, today)?.reason).toBe("contradicted");
  });

  test("a note the team committed to is agreed", () => {
    expect(planStatusOf(note({ evidenceState: "decision" }), today)).toEqual({ status: "agreed", reason: "committed" });
  });

  test("a test with no result is testing, still after its review date", () => {
    expect(planStatusOf(note({ measure: "Signups" }), today)).toEqual({ status: "testing", reason: "test_running" });
    expect(planStatusOf(note({ passMark: "50 a week", reviewDate: "2026-11-01" }), today)?.reason).toBe("test_running");
    expect(planStatusOf(note({ measure: "Signups", reviewDate: today }), today)).toEqual({
      status: "testing",
      reason: "test_due",
    });
    // A result from before the review date is an early reading, not the result
    const early = note({ measure: "Signups", reviewDate: "2026-10-10", latestResult: { date: "2026-10-01" } });
    expect(planStatusOf(early, today)?.reason).toBe("test_due");
  });

  test("a test whose result is in needs a call", () => {
    const n = note({ evidenceState: "supported", measure: "Signups", latestResult: { date: "2026-10-12" } });
    expect(planStatusOf(n, today)).toEqual({ status: "needs_call", reason: "result_in" });
    const onTime = note({ measure: "Signups", reviewDate: "2026-10-10", latestResult: { date: "2026-10-10" } });
    expect(planStatusOf(onTime, today)?.reason).toBe("result_in");
  });
});

describe("decidedCount", () => {
  test("counts approved and chosen out of every decision asked for", () => {
    expect(
      decidedCount([
        { decision: decision("approved") },
        { decision: decision("decided") },
        { decision: decision("open") },
        { decision: decision("rejected") },
        { decision: decision("changes_requested") },
        {},
      ])
    ).toEqual({ decided: 2, total: 5 });
  });

  test("no decisions asked is 0 of 0", () => {
    expect(decidedCount([{}, {}])).toEqual({ decided: 0, total: 0 });
  });
});
