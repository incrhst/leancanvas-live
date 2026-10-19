import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireEditor } from "./lib/auth";
import {
  acceptSubmissionForUser,
  getResultLink,
  rejectSubmissionForUser,
  replaceResultLinkForUser,
  resultLinkForNote,
  submissionCanvas,
  submitResultByLink,
} from "./lib/resultLinks";
import { verdictValidator } from "./lib/testFields";

/** A note's shareable result link and the results waiting on it (editors only). */
export const forNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) return null;
    await requireEditor(ctx, note.canvasId);
    return await resultLinkForNote(ctx, note._id);
  },
});

/**
 * Makes a new result link for a note and returns its token; any earlier link stops working.
 * With `off`, just turns the link off (editors only).
 */
export const replaceLink = mutation({
  args: { noteId: v.id("notes"), off: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const { user } = await requireEditor(ctx, note.canvasId);
    return await replaceResultLinkForUser(ctx, { userId: user._id, via: "ui" }, note, { off: args.off });
  },
});

/** Makes a result sent from a link the note's latest result. Leaves the evidence state alone (editors only). */
export const accept = mutation({
  args: {
    submissionId: v.id("resultSubmissions"),
    // Overrides the sender's verdict; null clears it
    verdict: v.optional(v.union(verdictValidator, v.null())),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, await submissionCanvas(ctx, args.submissionId));
    await acceptSubmissionForUser(ctx, { userId: user._id, via: "ui" }, args.submissionId, { verdict: args.verdict });
  },
});

/** Drops a result sent from a link; the note doesn't change (editors only). */
export const reject = mutation({
  args: { submissionId: v.id("resultSubmissions"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, await submissionCanvas(ctx, args.submissionId));
    await rejectSubmissionForUser(ctx, { userId: user._id, via: "ui" }, args.submissionId, { reason: args.reason });
  },
});

/** Public: what the result page (/r/[token]) shows, or null if the link doesn't work. */
export const getByLink = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await getResultLink(ctx, args.token);
  },
});

/** Public: sends a result from a link, without signing in. It waits for an editor to accept it. */
export const submitByLink = mutation({
  args: {
    token: v.string(),
    text: v.optional(v.string()),
    verdict: v.optional(verdictValidator),
    // Who is sending it, as they typed it
    name: v.optional(v.string()),
    // The sender's local date, YYYY-MM-DD
    date: v.optional(v.string()),
    // Check-in links only: nothing new this week
    nothingNew: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { token, ...result } = args;
    return await submitResultByLink(ctx, token, result);
  },
});
