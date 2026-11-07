import { Infer, v } from "convex/values";

/**
 * The paywall, by value: drawing a canvas is free; running it as a live plan (tests, check-ins,
 * decisions, snapshots, the review) is paid, per live plan. A creator's first live plan runs
 * free for a trial; founding members can have plans that run free with no end date.
 * Answering a decision or a check-in is never paywalled.
 */

export const TRIAL_DAYS = 30;
export const TRIALS_ALLOWED = 1;
// The price of one live plan for a month, before an account's discount
export const PLAN_PRICE_USD = 29;

export const DAY_MS = 24 * 60 * 60 * 1000;
// What one payment buys
export const PAID_PERIOD_DAYS = 30;

/** The monthly price after an account's discount, in whole dollars. */
export function planPriceUsd(discountPercent: number) {
  return Math.round(PLAN_PRICE_USD * (1 - discountPercent / 100));
}

export const planStatusValidator = v.union(v.literal("trial"), v.literal("active"), v.literal("paused"));

export const planGrantValidator = v.union(
  // One of a founding member's free plans
  v.literal("founding"),
  // Turned on by an admin, e.g. a comped or extended plan
  v.literal("admin")
);

export const canvasPlanValidator = v.object({
  status: planStatusValidator,
  liveSince: v.number(),
  trialEndsAt: v.optional(v.number()),
  // End of the paid or granted period; unset on an active plan means no end date
  paidUntil: v.optional(v.number()),
  // Why an active plan runs without payment
  grant: v.optional(planGrantValidator),
  // The payment provider's reference for the latest payment
  paymentRef: v.optional(v.string()),
  // Admin's note on any override
  note: v.optional(v.string()),
});

export type CanvasPlan = Infer<typeof canvasPlanValidator>;
export type PlanStatus = Infer<typeof planStatusValidator>;

/** Whether a plan is running at `now`: in its trial, or active and not past its end date. */
export function planIsRunning(plan: CanvasPlan | undefined, now: number) {
  if (!plan) return false;
  if (plan.status === "trial") return !!plan.trialEndsAt && plan.trialEndsAt > now;
  if (plan.status === "active") return !plan.paidUntil || plan.paidUntil > now;
  return false;
}

/** When a running plan next needs checking: the end of its trial or paid period. */
export function planEndsAt(plan: CanvasPlan) {
  if (plan.status === "trial") return plan.trialEndsAt;
  if (plan.status === "active") return plan.paidUntil;
  return undefined;
}

// Errors that start with this mean "the plan needs paying for"; the app shows the plan page
export const PLAN_REQUIRED = "PLAN_REQUIRED";

export function isPlanRequiredError(message: string | undefined) {
  return !!message && message.includes(PLAN_REQUIRED);
}
