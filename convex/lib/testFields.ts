import { ConvexError, Infer, v } from "convex/values";
import { Doc } from "../_generated/dataModel";

/**
 * Optional fields that make a note testable: what we watch, what counts as success, when we
 * look, and what we last saw. Dates are calendar dates ("YYYY-MM-DD"), not timestamps, so they
 * read the same in every timezone.
 */
export const verdictValidator = v.union(v.literal("pass"), v.literal("fail"), v.literal("inconclusive"));

export const latestResultValidator = v.object({
  text: v.string(),
  date: v.string(),
  verdict: v.optional(verdictValidator),
});

export const testFieldsSchema = {
  measure: v.optional(v.string()),
  passMark: v.optional(v.string()),
  reviewDate: v.optional(v.string()),
  latestResult: v.optional(latestResultValidator),
};

/** Update args: a value sets the field, null clears it, leaving it out keeps it. */
export const testFieldsUpdateArgs = {
  measure: v.optional(v.union(v.string(), v.null())),
  passMark: v.optional(v.union(v.string(), v.null())),
  reviewDate: v.optional(v.union(v.string(), v.null())),
  latestResult: v.optional(
    v.union(
      v.object({
        text: v.string(),
        date: v.optional(v.string()),
        verdict: v.optional(verdictValidator),
      }),
      v.null()
    )
  ),
};

export type TestFieldsUpdate = {
  measure?: string | null;
  passMark?: string | null;
  reviewDate?: string | null;
  latestResult?: { text: string; date?: string; verdict?: Infer<typeof verdictValidator> } | null;
};

type TestFieldsPatch = Partial<Pick<Doc<"notes">, "measure" | "passMark" | "reviewDate" | "latestResult">>;

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMs(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

/** The calendar date `days` after `date` (both "YYYY-MM-DD"). */
export function addDays(date: string, days: number) {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; the launch date itself is day 0. */
export function daysBetween(from: string, to: string) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function checkDate(value: string, label: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(`${value}T00:00:00Z`) : null;
  if (!date || isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ConvexError(`${label} must be a date like 2026-11-08, got "${value}"`);
  }
  return value;
}

/**
 * Turns update args into a note patch. Blank text clears a field, like null does.
 * Keys present in the result with `undefined` remove that field on patch.
 */
export function testFieldsPatch(args: TestFieldsUpdate): TestFieldsPatch {
  const patch: TestFieldsPatch = {};
  for (const key of ["measure", "passMark"] as const) {
    if (args[key] !== undefined) patch[key] = args[key]?.trim() || undefined;
  }
  if (args.reviewDate !== undefined) {
    const date = args.reviewDate?.trim();
    patch.reviewDate = date ? checkDate(date, "reviewDate") : undefined;
  }
  if (args.latestResult !== undefined) {
    const text = args.latestResult?.text.trim();
    patch.latestResult =
      args.latestResult && text
        ? {
            text,
            date: args.latestResult.date?.trim()
              ? checkDate(args.latestResult.date.trim(), "latestResult.date")
              : todayUtc(),
            verdict: args.latestResult.verdict,
          }
        : undefined;
  }
  return patch;
}
