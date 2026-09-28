import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./lib/auth";

export const heartbeat = mutation({
  args: {
    canvasId: v.id("canvases"),
    currentBlock: v.optional(v.string()),
    cursorX: v.optional(v.number()),
    cursorY: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return; // Anonymous viewers do not broadcast presence cursors

    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_canvas_user", (q) =>
        q.eq("canvasId", args.canvasId).eq("userId", user._id)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        currentBlock: args.currentBlock,
        cursorX: args.cursorX,
        cursorY: args.cursorY,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("presence", {
        canvasId: args.canvasId,
        userId: user._id,
        userName: user.name || "Collaborator",
        userEmail: user.email,
        userAvatar: user.imageUrl,
        currentBlock: args.currentBlock,
        cursorX: args.cursorX,
        cursorY: args.cursorY,
        updatedAt: now,
      });
    }

    // Clean up stale presence older than 30s
    const stale = await ctx.db
      .query("presence")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .filter((q) => q.lt(q.field("updatedAt"), now - 30000))
      .take(10);

    for (const s of stale) {
      if (s.userId !== user._id) {
        await ctx.db.delete(s._id);
      }
    }
  },
});

export const getPresence = query({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    const threshold = Date.now() - 25000;
    const active = await ctx.db
      .query("presence")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .filter((q) => q.gte(q.field("updatedAt"), threshold))
      .collect();

    return active;
  },
});
