import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCanvasRole, getCurrentUser } from "./lib/auth";
import { PLAN_PRICE_USD, planIsRunning } from "./lib/billing";
import { allowanceOf, getBillingAccount, planValue, setCanvasPlan } from "./lib/plans";

/** Scheduled for the end of a trial or paid period: pauses the plan unless it was extended or paid since. */
export const checkPlan = internalMutation({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas?.plan || canvas.plan.status === "paused") return null;
    if (planIsRunning(canvas.plan, Date.now())) return null;
    await ctx.db.patch(canvas._id, { plan: { ...canvas.plan, status: "paused" } });
    await ctx.db.insert("activity", {
      canvasId: canvas._id,
      type: "plan_paused",
      message: canvas.plan.status === "trial" ? "the plan's free trial ended" : "the plan's paid period ended",
      createdAt: Date.now(),
    });
    return null;
  },
});

/**
 * For the payment webhook (DIME PAY, once wired up): marks a canvas's plan paid through `paidUntil`.
 */
export const activatePaidPlan = internalMutation({
  args: { canvasId: v.id("canvases"), paidUntil: v.number(), paymentRef: v.string() },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    await setCanvasPlan(ctx, canvas._id, {
      status: "active",
      liveSince: canvas.plan?.liveSince ?? Date.now(),
      trialEndsAt: canvas.plan?.trialEndsAt,
      paidUntil: args.paidUntil,
      paymentRef: args.paymentRef,
    });
    return null;
  },
});

/**
 * One-off, before the paywall goes live: canvases already used as live plans (a launch date, a
 * test or a decision) keep running free, as founding plans with no end date.
 * Run with `npx convex run billing:grandfatherLivePlans`; repeat with the returned cursor until done.
 */
export const grandfatherLivePlans = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("canvases").paginate({ numItems: 50, cursor: args.cursor ?? null });
    let grandfathered = 0;
    for (const canvas of page.page) {
      if (canvas.plan) continue;
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
        .collect();
      const live =
        !!canvas.launchDate ||
        notes.some((n) => n.measure || n.passMark || n.reviewDate || n.latestResult || n.decision);
      if (!live) continue;
      await ctx.db.patch(canvas._id, {
        plan: { status: "active", liveSince: Date.now(), grant: "admin", note: "Live before the paywall" },
      });
      grandfathered++;
    }
    return { grandfathered, isDone: page.isDone, cursor: page.continueCursor };
  },
});

/** The plan behind a canvas, what it has done and what it costs. Any member can see it. */
export const forCanvas = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const canvas = await ctx.db.get(args.canvasId);
    if (!user || !canvas) return null;
    const role = await getCanvasRole(ctx, canvas._id, user._id);
    if (!role) return null;
    const allowance = allowanceOf(await getBillingAccount(ctx, canvas.createdBy));
    return {
      canvasId: canvas._id,
      title: canvas.title,
      role,
      plan: canvas.plan ?? null,
      value: await planValue(ctx, canvas),
      priceUsd: PLAN_PRICE_USD,
      discountPercent: allowance.discountPercent,
      // Whether making this canvas live would start a free trial (only shown to its creator)
      trialAvailable: canvas.createdBy === user._id && allowance.trialsUsed < allowance.trialsAllowed,
      trialDays: allowance.trialDays,
      isCreator: canvas.createdBy === user._id,
    };
  },
});
