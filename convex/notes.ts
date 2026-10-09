import { mutation, query, MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireEditor, getCanvasRole, getCurrentUser } from "./lib/auth";
import { assertBlockForTemplate, blockValidator, templateOf } from "./lib/canvasTemplates";
import {
  Actor,
  annotateLatestChange,
  diffFields,
  listNoteHistory,
  recordNoteHistory,
  trackedFields,
} from "./lib/history";
import { TestFieldsUpdate, testFieldsPatch, testFieldsUpdateArgs } from "./lib/testFields";

type EvidenceState = Doc<"notes">["evidenceState"];
type Block = Doc<"notes">["block"];

function uiActor(userId: Id<"users">): Actor {
  return { userId, via: "ui" };
}

/** A note's owner must be able to see the canvas. null clears the owner. */
async function checkOwner(ctx: MutationCtx, canvasId: Id<"canvases">, ownerId: Id<"users"> | null | undefined) {
  if (!ownerId) return undefined;
  if (!(await getCanvasRole(ctx, canvasId, ownerId))) {
    throw new ConvexError("A note's owner must be a member of its canvas");
  }
  return ownerId;
}

async function nextOrderInBlock(ctx: MutationCtx, canvasId: Id<"canvases">, block: Block) {
  const existing = await ctx.db
    .query("notes")
    .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvasId).eq("block", block))
    .collect();
  return existing.reduce((max, n) => Math.max(max, n.order), -1) + 1;
}

/**
 * Shared implementation for adding a note (caller must have verified editor access).
 */
export async function addNoteForUser(
  ctx: MutationCtx,
  actor: Actor,
  args: {
    canvasId: Id<"canvases">;
    block: Block;
    content: string;
    evidenceState?: EvidenceState;
    ownerId?: Id<"users"> | null;
    reason?: string;
  } & TestFieldsUpdate
): Promise<Id<"notes">> {
  const canvas = await ctx.db.get(args.canvasId);
  if (!canvas) throw new Error("Canvas not found");
  assertBlockForTemplate(templateOf(canvas), args.block);

  const userId = actor.userId;
  const now = Date.now();
  const fields = {
    block: args.block,
    content: args.content,
    evidenceState: args.evidenceState || "assumption",
    ...testFieldsPatch(args),
    ownerId: await checkOwner(ctx, args.canvasId, args.ownerId),
  };

  const noteId = await ctx.db.insert("notes", {
    canvasId: args.canvasId,
    ...fields,
    order: await nextOrderInBlock(ctx, args.canvasId, args.block),
    createdBy: userId,
    updatedAt: now,
  });

  await recordNoteHistory(
    ctx,
    actor,
    { _id: noteId, canvasId: args.canvasId },
    "created",
    diffFields({}, trackedFields(fields)),
    { reason: args.reason }
  );

  // Touch canvas
  await ctx.db.patch(args.canvasId, { updatedAt: now });

  // Record activity
  await ctx.db.insert("activity", {
    canvasId: args.canvasId,
    userId,
    type: "note_added",
    message: `added a note to ${args.block}`,
    createdAt: now,
  });

  return noteId;
}

/**
 * Shared implementation for updating a note (caller must have verified editor access).
 */
