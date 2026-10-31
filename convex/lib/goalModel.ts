import { v } from "convex/values";

/**
 * The words a team sees for goals, items and decisions. Plain on purpose: no one should need
 * teaching. Pure (no ctx), so the app and the MCP route can import it too.
 */

/** Where an item is: nobody knows yet, a test is running, a call has been made, the call was acted on. */
export const ITEM_STATES = ["open", "testing", "decided", "done"] as const;
export type ItemState = (typeof ITEM_STATES)[number];
export const itemStateValidator = v.union(
  v.literal("open"),
  v.literal("testing"),
  v.literal("decided"),
  v.literal("done")
);

export const ITEM_STATE_LABELS: Record<ItemState, string> = {
  open: "Open",
  testing: "Testing",
  decided: "Decided",
  done: "Done",
};

export const ITEM_STATE_MEANINGS: Record<ItemState, string> = {
  open: "nobody knows yet",
  testing: "a test is running and the team is learning",
  decided: "a call has been made; what remains is doing it",
  done: "the decision has been acted on",
};

/** What a decision rests on. Judgment calls are valid. */
export const DECISION_BASES = ["test", "data", "expert", "judgment"] as const;
export type DecisionBasis = (typeof DECISION_BASES)[number];
export const decisionBasisValidator = v.union(
  v.literal("test"),
  v.literal("data"),
  v.literal("expert"),
  v.literal("judgment")
);

export const DECISION_BASIS_LABELS: Record<DecisionBasis, string> = {
  test: "Test result",
  data: "Existing data",
  expert: "Expert view",
  judgment: "Judgment call",
};

/** The look-back answer on a decision's review date: did it pan out? */
export const LOOK_BACK_ANSWERS = ["yes", "no", "partly"] as const;
export type LookBack = (typeof LOOK_BACK_ANSWERS)[number];
export const lookBackValidator = v.union(v.literal("yes"), v.literal("no"), v.literal("partly"));

export const LOOK_BACK_LABELS: Record<LookBack, string> = { yes: "Yes", no: "No", partly: "Partly" };

/** How many canvas notes one item, or one decision record, can link to. */
export const MAX_CONTEXT_NOTES = 20;

/** Days from decision to look-back when nobody picks a date. */
export const DEFAULT_REVIEW_DAYS = 30;

export type ItemCounts = Record<ItemState, number>;

export function emptyCounts(): ItemCounts {
  return { open: 0, testing: 0, decided: 0, done: 0 };
}

export function countItems(items: { state: ItemState }[]): ItemCounts {
  const counts = emptyCounts();
  for (const item of items) counts[item.state]++;
  return counts;
}

/** A goal is reached when it has items and every one of them is done. */
export function isGoalReached(counts: ItemCounts) {
  const total = counts.open + counts.testing + counts.decided + counts.done;
  return total > 0 && counts.done === total;
}

/** "Launch Afforrd: 3 open, 1 testing, 5 decided, 2 done." */
export function headline(title: string, counts: ItemCounts) {
  return `${title}: ${ITEM_STATES.map((s) => `${counts[s]} ${s}`).join(", ")}.`;
}

/** Only what hasTest reads, so client-side items fit too. */
type TestFields = { measure?: string; passMark?: string; reviewDate?: string; latestResult?: unknown };

export function hasTest(item: TestFields) {
  return !!(item.measure || item.passMark || item.reviewDate || item.latestResult);
}

/**
 * The state an undecided item settles in: testing while it has a test, open otherwise.
 * Decided and done items keep their state; only decide, reopen and done move them.
 */
export function undecidedState(item: TestFields): Extract<ItemState, "open" | "testing"> {
  return hasTest(item) ? "testing" : "open";
}
