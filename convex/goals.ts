import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getCanvasRole, getCurrentUser, requireEditor } from "./lib/auth";
import { testFieldsUpdateArgs } from "./lib/testFields";
import { decisionBasisValidator, lookBackValidator } from "./lib/goalModel";
import {
  buildGoalsView,
  convertNoteToItem,
  createGoal,
  createItem,
  decideItem,
  deleteGoal,
  deleteItem,
  markItemDone,
  recordLookBack,
  renameGoal,
  reopenItem,
  updateItem,
} from "./lib/goals";
import { isValidGrant } from "./canvases";

/**
 * The goals view of a canvas, for the app. Members see it signed in; anyone with the canvas's
 * public link sees it read-only (with the link's password pass when it has one).
 */
export const view = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const canvas = await ctx.db.get(args.canvasId);
    if (!user || !canvas) return null;
    const role = await getCanvasRole(ctx, canvas._id, user._id);
    if (!role) return null;
    return { role, viewerId: user._id, ...(await buildGoalsView(ctx, canvas)) };
  },
});

export const viewByPublicToken = query({
  args: { token: v.string(), grant: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const canvas = await ctx.db
      .query("canvases")
      .withIndex("by_public_token", (q) => q.eq("publicViewToken", args.token))
      .first();
    if (!canvas || !canvas.isPublicViewEnabled) return null;
    if (canvas.publicViewPasswordHash && !(await isValidGrant(ctx, canvas, args.grant))) return null;
    const view = await buildGoalsView(ctx, canvas);
    // Guests see what was decided and on what basis, not who in the team drives what
    return {
      role: null,
      viewerId: null,
      ...view,
      goals: view.goals.map((g) => ({
        ...g,
        items: g.items.map((i) => ({ ...i, ownerId: undefined })),
      })),
    };
  },
});

async function editableGoal(ctx: MutationCtx, goalId: Id<"goals">) {
  const goal = await ctx.db.get(goalId);
  if (!goal) throw new Error("Goal not found");
  const { user } = await requireEditor(ctx, goal.canvasId);
  return { goal, actor: { userId: user._id, via: "ui" as const } };
}

async function editableItem(ctx: MutationCtx, itemId: Id<"items">) {
  const item = await ctx.db.get(itemId);
  if (!item) throw new Error("Item not found");
  const { user } = await requireEditor(ctx, item.canvasId);
  return { item, actor: { userId: user._id, via: "ui" as const } };
}

export const addGoal = mutation({
  args: { canvasId: v.id("canvases"), title: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.canvasId);
    return await createGoal(ctx, { userId: user._id, via: "ui" }, args.canvasId, args.title);
  },
});

export const renameGoalTitle = mutation({
  args: { goalId: v.id("goals"), title: v.string() },
  handler: async (ctx, args) => {
    const { goal } = await editableGoal(ctx, args.goalId);
    await renameGoal(ctx, goal, args.title);
  },
});

export const removeGoal = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const { goal } = await editableGoal(ctx, args.goalId);
    await deleteGoal(ctx, goal);
  },
});

export const addItem = mutation({
  args: {
    goalId: v.id("goals"),
    title: v.string(),
    detail: v.optional(v.string()),
    decideBy: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { goal, actor } = await editableGoal(ctx, args.goalId);
    return await createItem(ctx, actor, goal, args);
  },
});

export const editItem = mutation({
  args: {
    itemId: v.id("items"),
    title: v.optional(v.string()),
    detail: v.optional(v.union(v.string(), v.null())),
    decideBy: v.optional(v.union(v.string(), v.null())),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    goalId: v.optional(v.id("goals")),
    contextNoteIds: v.optional(v.array(v.id("notes"))),
    ...testFieldsUpdateArgs,
  },
  handler: async (ctx, args) => {
    const { itemId, ...fields } = args;
    const { item } = await editableItem(ctx, itemId);
    await updateItem(ctx, item, fields);
  },
});

export const removeItem = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const { item } = await editableItem(ctx, args.itemId);
    await deleteItem(ctx, item);
  },
});

export const decide = mutation({
  args: {
    itemId: v.id("items"),
    text: v.string(),
    basis: decisionBasisValidator,
    basisNote: v.optional(v.string()),
    linkedNoteIds: v.optional(v.array(v.id("notes"))),
    decidedBy: v.optional(v.id("users")),
    decidedByName: v.optional(v.string()),
    reviewDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { itemId, ...decision } = args;
    const { item, actor } = await editableItem(ctx, itemId);
    return await decideItem(ctx, actor, item, decision);
  },
});

export const markDone = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const { item } = await editableItem(ctx, args.itemId);
    await markItemDone(ctx, item);
  },
});

export const reopen = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const { item } = await editableItem(ctx, args.itemId);
    await reopenItem(ctx, item);
  },
});

export const lookBack = mutation({
  args: { itemId: v.id("items"), outcome: lookBackValidator, note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { item, actor } = await editableItem(ctx, args.itemId);
    await recordLookBack(ctx, actor, item, { outcome: args.outcome, note: args.note });
  },
});

export const convertNote = mutation({
  args: { noteId: v.id("notes"), goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const { user } = await requireEditor(ctx, note.canvasId);
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");
    return await convertNoteToItem(ctx, { userId: user._id, via: "ui" }, note, goal);
  },
});
