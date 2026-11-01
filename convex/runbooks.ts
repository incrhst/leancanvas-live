import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getCanvasRole, getCurrentUser, requireAuth, requireEditor } from "./lib/auth";
import { runbookStatusValidator, runOutcomeValidator } from "./lib/runbookModel";
import {
  buildRunbooksView,
  createRunbook,
  createSop,
  deleteRunbook,
  deleteSop,
  logRun,
  runbookFromItem,
  runbookFromNote,
  setRunbookStatus,
  updateRunbook,
  updateSop,
} from "./lib/runbooks";
import { isValidGrant } from "./canvases";

/** The runbooks view for members (role says whether they can edit). */
export const view = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const canvas = await ctx.db.get(args.canvasId);
    if (!user || !canvas) return null;
    const role = await getCanvasRole(ctx, canvas._id, user._id);
    if (!role) return null;
    return { role, ...(await buildRunbooksView(ctx, canvas)) };
  },
});

/** Read-only, for the canvas's public link (with its password pass when it has one). */
export const viewByPublicToken = query({
  args: { token: v.string(), grant: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const canvas = await ctx.db
      .query("canvases")
      .withIndex("by_public_token", (q) => q.eq("publicViewToken", args.token))
      .first();
    if (!canvas || !canvas.isPublicViewEnabled) return null;
    if (canvas.publicViewPasswordHash && !(await isValidGrant(ctx, canvas, args.grant))) return null;
    const view = await buildRunbooksView(ctx, canvas);
    return {
      role: null,
      ...view,
      runbooks: view.runbooks.map((r) => ({ ...r, ownerId: undefined })),
      attention: view.attention.map((r) => ({ ...r, ownerId: undefined })),
    };
  },
});

const ui = (userId: Id<"users">) => ({ userId, via: "ui" as const });

async function editableRunbook(ctx: MutationCtx, runbookId: Id<"runbooks">) {
  const runbook = await ctx.db.get(runbookId);
  if (!runbook) throw new Error("Runbook not found");
  const { user } = await requireEditor(ctx, runbook.canvasId);
  return { runbook, actor: ui(user._id) };
}

async function editableSop(ctx: MutationCtx, sopId: Id<"sops">) {
  const sop = await ctx.db.get(sopId);
  if (!sop) throw new Error("SOP not found");
  await requireEditor(ctx, sop.canvasId);
  return sop;
}

export const addSop = mutation({
  args: { canvasId: v.id("canvases"), title: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.canvasId);
    return await createSop(ctx, ui(user._id), args.canvasId, args);
  },
});

export const editSop = mutation({
  args: { sopId: v.id("sops"), title: v.optional(v.string()), description: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const { sopId, ...fields } = args;
    await updateSop(ctx, await editableSop(ctx, sopId), fields);
  },
});

export const removeSop = mutation({
  args: { sopId: v.id("sops") },
  handler: async (ctx, args) => {
    await deleteSop(ctx, await editableSop(ctx, args.sopId));
  },
});

const runbookFields = {
  title: v.optional(v.string()),
  trigger: v.optional(v.union(v.string(), v.null())),
  ownerId: v.optional(v.union(v.id("users"), v.null())),
  steps: v.optional(v.array(v.string())),
  noteIds: v.optional(v.array(v.id("notes"))),
  itemIds: v.optional(v.array(v.id("items"))),
  sopId: v.optional(v.union(v.id("sops"), v.null())),
  reviewDate: v.optional(v.union(v.string(), v.null())),
};

export const addRunbook = mutation({
  args: { canvasId: v.id("canvases"), ...runbookFields, title: v.string() },
  handler: async (ctx, args) => {
    const { canvasId, ...fields } = args;
    const { user } = await requireEditor(ctx, canvasId);
    return await createRunbook(ctx, ui(user._id), canvasId, fields);
  },
});

export const editRunbook = mutation({
  args: { runbookId: v.id("runbooks"), ...runbookFields },
  handler: async (ctx, args) => {
    const { runbookId, ...fields } = args;
    const { runbook, actor } = await editableRunbook(ctx, runbookId);
    await updateRunbook(ctx, actor, runbook, fields);
  },
});

export const setStatus = mutation({
  args: { runbookId: v.id("runbooks"), status: runbookStatusValidator },
  handler: async (ctx, args) => {
    const { runbook, actor } = await editableRunbook(ctx, args.runbookId);
    await setRunbookStatus(ctx, actor, runbook, args.status);
  },
});

export const removeRunbook = mutation({
  args: { runbookId: v.id("runbooks") },
  handler: async (ctx, args) => {
    const { runbook, actor } = await editableRunbook(ctx, args.runbookId);
    await deleteRunbook(ctx, actor, runbook);
  },
});

export const fromNote = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const { user } = await requireEditor(ctx, note.canvasId);
    return await runbookFromNote(ctx, ui(user._id), note);
  },
});

export const fromItem = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    const { user } = await requireEditor(ctx, item.canvasId);
    return await runbookFromItem(ctx, ui(user._id), item);
  },
});

/** Any member can log a run, viewers included: the people running a play are often not editors. */
export const logRunbookRun = mutation({
  args: {
    runbookId: v.id("runbooks"),
    outcome: runOutcomeValidator,
    failedStep: v.optional(v.number()),
    numbers: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const runbook = await ctx.db.get(args.runbookId);
    if (!runbook) throw new Error("Runbook not found");
    const user = await requireAuth(ctx);
    if (!(await getCanvasRole(ctx, runbook.canvasId, user._id))) throw new Error("Forbidden");
    const { runbookId: _r, ...run } = args;
    return await logRun(ctx, ui(user._id), runbook, run);
  },
});
