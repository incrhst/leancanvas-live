import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, requireAuth, requireEditor } from "./lib/auth";
import {
  answerDecisionByLink,
  answerDecisionForUser,
  decisionAnswerValidator,
  getDecisionByLink,
  listOpenDecisionsFor,
  replaceDecisionLinkForUser,
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
    // What happens if nobody decides by dueDate
    defaultOutcome: v.optional(v.string()),
    // 2 to 4 choices instead of approve / reject
    options: v.optional(v.array(v.string())),
    // Which of the options put the decision off: choosing one leaves the note's evidence state alone
    deferOptions: v.optional(v.array(v.string())),
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
    // The option picked, when answer is "choose"
    choice: v.optional(v.string()),
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

/**
 * Emails the decider a new answer link, so any earlier one stops working; with `off`, just turns
 * the link off (editors only).
 */
export const replaceDecisionLink = mutation({
  args: { noteId: v.id("notes"), off: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const { user } = await requireEditor(ctx, note.canvasId);
    await replaceDecisionLinkForUser(ctx, { userId: user._id, via: "ui" }, note, { off: args.off });
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

/** Public: the one decision behind an answer link (/d/[token]), or null if the link doesn't work. */
export const getByLink = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await getDecisionByLink(ctx, args.token);
  },
});

/** Public: answers the decision behind an answer link, without signing in. */
export const answerByLink = mutation({
  args: {
    token: v.string(),
    answer: decisionAnswerValidator,
    choice: v.optional(v.string()),
    comment: v.optional(v.string()),
    // Who is answering, as they typed it
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { token, ...answer } = args;
    await answerDecisionByLink(ctx, token, answer);
  },
});