export async function updateNoteForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  args: {
    content?: string;
    block?: Block;
    evidenceState?: EvidenceState;
    ownerId?: Id<"users"> | null;
    reason?: string;
    link?: string;
  } & TestFieldsUpdate
) {
  const now = Date.now();

  const patch: Partial<Doc<"notes">> = { updatedAt: now, ...testFieldsPatch(args) };
  if (args.content !== undefined) patch.content = args.content;
  if (args.evidenceState !== undefined) patch.evidenceState = args.evidenceState;
  if (args.ownerId !== undefined) patch.ownerId = await checkOwner(ctx, note.canvasId, args.ownerId);
  if (args.block !== undefined && args.block !== note.block) {
    const canvas = await ctx.db.get(note.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    assertBlockForTemplate(templateOf(canvas), args.block);
    patch.block = args.block;
    patch.order = await nextOrderInBlock(ctx, note.canvasId, args.block);
  }

  const changes = diffFields(trackedFields(note), trackedFields({ ...note, ...patch }));
  if (changes.length === 0) return;

  await ctx.db.patch(note._id, patch);
  await ctx.db.patch(note.canvasId, { updatedAt: now });
  await recordNoteHistory(ctx, actor, note, "updated", changes, { reason: args.reason, link: args.link });

  if (patch.evidenceState && patch.evidenceState !== note.evidenceState) {
    await ctx.db.insert("activity", {
      canvasId: note.canvasId,
      userId: actor.userId,
      type: "evidence_updated",
      message: `marked note as ${patch.evidenceState}`,
      createdAt: now,
    });
  }
}

/**
 * Shared implementation for deleting a note (caller must have verified editor access).
 * The note is removed for good; its history keeps the last text, block and state.
 */
export async function deleteNoteForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  opts: { reason?: string; link?: string } = {}
) {
  const now = Date.now();

  // Delete evidence links attached to this note
  const evidenceItems = await ctx.db
    .query("evidence")
    .withIndex("by_note", (q) => q.eq("noteId", note._id))
    .collect();

  for (const item of evidenceItems) {
    await ctx.db.delete(item._id);
  }

  await ctx.db.delete(note._id);
  await ctx.db.patch(note.canvasId, { updatedAt: now });
  await recordNoteHistory(ctx, actor, note, "deleted", diffFields(trackedFields(note), {}), opts);

  await ctx.db.insert("activity", {
    canvasId: note.canvasId,
    userId: actor.userId,
    type: "note_deleted",
    message: `removed a note from ${note.block}`,
    createdAt: now,
  });
}

export const addNote = mutation({
  args: {
    canvasId: v.id("canvases"),
    block: blockValidator,
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
    ownerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.canvasId);
    return await addNoteForUser(ctx, uiActor(user._id), args);
  },
});

export const updateNote = mutation({
  args: {
    noteId: v.id("notes"),
    content: v.optional(v.string()),
    // null clears the owner
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    ...testFieldsUpdateArgs,
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
    await updateNoteForUser(ctx, uiActor(user._id), note, args);

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
    await deleteNoteForUser(ctx, uiActor(user._id), note);
  },
});

export const reorderNotes = mutation({
  args: {
    canvasId: v.id("canvases"),
    block: blockValidator,
    orderedNoteIds: v.array(v.id("notes")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.canvasId);
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    assertBlockForTemplate(templateOf(canvas), args.block);
    const now = Date.now();

    for (let index = 0; index < args.orderedNoteIds.length; index++) {
      const noteId = args.orderedNoteIds[index];
      const note = await ctx.db.get(noteId);
      if (!note || note.canvasId !== args.canvasId) throw new Error("Note does not belong to this canvas");
      await ctx.db.patch(noteId, {
        order: index,
        block: args.block,
        updatedAt: now,
      });
      // Reordering within a block isn't history; moving to another block is
      if (note.block !== args.block) {
        await recordNoteHistory(ctx, uiActor(user._id), note, "updated", [
          { field: "block", from: note.block, to: args.block },
        ]);
      }
    }

    await ctx.db.patch(args.canvasId, { updatedAt: now });
  },
});

/**
 * Adds a one-line reason to the caller's latest change to a note.
 */
export const addReasonToLatestChange = mutation({
  args: {
    noteId: v.id("notes"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const { user } = await requireEditor(ctx, note.canvasId);
    await annotateLatestChange(ctx, uiActor(user._id), note._id, args.reason);
  },
});

/**
 * A note's change history, newest first. Any canvas member can read it.
 */
export const getNoteHistory = query({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) return [];
    const user = await getCurrentUser(ctx);
    if (!user || !(await getCanvasRole(ctx, note.canvasId, user._id))) return [];

    return await listNoteHistory(ctx, args.noteId);
  },
});

export const listEvidence = query({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) return [];
    const user = await getCurrentUser(ctx);
    if (!user || !(await getCanvasRole(ctx, note.canvasId, user._id))) return [];

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
