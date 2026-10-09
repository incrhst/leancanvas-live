import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCanvasRole, getCurrentUser, requireEditor, requireOwner } from "./lib/auth";
import { compareSnapshots, createSnapshotForUser, deleteSnapshotRows, listSnapshots } from "./lib/snapshots";

const sideValidator = v.union(v.id("canvasSnapshots"), v.literal("current"));

/** Freezes the canvas under a label, e.g. "Day 30" (editors only). */
export const createSnapshot = mutation({
  args: { canvasId: v.id("canvases"), label: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.canvasId);
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    return await createSnapshotForUser(ctx, user._id, canvas, args.label);
  },
});

/** Removes a snapshot for good (owner only), e.g. one taken by mistake. */
export const deleteSnapshot = mutation({
  args: { snapshotId: v.id("canvasSnapshots") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) throw new Error("Snapshot not found");
    await requireOwner(ctx, snapshot.canvasId);
    await deleteSnapshotRows(ctx, snapshot._id);
  },
});

export const list = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const canvas = await ctx.db.get(args.canvasId);
    if (!user || !canvas || !(await getCanvasRole(ctx, canvas._id, user._id))) return [];
    return await listSnapshots(ctx, canvas);
  },
});

/** Added, removed and changed notes between two snapshots, or a snapshot and now. Any member can compare. */
export const compare = query({
  args: { canvasId: v.id("canvases"), from: sideValidator, to: sideValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const canvas = await ctx.db.get(args.canvasId);
    if (!user || !canvas || !(await getCanvasRole(ctx, canvas._id, user._id))) return null;
    return await compareSnapshots(ctx, canvas, args.from, args.to);
  },
});
