import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { siteUrl } from "./notify";
import {
  CanvasPlan,
  DAY_MS,
  PLAN_PRICE_USD,
  PLAN_REQUIRED,
  TRIAL_DAYS,
  TRIALS_ALLOWED,
  planEndsAt,
  planIsRunning,
} from "./billing";

/** How many plans a founding member's free ones are counted from; a creator rarely has more canvases. */
const CANVAS_SCAN_LIMIT = 500;

export async function getBillingAccount(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("billingAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function ensureBillingAccount(ctx: MutationCtx, userId: Id<"users">) {
  const account = await getBillingAccount(ctx, userId);
  if (account) return account;
  const id = await ctx.db.insert("billingAccounts", { userId, trialsUsed: 0, updatedAt: Date.now() });
  return (await ctx.db.get(id))!;
}

/** What a creator is allowed, with the defaults filled in. */
export function allowanceOf(account: Doc<"billingAccounts"> | null) {
  return {
    founding: account?.founding ?? false,
    trialDays: account?.trialDays ?? TRIAL_DAYS,
    trialsAllowed: account?.trialsAllowed ?? TRIALS_ALLOWED,
    trialsUsed: account?.trialsUsed ?? 0,
    freeLivePlans: account?.freeLivePlans ?? 0,
    discountPercent: account?.discountPercent ?? 0,
  };
}

/** A creator's canvases whose plan is one of their founding free plans. */
export async function foundingPlansInUse(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const canvases = await ctx.db
    .query("canvases")
    .withIndex("by_creator", (q) => q.eq("createdBy", userId))
    .take(CANVAS_SCAN_LIMIT);
  return canvases.filter((c) => c.plan?.grant === "founding" && c.plan.status === "active").length;
}

/** Sets a canvas's plan and schedules the check that pauses it when its trial or paid period ends. */
export async function setCanvasPlan(ctx: MutationCtx, canvasId: Id<"canvases">, plan: CanvasPlan | undefined) {
  await ctx.db.patch(canvasId, { plan });
  const endsAt = plan && planEndsAt(plan);
  if (endsAt) await ctx.scheduler.runAt(endsAt, internal.billing.checkPlan, { canvasId });
}

/** The error text for something that needs a live plan; agents relay it, the app opens the plan page. */
export function planRequiredMessage(canvas: Doc<"canvases">, why: string) {
  return `${PLAN_REQUIRED}: ${why} Keep "${canvas.title}" running as a live plan ($${PLAN_PRICE_USD} a month): ${siteUrl()}/canvas/${canvas._id}/plan`;
}

function planRequired(canvas: Doc<"canvases">, why: string): never {
  throw new ConvexError(planRequiredMessage(canvas, why));
}

/**
 * Call before anything that runs a canvas as a live plan: setting a launch date or a test,
 * recording a result, asking for a decision, taking a snapshot or sending a check-in.
 * A free canvas becomes a live plan here: one of the creator's founding free plans, else their
 * trial, else it needs paying for. A paused or ended plan needs paying for.
 */
export async function requireLivePlan(ctx: MutationCtx, canvas: Doc<"canvases">) {
  const now = Date.now();
  if (canvas.plan) {
    if (planIsRunning(canvas.plan, now)) return canvas.plan;
    planRequired(
      canvas,
      canvas.plan.status === "trial" || canvas.plan.trialEndsAt ? "The free trial of this plan has ended." : "This plan is paused."
    );
  }

  // The canvas's creator is who the plan belongs to, whoever is making the change
  const account = await getBillingAccount(ctx, canvas.createdBy);
  const allowance = allowanceOf(account);

  let plan: CanvasPlan | undefined;
  if (allowance.freeLivePlans > (await foundingPlansInUse(ctx, canvas.createdBy))) {
    plan = { status: "active", liveSince: now, grant: "founding" };
  } else if (allowance.trialsUsed < allowance.trialsAllowed) {
    plan = { status: "trial", liveSince: now, trialEndsAt: now + allowance.trialDays * DAY_MS };
    const row = account ?? (await ensureBillingAccount(ctx, canvas.createdBy));
    await ctx.db.patch(row._id, { trialsUsed: row.trialsUsed + 1, updatedAt: now });
  } else {
    planRequired(canvas, "Tests, check-ins, decisions and snapshots are part of a live plan.");
  }

  await setCanvasPlan(ctx, canvas._id, plan);
  await ctx.db.insert("activity", {
    canvasId: canvas._id,
    type: "plan_started",
    message:
      plan.status === "trial"
        ? `started a live plan with a ${allowance.trialDays}-day free trial`
        : "started a live plan (founding member)",
    createdAt: now,
  });
  return plan;
}

/** Whether the loop is running on this canvas, from the stored status (safe in queries). */
export function loopIsOn(canvas: Doc<"canvases">) {
  return canvas.plan?.status === "trial" || canvas.plan?.status === "active";
}

/**
 * What a live plan has done so far, for the plan page: tests set, results in, notes now backed
 * or contradicted by evidence, and decisions made.
 */
export async function planValue(ctx: QueryCtx, canvas: Doc<"canvases">) {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
    .collect();
  const snapshots = await ctx.db
    .query("canvasSnapshots")
    .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
    .take(100);
  const checkIns = await ctx.db
    .query("checkInItems")
    .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
    .take(1000);
  return {
    tests: notes.filter((n) => n.measure || n.passMark || n.reviewDate || n.latestResult).length,
    results: notes.filter((n) => n.latestResult).length,
    supported: notes.filter((n) => n.evidenceState === "supported").length,
    contradicted: notes.filter((n) => n.evidenceState === "contradicted").length,
    decisionsMade: notes.filter((n) => n.decision && n.decision.status !== "open").length,
    decisionsOpen: notes.filter((n) => n.decision?.status === "open").length,
    checkInsAnswered: checkIns.filter((c) => c.status === "answered").length,
    snapshots: snapshots.length,
  };
}
