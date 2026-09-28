import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireEditor, getCanvasRole, getCurrentUser } from "./lib/auth";

export const addNote = mutation({
  args: {
    canvasId: v.id("canvases"),
    block: v.union(
      v.literal("problem"),
      v.literal("customerSegments"),
      v.literal("uniqueValueProposition"),
      v.literal("solution"),
      v.literal("channels"),
      v.literal("revenueStreams"),
      v.literal("costStructure"),
      v.literal("keyMetrics"),
      v.literal("unfairAdvantage")
    ),
    content: v.string(),
    evidenceState: v.optional(
      v.union(
        v.literal("unknown"),
        v.literal("assumption"),
        v.literal("observed"),
        v.literal("supported"),
        v.literal("contradicted"),
        v.literal("decision")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.canvasId);

    // Find highest order in this block
    const existing = await ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) =>
        q.eq("canvasId", args.canvasId).eq("block", args.block)
      )
      .collect();

    const maxOrder = existing.reduce((max, n) => Math.max(max, n.order), -1);
    const now = Date.now();

    const noteId = await ctx.db.insert("notes", {
      canvasId: args.canvasId,
      block: args.block,
      content: args.content,
      order: maxOrder + 1,
      evidenceState: args.evidenceState || "assumption",
      createdBy: user._id,
      updatedAt: now,
    });

    // Touch canvas
    await ctx.db.patch(args.canvasId, { updatedAt: now });

    // Record activity
    await ctx.db.insert("activity", {
      canvasId: args.canvasId,
      userId: user._id,
      type: "note_added",
      message: `added a note to ${args.block}`,
      createdAt: now,
    });

    return noteId;
  },
});

export const updateNote = mutation({
  args: {
    noteId: v.id("notes"),
    content: v.optional(v.string()),
    evidenceState: v.optional(
      v.union(
        v.literal("unknown"),
        v.literal("assumption"),
        v.literal("observed"),
        v.literal("supported"),
        v.literal("contradicted"),
        v.literal("decision")
      )
    ),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");

    const { user } = await requireEditor(ctx, note.canvasId);
    const now = Date.now();

    const patch: Partial<typeof note> = { updatedAt: now };
    if (args.content !== undefined) patch.content = args.content;
    if (args.evidenceState !== undefined) patch.evidenceState = args.evidenceState;

    await ctx.db.patch(args.noteId, patch);
    await ctx.db.patch(note.canvasId, { updatedAt: now });

    if (args.evidenceState) {
      await ctx.db.insert("activity", {
        canvasId: note.canvasId,
        userId: user._id,
        type: "evidence_updated",
        message: `marked note as ${args.evidenceState}`,
        createdAt: now,
      });
    }

    return note._id;
  },
});

export const deleteNote = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");

    const { user } = await requireEditor(ctx, note.canvasId);
    const now = Date.now();

    // Delete evidence links attached to this note
    const evidenceItems = await ctx.db
      .query("evidence")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    for (const item of evidenceItems) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.noteId);
    await ctx.db.patch(note.canvasId, { updatedAt: now });

    await ctx.db.insert("activity", {
      canvasId: note.canvasId,
      userId: user._id,
      type: "note_deleted",
      message: `removed a note from ${note.block}`,
      createdAt: now,
    });
  },
});

export const reorderNotes = mutation({
  args: {
    canvasId: v.id("canvases"),
    block: v.union(
      v.literal("problem"),
      v.literal("customerSegments"),
      v.literal("uniqueValueProposition"),
      v.literal("solution"),
      v.literal("channels"),
      v.literal("revenueStreams"),
      v.literal("costStructure"),
      v.literal("keyMetrics"),
      v.literal("unfairAdvantage")
    ),
    orderedNoteIds: v.array(v.id("notes")),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.canvasId);
    const now = Date.now();

    for (let index = 0; index < args.orderedNoteIds.length; index++) {
      const noteId = args.orderedNoteIds[index];
      await ctx.db.patch(noteId, {
        order: index,
        block: args.block,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.canvasId, { updatedAt: now });
  },
});

export const listEvidence = query({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("evidence")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();
  },
});

export const addEvidence = mutation({
  args: {
    noteId: v.id("notes"),
    type: v.union(v.literal("text"), v.literal("url"), v.literal("file")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");

    const { user } = await requireEditor(ctx, note.canvasId);

    const id = await ctx.db.insert("evidence", {
      noteId: args.noteId,
      type: args.type,
      content: args.content,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    return id;
  },
});
