import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCanvasRole, getCurrentUser } from "./lib/auth";
import { buildReview } from "./lib/review";
import { loopIsOn } from "./lib/plans";

/**
 * The review-meeting view of a canvas. Any member can see it; it changes nothing.
 * It's part of a live plan, so a free or paused canvas gets `locked` instead.
 */
export const get = query({
  args: { canvasId: v.id("canvases"), sinceSnapshotId: v.optional(v.id("canvasSnapshots")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const canvas = await ctx.db.get(args.canvasId);
    if (!user || !canvas || !(await getCanvasRole(ctx, canvas._id, user._id))) return null;
    if (!loopIsOn(canvas)) return { locked: true as const, canvasId: canvas._id, title: canvas.title };
    return await buildReview(ctx, canvas, args.sinceSnapshotId);
  },
});
