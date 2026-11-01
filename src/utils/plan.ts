import { PLAN_REQUIRED } from "../../convex/lib/billing";

/** Window event the canvas page listens for to open the plan dialog; detail is the reason. */
export const PLAN_REQUIRED_EVENT = "leanon:plan-required";

/**
 * The reason in a PLAN_REQUIRED error ("The free trial of this plan has ended."), or null if
 * the message isn't one. The rest of the message (price, link) is for agents.
 */
export function planRequiredReason(message: string | undefined) {
  const match = message?.match(new RegExp(`${PLAN_REQUIRED}: (.*?) Keep "`));
  return match ? match[1] : null;
}

/** Opens the plan dialog for a PLAN_REQUIRED error. Returns the reason, or null if it wasn't one. */
export function announcePlanRequired(message: string | undefined) {
  const reason = planRequiredReason(message);
  if (reason && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PLAN_REQUIRED_EVENT, { detail: reason }));
  }
  return reason;
}

/** Whole days left until `ms`, rounded up, never below 0. */
export function daysLeft(ms: number, now = Date.now()) {
  return Math.max(0, Math.ceil((ms - now) / (24 * 60 * 60 * 1000)));
}
