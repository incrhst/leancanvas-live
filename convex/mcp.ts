/**
 * Functions backing the MCP server (src/app/api/mcp/route.ts).
 * Each call is authenticated by the OAuth bearer access token issued in convex/oauth.ts.
 */
import { action, internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getCanvasRole, getUserFromAccessToken, requireTokenActor, requireTokenUser } from "./lib/auth";
import { listNoteHistory } from "./lib/history";
import { addDays, daysBetween, testFieldsUpdateArgs, todayUtc } from "./lib/testFields";
import { createCanvasForUser, listCanvasesForUser, updateCanvasMetaForUser } from "./canvases";
import { addNoteForUser, deleteNoteForUser, updateNoteForUser } from "./notes";
import { runStressTestForUser } from "./stressTests";
import { BLOCKS_BY_TEMPLATE, blockValidator, canvasTemplateValidator, templateOf } from "./lib/canvasTemplates";

const evidenceValidator = v.union(
  v.literal("unknown"),
  v.literal("assumption"),
  v.literal("observed"),
  v.literal("supported"),
  v.literal("contradicted"),
  v.literal("decision")
);

function canvasUrl(canvasId: Id<"canvases">) {
  return `${process.env.SITE_URL ?? "https://lean.incrementic.com"}/canvas/${canvasId}`;
}

/** A note as agents see it. Test fields appear only when set; reviewDay only when the canvas has a launch date. */
function noteForAgent(n: Doc<"notes">, launchDate: string | undefined) {
  return {
    noteId: n._id,
    block: n.block,
    text: n.content,
    evidenceState: n.evidenceState,
    measure: n.measure,
    passMark: n.passMark,
    reviewDate: n.reviewDate,
    reviewDay: launchDate && n.reviewDate ? daysBetween(launchDate, n.reviewDate) : undefined,
    latestResult: n.latestResult,
  };
}

/**
 * Lets agents give a review date as a day of the plan ("day 30") instead of a calendar date.
 */
function resolveReviewDay(
  canvas: Doc<"canvases">,
  args: { reviewDate?: string | null; reviewDay?: number }
): string | null | undefined {
  if (args.reviewDay === undefined) return args.reviewDate;
  if (args.reviewDate !== undefined) throw new ConvexError("Pass reviewDate or reviewDay, not both");
  if (!Number.isInteger(args.reviewDay)) throw new ConvexError("reviewDay must be a whole number of days");
  if (!canvas.launchDate) {
    throw new ConvexError("This canvas has no launch date, so reviewDay can't be used. Set one with update_canvas, or pass reviewDate.");
  }
  return addDays(canvas.launchDate, args.reviewDay);
}

async function resolveNote(ctx: QueryCtx, user: Doc<"users">, rawNoteId: string, needEdit: boolean) {
  const noteId = ctx.db.normalizeId("notes", rawNoteId);
  const note = noteId ? await ctx.db.get(noteId) : null;
  if (!note) throw new ConvexError(`Note not found: ${rawNoteId}`);
  await resolveCanvas(ctx, user, note.canvasId, needEdit);
  return note;
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
      template: templateOf(c),
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

    const template = templateOf(canvas);
    const blocks: Record<string, Omit<ReturnType<typeof noteForAgent>, "block">[]> = {};
    const launchDate = canvas.launchDate;
    for (const block of BLOCKS_BY_TEMPLATE[template]) {
      blocks[block] = notes
        .filter((n) => n.block === block)
        .sort((a, b) => a.order - b.order)
        .map((n) => {
          const { block: _block, ...rest } = noteForAgent(n, launchDate);
          return rest;
        });
    }

    return {
      canvasId: canvas._id,
      title: canvas.title,
      description: canvas.description ?? "",
      template,
      launchDate,
      currentDay: launchDate ? daysBetween(launchDate, todayUtc()) : undefined,
      status: canvas.status,
      yourRole: role,
      url: canvasUrl(canvas._id),
      blocks,
    };
  },
});

/**
 * Returns a link that downloads the canvas, or its riskiest assumptions, as a PDF or PNG.
 * The file is rendered in the browser, so the link opens the canvas with an `export` param that the page acts on.
 */
export const exportCanvas = query({
  args: {
    accessToken: v.string(),
    canvasId: v.string(),
    view: v.union(v.literal("canvas"), v.literal("riskiest_assumptions")),
    format: v.union(v.literal("pdf"), v.literal("png")),
  },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, false);

    const params = new URLSearchParams();
    const kind = args.view === "riskiest_assumptions" ? "risks" : "canvas";
    if (kind === "risks") {
      const latest = await ctx.db
        .query("stressTests")
        .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
        .order("desc")
        .first();
      if (!latest || latest.riskiestAssumptions.length === 0) {
        throw new ConvexError("This canvas has no riskiest assumptions yet. Run the stress test first.");
      }
      params.set("view", "risks");
    }
    params.set("export", `${kind}-${args.format}`);

    const format = args.format.toUpperCase();
    const url = `${canvasUrl(canvas._id)}?${params.toString()}`;
    return {
      canvasId: canvas._id,
      title: canvas.title,
      view: args.view,
      format: args.format,
      url,
      message: `Open this link while signed in to LeanCanvas. The ${format} downloads once the canvas loads: ${url}`,
    };
  },
});

