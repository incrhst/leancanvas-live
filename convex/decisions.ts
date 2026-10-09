import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, requireAuth, requireEditor } from "./lib/auth";
import {
  answerDecisionForUser,
  decisionAnswerValidator,
  listOpenDecisionsFor,
  requestDecisionForUser,
  withdrawDecisionForUser,
} from "./lib/decisions";

/** Asks a canvas member to decide on a note (editors only). */
export const requestDecision = mutation({
  args: {
    noteId: v.id("notes"),
    question: v.string(),
    deciderId: v.id("users"),
    dueDate: v.string(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const { user } = await requireEditor(ctx, note.canvasId);
    await requestDecisionForUser(ctx, { userId: user._id, via: "ui" }, note, args);
  },
});

/** Answers a decision request. Only the named decider can, whatever their role (view-only included). */
export const answerDecision = mutation({
  args: {
    noteId: v.id("notes"),
    answer: decisionAnswerValidator,
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const user = await requireAuth(ctx);
    await answerDecisionForUser(ctx, { userId: user._id, via: "ui" }, note, args);
  },
});

/** Cancels an open decision request (editors only). */
export const withdrawDecision = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const { user } = await requireEditor(ctx, note.canvasId);
    await withdrawDecisionForUser(ctx, { userId: user._id, via: "ui" }, note);
  },
});

/** The signed-in user's open decisions across all canvases, soonest due first. */
export const myOpenDecisions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await listOpenDecisionsFor(ctx, user._id);
  },
});
