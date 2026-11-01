import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getCurrentUser, requireAuth, requireEditor } from "./lib/auth";
import { answerCheckInForUser, listPendingCheckIns, mondayOf, startCheckInForCanvas } from "./lib/checkIns";
import { todayUtc, verdictValidator } from "./lib/testFields";
import { loopIsOn, requireLivePlan } from "./lib/plans";

/** Weekly cron: fans out one job per canvas so no single transaction reads every note. */
export const startWeek = internalMutation({
  args: {},
  handler: async (ctx) => {
    const weekOf = mondayOf(todayUtc());
    const canvases = await ctx.db.query("canvases").collect();
    for (const canvas of canvases) {
      // Check-ins are part of a live plan; free and paused canvases get none
      if (canvas.status === "archived" || !loopIsOn(canvas)) continue;
      await ctx.scheduler.runAfter(0, internal.checkIns.startForCanvas, { canvasId: canvas._id, weekOf });
    }
    return null;
  },
});

export const startForCanvas = internalMutation({
  args: { canvasId: v.id("canvases"), weekOf: v.string() },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || !loopIsOn(canvas)) return null;
    await startCheckInForCanvas(ctx, canvas, args.weekOf);
    return null;
  },
});

/** Sends this week's check-in for one canvas now instead of waiting for Monday (editors only). */
export const sendNow = mutation({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.canvasId);
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    await requireLivePlan(ctx, canvas);
    return await startCheckInForCanvas(ctx, canvas, mondayOf(todayUtc()));
  },
});

/** The signed-in user's unanswered check-in questions, across canvases. */
export const myPending = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await listPendingCheckIns(ctx, user._id);
  },
});

/** Answers a check-in question. Drivers can answer whatever their role, view-only included. */
export const answer = mutation({
  args: {
    noteId: v.id("notes"),
    hasEvidence: v.boolean(),
    text: v.optional(v.string()),
    verdict: v.optional(verdictValidator),
    // The answerer's local date, so "today" matches their calendar
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const { noteId, ...answer } = args;
    await answerCheckInForUser(ctx, { userId: user._id, via: "ui" }, noteId, answer);
  },
});
