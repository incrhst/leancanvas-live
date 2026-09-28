/**
 * Functions backing the MCP server (src/app/api/mcp/route.ts).
 * Each call is authenticated by the OAuth bearer access token issued in convex/oauth.ts.
 */
import { action, internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getCanvasRole, getUserFromAccessToken, requireTokenUser } from "./lib/auth";
import { createCanvasForUser, listCanvasesForUser } from "./canvases";
import { addNoteForUser, updateNoteForUser } from "./notes";
import { runStressTestForUser } from "./stressTests";

const blockValidator = v.union(
  v.literal("problem"),
  v.literal("customerSegments"),
  v.literal("uniqueValueProposition"),
  v.literal("solution"),
  v.literal("channels"),
  v.literal("revenueStreams"),
  v.literal("costStructure"),
  v.literal("keyMetrics"),
  v.literal("unfairAdvantage")
);

const evidenceValidator = v.union(
  v.literal("unknown"),
  v.literal("assumption"),
  v.literal("observed"),
  v.literal("supported"),
  v.literal("contradicted"),
  v.literal("decision")
);

const BLOCK_ORDER: Doc<"notes">["block"][] = [
  "problem",
  "customerSegments",
  "uniqueValueProposition",
  "solution",
  "channels",
  "revenueStreams",
  "costStructure",
  "keyMetrics",
  "unfairAdvantage",
];

function canvasUrl(canvasId: Id<"canvases">) {
  return `${process.env.SITE_URL ?? "https://lean.incrementic.com"}/canvas/${canvasId}`;
}

async function resolveCanvas(
  ctx: QueryCtx,
  user: Doc<"users">,
  rawCanvasId: string,
  needEdit: boolean
) {
  const canvasId = ctx.db.normalizeId("canvases", rawCanvasId);
  const canvas = canvasId ? await ctx.db.get(canvasId) : null;
  const role = canvas ? await getCanvasRole(ctx, canvas._id, user._id) : null;
  if (!canvas || !role) throw new ConvexError(`Canvas not found: ${rawCanvasId}`);
  if (needEdit && role === "viewer") {
    throw new ConvexError("You only have viewer access to this canvas");
  }
  return { canvas, role };
}

export const listCanvases = query({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const canvases = await listCanvasesForUser(ctx, user._id);
    return canvases.map((c) => ({
      canvasId: c._id,
      title: c.title,
      description: c.description ?? "",
      role: c.role,
      updatedAt: new Date(c.updatedAt).toISOString(),
      url: canvasUrl(c._id),
    }));
  },
});

export const getCanvas = query({
  args: { accessToken: v.string(), canvasId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas, role } = await resolveCanvas(ctx, user, args.canvasId, false);

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
      .collect();

    const blocks: Record<string, { noteId: Id<"notes">; text: string; evidenceState: string }[]> = {};
    for (const block of BLOCK_ORDER) {
      blocks[block] = notes
        .filter((n) => n.block === block)
        .sort((a, b) => a.order - b.order)
        .map((n) => ({ noteId: n._id, text: n.content, evidenceState: n.evidenceState }));
    }

    return {
      canvasId: canvas._id,
      title: canvas.title,
      description: canvas.description ?? "",
      status: canvas.status,
      yourRole: role,
      url: canvasUrl(canvas._id),
      blocks,
    };
  },
});

export const createCanvas = mutation({
  args: {
    accessToken: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    seedNotes: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const canvasId = await createCanvasForUser(ctx, user, {
      title: args.title,
      description: args.description,
      seedNotes: args.seedNotes,
    });
    return { canvasId, url: canvasUrl(canvasId) };
  },
});

export const addNote = mutation({
  args: {
    accessToken: v.string(),
    canvasId: v.string(),
    block: blockValidator,
    content: v.string(),
    evidenceState: v.optional(evidenceValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, true);
    const noteId = await addNoteForUser(ctx, user._id, {
      canvasId: canvas._id,
      block: args.block,
      content: args.content,
      evidenceState: args.evidenceState,
    });
    return { noteId };
  },
});

export const updateEvidenceState = mutation({
  args: {
    accessToken: v.string(),
    noteId: v.string(),
    evidenceState: evidenceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const noteId = ctx.db.normalizeId("notes", args.noteId);
    const note = noteId ? await ctx.db.get(noteId) : null;
    if (!note) throw new ConvexError(`Note not found: ${args.noteId}`);
    await resolveCanvas(ctx, user, note.canvasId, true);
    await updateNoteForUser(ctx, user._id, note, { evidenceState: args.evidenceState });
    return { noteId: note._id, evidenceState: args.evidenceState };
  },
});

export const resolveTokenUserId = internalQuery({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromAccessToken(ctx, args.accessToken);
    return user?._id ?? null;
  },
});

export const normalizeCanvasId = internalQuery({
  args: { canvasId: v.string() },
  handler: async (ctx, args) => ctx.db.normalizeId("canvases", args.canvasId),
});

export const runStressTest = action({
  args: { accessToken: v.string(), canvasId: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const userId = await ctx.runQuery(internal.mcp.resolveTokenUserId, {
      accessToken: args.accessToken,
    });
    if (!userId) throw new ConvexError("INVALID_ACCESS_TOKEN");
    const canvasId = await ctx.runQuery(internal.mcp.normalizeCanvasId, { canvasId: args.canvasId });
    if (!canvasId) throw new ConvexError(`Canvas not found: ${args.canvasId}`);
    try {
      return await runStressTestForUser(ctx, canvasId, userId);
    } catch (err) {
      throw new ConvexError(err instanceof Error ? err.message : "Stress test failed");
    }
  },
});

export const verifyToken = query({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    return (await getUserFromAccessToken(ctx, args.accessToken)) !== null;
  },
});
