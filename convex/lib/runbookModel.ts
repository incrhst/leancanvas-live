import { v } from "convex/values";

/**
 * How runnable a part of the business is, from a guess to a written runbook anyone can follow.
 * Pure (no ctx), so the app and the MCP route can import it too.
 */
export const STAGES = ["guess", "tested", "repeatable", "codified"] as const;
export type Stage = (typeof STAGES)[number];
export const stageValidator = v.union(
  v.literal("guess"),
  v.literal("tested"),
  v.literal("repeatable"),
  v.literal("codified")
);
/** Stages a person can set by hand. Codified comes only from a live runbook. */
export const settableStageValidator = v.union(v.literal("guess"), v.literal("tested"), v.literal("repeatable"));

export const STAGE_LABELS: Record<Stage, string> = {
  guess: "Guess",
  tested: "Tested",
  repeatable: "Repeatable",
  codified: "Codified",
};

export const STAGE_MEANINGS: Record<Stage, string> = {
  guess: "a hypothesis nobody has tested yet",
  tested: "tried by hand at least once",
  repeatable: "worked more than once; the steps and rough numbers are written down",
  codified: "a live runbook anyone, or an agent, can follow",
};

export const RUNBOOK_STATUSES = ["draft", "live", "retired"] as const;
export type RunbookStatus = (typeof RUNBOOK_STATUSES)[number];
export const runbookStatusValidator = v.union(v.literal("draft"), v.literal("live"), v.literal("retired"));

export const RUN_OUTCOMES = ["yes", "no", "partly"] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];
export const runOutcomeValidator = v.union(v.literal("yes"), v.literal("no"), v.literal("partly"));
export const RUN_OUTCOME_LABELS: Record<RunOutcome, string> = { yes: "Worked", no: "Didn't work", partly: "Partly" };

export const MAX_STEPS = 40;
export const MAX_RUNBOOK_LINKS = 20;
/** Failures at the same step within this many recent runs flag the runbook. */
export const RECENT_RUNS = 5;
export const REPEAT_FAILURES = 2;

export function stageOf(note: { stage?: Stage }): Stage {
  return note.stage ?? "guess";
}

export function stageRank(stage: Stage) {
  return STAGES.indexOf(stage);
}

/** A box is only as runnable as its least runnable note. Null when it has no notes. */
export function blockStage(notes: { stage?: Stage }[]): Stage | null {
  if (notes.length === 0) return null;
  return notes.map(stageOf).reduce((low, s) => (stageRank(s) < stageRank(low) ? s : low));
}

type Run = { outcome: RunOutcome; failedStep?: number; at: number };

/** What a runbook's runs say: counts, the last run, and a step that keeps failing, if any. */
export function runStats(runs: Run[]) {
  const sorted = [...runs].sort((a, b) => b.at - a.at);
  const counts = { yes: 0, no: 0, partly: 0 };
  for (const r of sorted) counts[r.outcome]++;
  const failsAt = new Map<number, number>();
  for (const r of sorted.slice(0, RECENT_RUNS)) {
    if (r.outcome !== "yes" && r.failedStep) failsAt.set(r.failedStep, (failsAt.get(r.failedStep) ?? 0) + 1);
  }
  let keepsFailingAt: number | null = null;
  for (const [step, n] of failsAt) {
    if (n >= REPEAT_FAILURES && (keepsFailingAt === null || n > (failsAt.get(keepsFailingAt) ?? 0))) keepsFailingAt = step;
  }
  return { total: sorted.length, ...counts, lastRunAt: sorted[0]?.at ?? null, keepsFailingAt };
}

export type RunStats = ReturnType<typeof runStats>;