export const createCanvas = mutation({
  args: {
    accessToken: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    seedNotes: v.optional(v.boolean()),
    template: v.optional(canvasTemplateValidator),
    launchDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const canvasId = await createCanvasForUser(ctx, user, {
      title: args.title,
      description: args.description,
      seedNotes: args.seedNotes,
      template: args.template,
      launchDate: args.launchDate,
    });
    return { canvasId, url: canvasUrl(canvasId) };
  },
});

export const updateCanvas = mutation({
  args: {
    accessToken: v.string(),
    canvasId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    launchDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, true);
    const title = args.title?.trim();
    if (args.title !== undefined && !title) throw new ConvexError("title cannot be empty");
    if (title === undefined && args.description === undefined && args.launchDate === undefined) {
      throw new ConvexError("Nothing to change: pass title, description or launchDate");
    }
    await updateCanvasMetaForUser(ctx, user._id, canvas._id, {
      title,
      description: args.description?.trim(),
      launchDate: args.launchDate,
    });
    const updated = (await ctx.db.get(canvas._id))!;
    return {
      canvasId: updated._id,
      title: updated.title,
      description: updated.description ?? "",
      launchDate: updated.launchDate,
      url: canvasUrl(updated._id),
    };
  },
});

export const addNote = mutation({
  args: {
    accessToken: v.string(),
    canvasId: v.string(),
    block: blockValidator,
    content: v.string(),
    evidenceState: v.optional(evidenceValidator),
    reason: v.optional(v.string()),
    ...testFieldsUpdateArgs,
    reviewDay: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, true);
    const { accessToken: _token, canvasId: _canvasId, reviewDay: _day, ...fields } = args;
    const noteId = await addNoteForUser(ctx, actor, {
      ...fields,
      reviewDate: resolveReviewDay(canvas, args),
      canvasId: canvas._id,
    });
    return { noteId };
  },
});

export const updateNote = mutation({
  args: {
    accessToken: v.string(),
    noteId: v.string(),
    content: v.optional(v.string()),
    block: v.optional(blockValidator),
    evidenceState: v.optional(evidenceValidator),
    reason: v.optional(v.string()),
    link: v.optional(v.string()),
    ...testFieldsUpdateArgs,
    reviewDay: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const note = await resolveNote(ctx, user, args.noteId, true);
    const canvas = (await ctx.db.get(note.canvasId))!;
    const { accessToken: _token, noteId: _noteId, reason, link, reviewDay: _day, ...rest } = args;
    const changes = { ...rest, reviewDate: resolveReviewDay(canvas, args) };
    const content = args.content?.trim();
    if (args.content !== undefined && !content) throw new ConvexError("content cannot be empty");
    if (Object.values(changes).every((value) => value === undefined)) {
      throw new ConvexError(
        "Nothing to change: pass content, block, evidenceState, measure, passMark, reviewDate or latestResult"
      );
    }
    await updateNoteForUser(ctx, actor, note, { ...changes, content, reason, link });
    return noteForAgent((await ctx.db.get(note._id))!, canvas.launchDate);
  },
});

export const deleteNote = mutation({
  args: {
    accessToken: v.string(),
    noteId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const note = await resolveNote(ctx, user, args.noteId, true);
    await deleteNoteForUser(ctx, actor, note, { reason: args.reason });
    return { noteId: note._id, deleted: true };
  },
});

/**
 * A note's change history, newest first. Still works after the note is deleted.
 */
export const getNoteHistory = query({
  args: { accessToken: v.string(), noteId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const noteId = ctx.db.normalizeId("notes", args.noteId);
    const note = noteId ? await ctx.db.get(noteId) : null;
    // A deleted note is found through its history rows, which keep the canvas
    const anyRow = noteId
      ? await ctx.db.query("noteHistory").withIndex("by_note", (q) => q.eq("noteId", noteId)).first()
      : null;
    const canvasId = note?.canvasId ?? anyRow?.canvasId;
    if (!noteId || !canvasId) throw new ConvexError(`Note not found: ${args.noteId}`);
    await resolveCanvas(ctx, user, canvasId, false);

    const rows = await listNoteHistory(ctx, noteId);
    return {
      noteId,
      deleted: !note,
      text: note?.content,
      history: rows.map((row) => ({
        at: new Date(row.at).toISOString(),
        by: row.userName,
        via: row.clientName ? `${row.via} (${row.clientName})` : row.via,
        kind: row.kind,
        changes: row.changes,
        reason: row.reason,
        link: row.link,
      })),
    };
  },
});

export const updateEvidenceState = mutation({
  args: {
    accessToken: v.string(),
    noteId: v.string(),
    evidenceState: evidenceValidator,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const note = await resolveNote(ctx, user, args.noteId, true);
    await updateNoteForUser(ctx, actor, note, { evidenceState: args.evidenceState, reason: args.reason });
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
