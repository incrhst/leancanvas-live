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
import { listCanvasMembers } from "./lib/members";
import { listPeople } from "./lib/people";
import { compareSnapshots, createSnapshotForUser, listSnapshots } from "./lib/snapshots";
import { buildReview } from "./lib/review";
import { answerCheckInForUser, listPendingCheckIns, mondayOf, startCheckInForCanvas } from "./lib/checkIns";
import { verdictValidator } from "./lib/testFields";
import {
  answerDecisionForUser,
  decisionAnswerValidator,
  listOpenDecisionsFor,
  requestDecisionForUser,
  withdrawDecisionForUser,
} from "./lib/decisions";
import { addDays, daysBetween, testFieldsUpdateArgs, todayUtc } from "./lib/testFields";
import { createCanvasForUser, listCanvasesForUser, updateCanvasMetaForUser } from "./canvases";
import { addNoteForUser, deleteNoteForUser, updateNoteForUser } from "./notes";
import { runStressTestForUser } from "./stressTests";
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
import { decisionBasisValidator, ITEM_STATE_MEANINGS, ITEM_STATES, lookBackValidator } from "./lib/goalModel";
import {
  blockStage,
  runbookStatusValidator,
  runOutcomeValidator,
  settableStageValidator,
  STAGE_MEANINGS,
  STAGES,
} from "./lib/runbookModel";
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

type CanvasContext = {
  launchDate?: string;
  memberNames: Map<Id<"users">, string>;
  // Deciders without an account
  personNames: Map<string, string>;
};

async function canvasContext(ctx: QueryCtx, canvas: Doc<"canvases">): Promise<CanvasContext> {
  const members = await listCanvasMembers(ctx, canvas);
  const people = await listPeople(ctx, canvas._id, { withEmail: false });
  return {
    launchDate: canvas.launchDate,
    memberNames: new Map(members.map((m) => [m.userId, m.name])),
    personNames: new Map(people.map((p) => [p.id, p.name])),
  };
}

/**
 * A note as agents see it. Test fields and driver appear only when set; reviewDay only when the
 * canvas has a launch date.
 */
function noteForAgent(n: Doc<"notes">, { launchDate, memberNames, personNames }: CanvasContext) {
  return {
    noteId: n._id,
    block: n.block,
    text: n.content,
    evidenceState: n.evidenceState,
    stage: n.stage ?? "guess",
    driver: n.ownerId
      ? { userId: n.ownerId, name: memberNames.get(n.ownerId) ?? "Former member" }
      : undefined,
    markets: n.markets,
    decision: n.decision
      ? {
          question: n.decision.question,
          status: n.decision.status,
          decider: n.decision.deciderId
            ? { userId: n.decision.deciderId, name: memberNames.get(n.decision.deciderId) ?? "Former member" }
            : {
                name: personNames.get(n.decision.deciderPersonId ?? "") ?? "Unknown person",
                withoutAccount: true,
              },
          dueDate: n.decision.dueDate,
          defaultOutcome: n.decision.defaultOutcome,
          options: n.decision.options,
          deferOptions: n.decision.deferOptions,
          requestedBy: memberNames.get(n.decision.requestedBy) ?? "Former member",
          choice: n.decision.choice,
          comment: n.decision.comment,
          answeredVia: n.decision.answeredVia,
          answeredByName: n.decision.answeredByName,
        }
      : undefined,
    measure: n.measure,
    passMark: n.passMark,
    reviewDate: n.reviewDate,
    reviewDay: launchDate && n.reviewDate ? daysBetween(launchDate, n.reviewDate) : undefined,
    latestResult: n.latestResult,
  };
}

/** Agents pass people as user id strings (from list_canvas_members); null clears the driver. */
function resolveUser(ctx: QueryCtx, raw: string | null | undefined): Id<"users"> | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const id = ctx.db.normalizeId("users", raw);
  if (!id) throw new ConvexError(`Unknown user: ${raw}. Use a userId from list_canvas_members.`);
  return id;
}

/** The driver an agent passed, under its current name or the older ownerUserId. */
function driverArg(args: { driverUserId?: string | null; ownerUserId?: string | null }) {
  return args.driverUserId !== undefined ? args.driverUserId : args.ownerUserId;
}

/**
 * Lets agents give a date as a day of the plan ("day 30") instead of a calendar date.
 */
function resolvePlanDate(
  canvas: Doc<"canvases">,
  date: string | null | undefined,
  day: number | undefined,
  names = { date: "reviewDate", day: "reviewDay" }
): string | null | undefined {
  if (day === undefined) return date;
  if (date !== undefined) throw new ConvexError(`Pass ${names.date} or ${names.day}, not both`);
  if (!Number.isInteger(day)) throw new ConvexError(`${names.day} must be a whole number of days`);
  if (!canvas.launchDate) {
    throw new ConvexError(
      `This canvas has no launch date, so ${names.day} can't be used. Set one with update_canvas, or pass ${names.date}.`
    );
  }
  return addDays(canvas.launchDate, day);
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
  args: {
    accessToken: v.string(),
    canvasId: v.string(),
    // Only notes this user id is driving, or "unassigned" for notes with no driver
    driverUserId: v.optional(v.string()),
    // Older name for driverUserId, still accepted
    ownerUserId: v.optional(v.string()),
    // Only notes that hold in this market: tagged with it, or untagged (which means every market)
    market: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas, role } = await resolveCanvas(ctx, user, args.canvasId, false);

    const driver = args.driverUserId ?? args.ownerUserId;
    const market = args.market?.trim().toLowerCase();
    const allNotes = await ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
      .collect();
    const notes = allNotes
      .filter((n) => !driver || (driver === "unassigned" ? !n.ownerId : n.ownerId === driver))
      .filter((n) => !market || !n.markets || n.markets.some((m) => m.toLowerCase() === market));

    const template = templateOf(canvas);
    const context = await canvasContext(ctx, canvas);
    const launchDate = context.launchDate;
    const blocks: Record<string, Omit<ReturnType<typeof noteForAgent>, "block">[]> = {};
    for (const block of BLOCKS_BY_TEMPLATE[template]) {
      blocks[block] = notes
        .filter((n) => n.block === block)
        .sort((a, b) => a.order - b.order)
        .map((n) => {
          const { block: _block, ...rest } = noteForAgent(n, context);
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
      ...(driver ? { filteredByDriver: driver } : {}),
      ...(market ? { filteredByMarket: args.market!.trim() } : {}),
      markets: [...new Set(allNotes.flatMap((n) => n.markets ?? []))].sort(),
      // How runnable each box is: the stage of its least runnable note (null when empty)
      blockStages: Object.fromEntries(
        BLOCKS_BY_TEMPLATE[template].map((b) => [b, blockStage(allNotes.filter((n) => n.block === b))])
      ),
      blocks,
    };
  },
});

/**
 * Everyone with access to a canvas, with the userId to use as a note's driver or a decision's decider.
 */
export const listMembers = query({
  args: { accessToken: v.string(), canvasId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, false);
    return { canvasId: canvas._id, members: await listCanvasMembers(ctx, canvas) };
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
      message: `Open this link while signed in to CriticalDash. The ${format} downloads once the canvas loads: ${url}`,
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
    driverUserId: v.optional(v.union(v.string(), v.null())),
    // Older name for driverUserId, still accepted
    ownerUserId: v.optional(v.union(v.string(), v.null())),
    markets: v.optional(v.union(v.array(v.string()), v.null())),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, true);
    const { accessToken: _token, canvasId: _canvasId, reviewDay: _day, driverUserId: _driver, ownerUserId: _owner, ...fields } = args;
    const noteId = await addNoteForUser(ctx, actor, {
      ...fields,
      reviewDate: resolvePlanDate(canvas, args.reviewDate, args.reviewDay),
      ownerId: resolveUser(ctx, driverArg(args)),
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
    driverUserId: v.optional(v.union(v.string(), v.null())),
    // Older name for driverUserId, still accepted
    ownerUserId: v.optional(v.union(v.string(), v.null())),
    markets: v.optional(v.union(v.array(v.string()), v.null())),
    stage: v.optional(settableStageValidator),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const note = await resolveNote(ctx, user, args.noteId, true);
    const canvas = (await ctx.db.get(note.canvasId))!;
    const { accessToken: _token, noteId: _noteId, reason, link, reviewDay: _day, driverUserId: _driver, ownerUserId: _owner, ...rest } = args;
    const changes = {
      ...rest,
      reviewDate: resolvePlanDate(canvas, args.reviewDate, args.reviewDay),
      ownerId: resolveUser(ctx, driverArg(args)),
    };
    const content = args.content?.trim();
    if (args.content !== undefined && !content) throw new ConvexError("content cannot be empty");
    if (Object.values(changes).every((value) => value === undefined)) {
      throw new ConvexError(
        "Nothing to change: pass content, block, evidenceState, stage, driverUserId, measure, passMark, reviewDate or latestResult"
      );
    }
    await updateNoteForUser(ctx, actor, note, { ...changes, content, reason, link });
    return noteForAgent((await ctx.db.get(note._id))!, await canvasContext(ctx, canvas));
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

export const requestDecision = mutation({
  args: {
    accessToken: v.string(),
    noteId: v.string(),
    question: v.string(),
    // A canvas member, or someone without an account by name and email
    deciderUserId: v.optional(v.string()),
    deciderName: v.optional(v.string()),
    deciderEmail: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    dueDay: v.optional(v.number()),
    defaultOutcome: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    deferOptions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const note = await resolveNote(ctx, user, args.noteId, true);
    const canvas = (await ctx.db.get(note.canvasId))!;
    const dueDate = resolvePlanDate(canvas, args.dueDate, args.dueDay, { date: "dueDate", day: "dueDay" });
    if (!dueDate) throw new ConvexError("Pass dueDate (YYYY-MM-DD) or dueDay");
    const byContact = args.deciderName !== undefined || args.deciderEmail !== undefined;
    if (byContact === (args.deciderUserId !== undefined)) {
      throw new ConvexError("Pass deciderUserId for a canvas member, or deciderName and deciderEmail for someone without an account");
    }
    if (byContact && (!args.deciderName || !args.deciderEmail)) {
      throw new ConvexError("Pass both deciderName and deciderEmail");
    }
    await requestDecisionForUser(ctx, actor, note, {
      question: args.question,
      deciderId: args.deciderUserId !== undefined ? resolveUser(ctx, args.deciderUserId)! : undefined,
      decider: byContact ? { name: args.deciderName!, email: args.deciderEmail! } : undefined,
      dueDate,
      defaultOutcome: args.defaultOutcome,
      options: args.options,
      deferOptions: args.deferOptions,
    });
    return noteForAgent((await ctx.db.get(note._id))!, await canvasContext(ctx, canvas));
  },
});

export const answerDecision = mutation({
  args: {
    accessToken: v.string(),
    noteId: v.string(),
    answer: decisionAnswerValidator,
    choice: v.optional(v.string()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    // Viewers can answer requests addressed to them, so no edit access is needed
    const note = await resolveNote(ctx, user, args.noteId, false);
    await answerDecisionForUser(ctx, actor, note, {
      answer: args.answer,
      choice: args.choice,
      comment: args.comment,
    });
    const canvas = (await ctx.db.get(note.canvasId))!;
    return noteForAgent((await ctx.db.get(note._id))!, await canvasContext(ctx, canvas));
  },
});

export const withdrawDecision = mutation({
  args: { accessToken: v.string(), noteId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const note = await resolveNote(ctx, user, args.noteId, true);
    await withdrawDecisionForUser(ctx, actor, note, { reason: args.reason });
    return { noteId: note._id, withdrawn: true };
  },
});

/**
 * With a canvasId: every note on it that has a decision request, open or answered.
 * Without: the open decisions waiting on the caller, across all their canvases.
 */
export const listDecisions = query({
  args: { accessToken: v.string(), canvasId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    if (!args.canvasId) {
      const open = await listOpenDecisionsFor(ctx, user._id);
      return {
        waitingOnYou: open.map((d) => ({ ...d, requestedAt: new Date(d.requestedAt).toISOString() })),
      };
    }
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, false);
    const context = await canvasContext(ctx, canvas);
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
      .collect();
    return {
      canvasId: canvas._id,
      decisions: notes
        .filter((n) => n.decision)
        .sort((a, b) => a.decision!.dueDate.localeCompare(b.decision!.dueDate))
        .map((n) => noteForAgent(n, context)),
    };
  },
});

export const createSnapshot = mutation({
  args: { accessToken: v.string(), canvasId: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, true);
    const snapshotId = await createSnapshotForUser(ctx, user._id, canvas, args.label);
    const snapshot = (await ctx.db.get(snapshotId))!;
    return { snapshotId, label: snapshot.label, noteCount: snapshot.noteCount };
  },
});

export const listCanvasSnapshots = query({
  args: { accessToken: v.string(), canvasId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, false);
    const snapshots = await listSnapshots(ctx, canvas);
    return {
      canvasId: canvas._id,
      snapshots: snapshots.map((s) => ({ ...s, takenAt: new Date(s.takenAt).toISOString() })),
    };
  },
});

export const compareCanvasSnapshots = query({
  args: { accessToken: v.string(), canvasId: v.string(), from: v.string(), to: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, false);
    const side = (raw: string) => {
      if (raw === "current") return "current" as const;
      const id = ctx.db.normalizeId("canvasSnapshots", raw);
      if (!id) throw new ConvexError(`Snapshot not found: ${raw}. Use a snapshotId from list_snapshots, or "current".`);
      return id;
    };
    const result = await compareSnapshots(ctx, canvas, side(args.from), side(args.to ?? "current"));
    return {
      ...result,
      from: { ...result.from, takenAt: new Date(result.from.takenAt).toISOString() },
      to: { ...result.to, takenAt: new Date(result.to.takenAt).toISOString() },
    };
  },
});

/** The review-meeting view: tests and results, open decisions, changes since a snapshot. */
export const getReview = query({
  args: { accessToken: v.string(), canvasId: v.string(), sinceSnapshotId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, false);
    let since: Id<"canvasSnapshots"> | undefined;
    if (args.sinceSnapshotId) {
      const id = ctx.db.normalizeId("canvasSnapshots", args.sinceSnapshotId);
      if (!id) throw new ConvexError(`Snapshot not found: ${args.sinceSnapshotId}`);
      since = id;
    }
    const review = await buildReview(ctx, canvas, since);
    const iso = (ms: number) => new Date(ms).toISOString();
    return {
      ...review,
      openDecisions: review.openDecisions.map(({ deciderId: _id, ...d }) => d),
      since: review.since && { ...review.since, takenAt: iso(review.since.takenAt) },
      snapshots: review.snapshots.map((s) => ({ ...s, takenAt: iso(s.takenAt) })),
      changes: review.changes && {
        ...review.changes,
        from: { ...review.changes.from, takenAt: iso(review.changes.from.takenAt) },
        to: { ...review.changes.to, takenAt: iso(review.changes.to.takenAt) },
      },
      url: `${canvasUrl(canvas._id)}/review`,
    };
  },
});

export const listCheckIns = query({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    return { waitingOnYou: await listPendingCheckIns(ctx, user._id) };
  },
});

export const answerCheckIn = mutation({
  args: {
    accessToken: v.string(),
    noteId: v.string(),
    hasEvidence: v.boolean(),
    text: v.optional(v.string()),
    verdict: v.optional(verdictValidator),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    // Drivers can be view-only; answering their own check-in is allowed
    const note = await resolveNote(ctx, user, args.noteId, false);
    await answerCheckInForUser(ctx, actor, note._id, {
      hasEvidence: args.hasEvidence,
      text: args.text,
      verdict: args.verdict,
      date: args.date,
    });
    const canvas = (await ctx.db.get(note.canvasId))!;
    return noteForAgent((await ctx.db.get(note._id))!, await canvasContext(ctx, canvas));
  },
});

export const sendCheckIn = mutation({
  args: { accessToken: v.string(), canvasId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, true);
    return await startCheckInForCanvas(ctx, canvas, mondayOf(todayUtc()));
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

// ---------- Goals, items and decision records ----------

async function resolveGoal(ctx: QueryCtx, user: Doc<"users">, rawGoalId: string, needEdit: boolean) {
  const goalId = ctx.db.normalizeId("goals", rawGoalId);
  const goal = goalId ? await ctx.db.get(goalId) : null;
  if (!goal) throw new ConvexError(`Goal not found: ${rawGoalId}`);
  const { canvas } = await resolveCanvas(ctx, user, goal.canvasId, needEdit);
  return { goal, canvas };
}

async function resolveItem(ctx: QueryCtx, user: Doc<"users">, rawItemId: string) {
  const itemId = ctx.db.normalizeId("items", rawItemId);
  const item = itemId ? await ctx.db.get(itemId) : null;
  if (!item) throw new ConvexError(`Item not found: ${rawItemId}`);
  const { canvas } = await resolveCanvas(ctx, user, item.canvasId, true);
  return { item, canvas };
}

function resolveNoteIds(ctx: QueryCtx, raw: string[] | undefined): Id<"notes">[] | undefined {
  return raw?.map((r) => {
    const id = ctx.db.normalizeId("notes", r);
    if (!id) throw new ConvexError(`Unknown note: ${r}`);
    return id;
  });
}

/** One goal's items with their states and decision records, or every goal on the canvas. */
async function goalsForAgent(ctx: QueryCtx, canvas: Doc<"canvases">) {
  const view = await buildGoalsView(ctx, canvas);
  return {
    canvasId: canvas._id,
    today: view.today,
    states: ITEM_STATES.map((s) => `${s}: ${ITEM_STATE_MEANINGS[s]}`),
    goals: view.goals.map((g) => ({
      goalId: g.goalId,
      title: g.title,
      headline: g.headline,
      counts: g.counts,
      reached: g.reached,
      items: g.items.map(({ order: _order, ownerId, goalId: _goalId, ...i }) => ({
        ...i,
        driver: ownerId ? { userId: ownerId, name: i.driver } : undefined,
      })),
    })),
    lookBacksDue: view.lookBacksDue.map((i) => ({ itemId: i.itemId, goal: i.goal, title: i.title, decision: i.decision })),
    basisStats: view.basisStats,
  };
}

export const listGoals = query({
  args: { accessToken: v.string(), canvasId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, false);
    return await goalsForAgent(ctx, canvas);
  },
});

export const createGoalForAgent = mutation({
  args: { accessToken: v.string(), canvasId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, true);
    return { goalId: await createGoal(ctx, actor, canvas._id, args.title) };
  },
});

export const updateGoalForAgent = mutation({
  args: { accessToken: v.string(), goalId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { goal } = await resolveGoal(ctx, user, args.goalId, true);
    await renameGoal(ctx, goal, args.title);
    return { goalId: goal._id, title: args.title.trim() };
  },
});

export const deleteGoalForAgent = mutation({
  args: { accessToken: v.string(), goalId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { goal } = await resolveGoal(ctx, user, args.goalId, true);
    await deleteGoal(ctx, goal);
    return { goalId: goal._id, deleted: true };
  },
});

const itemFieldArgs = {
  title: v.optional(v.string()),
  detail: v.optional(v.union(v.string(), v.null())),
  decideBy: v.optional(v.union(v.string(), v.null())),
  decideByDay: v.optional(v.number()),
  driverUserId: v.optional(v.union(v.string(), v.null())),
  contextNoteIds: v.optional(v.array(v.string())),
  ...testFieldsUpdateArgs,
  reviewDay: v.optional(v.number()),
};

export const addItemForAgent = mutation({
  args: { accessToken: v.string(), goalId: v.string(), ...itemFieldArgs, title: v.string() },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { goal, canvas } = await resolveGoal(ctx, user, args.goalId, true);
    const { accessToken: _t, goalId: _g, reviewDay: _d, decideByDay: _dd, driverUserId, contextNoteIds, ...fields } = args;
    const itemId = await createItem(ctx, actor, goal, {
      ...fields,
      decideBy: resolvePlanDate(canvas, args.decideBy, args.decideByDay, { date: "decideBy", day: "decideByDay" }),
      reviewDate: resolvePlanDate(canvas, args.reviewDate, args.reviewDay),
      ownerId: resolveUser(ctx, driverUserId),
      contextNoteIds: resolveNoteIds(ctx, contextNoteIds),
    });
    return { itemId, state: (await ctx.db.get(itemId))!.state };
  },
});

export const updateItemForAgent = mutation({
  args: { accessToken: v.string(), itemId: v.string(), goalId: v.optional(v.string()), ...itemFieldArgs },
  handler: async (ctx, args) => {
    const { user } = await requireTokenActor(ctx, args.accessToken);
    const { item, canvas } = await resolveItem(ctx, user, args.itemId);
    const { accessToken: _t, itemId: _i, reviewDay: _d, decideByDay: _dd, driverUserId, contextNoteIds, goalId, ...fields } = args;
    let targetGoal: Id<"goals"> | undefined;
    if (goalId !== undefined) targetGoal = (await resolveGoal(ctx, user, goalId, true)).goal._id;
    await updateItem(ctx, item, {
      ...fields,
      decideBy: resolvePlanDate(canvas, args.decideBy, args.decideByDay, { date: "decideBy", day: "decideByDay" }),
      reviewDate: resolvePlanDate(canvas, args.reviewDate, args.reviewDay),
      ownerId: resolveUser(ctx, driverUserId),
      contextNoteIds: resolveNoteIds(ctx, contextNoteIds),
      goalId: targetGoal,
    });
    return { itemId: item._id, state: (await ctx.db.get(item._id))!.state };
  },
});

export const deleteItemForAgent = mutation({
  args: { accessToken: v.string(), itemId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { item } = await resolveItem(ctx, user, args.itemId);
    await deleteItem(ctx, item);
    return { itemId: item._id, deleted: true };
  },
});

export const decideItemForAgent = mutation({
  args: {
    accessToken: v.string(),
    itemId: v.string(),
    decision: v.string(),
    basis: decisionBasisValidator,
    basisNote: v.optional(v.string()),
    linkedNoteIds: v.optional(v.array(v.string())),
    decidedByUserId: v.optional(v.string()),
    decidedByName: v.optional(v.string()),
    reviewDate: v.optional(v.string()),
    reviewDay: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { item, canvas } = await resolveItem(ctx, user, args.itemId);
    const recordId = await decideItem(ctx, actor, item, {
      text: args.decision,
      basis: args.basis,
      basisNote: args.basisNote,
      linkedNoteIds: resolveNoteIds(ctx, args.linkedNoteIds),
      decidedBy: resolveUser(ctx, args.decidedByUserId) ?? undefined,
      decidedByName: args.decidedByName,
      reviewDate: resolvePlanDate(canvas, args.reviewDate, args.reviewDay) ?? undefined,
    });
    const record = (await ctx.db.get(recordId))!;
    return { itemId: item._id, state: "decided", recordId, reviewDate: record.reviewDate };
  },
});

export const markItemDoneForAgent = mutation({
  args: { accessToken: v.string(), itemId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { item } = await resolveItem(ctx, user, args.itemId);
    await markItemDone(ctx, item);
    return { itemId: item._id, state: "done" };
  },
});

export const reopenItemForAgent = mutation({
  args: { accessToken: v.string(), itemId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { item } = await resolveItem(ctx, user, args.itemId);
    await reopenItem(ctx, item);
    return { itemId: item._id, state: (await ctx.db.get(item._id))!.state };
  },
});

export const recordLookBackForAgent = mutation({
  args: { accessToken: v.string(), itemId: v.string(), outcome: lookBackValidator, note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { item } = await resolveItem(ctx, user, args.itemId);
    await recordLookBack(ctx, actor, item, { outcome: args.outcome, note: args.note });
    return { itemId: item._id, outcome: args.outcome };
  },
});

export const convertNoteForAgent = mutation({
  args: { accessToken: v.string(), noteId: v.string(), goalId: v.string() },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const note = await resolveNote(ctx, user, args.noteId, true);
    const { goal } = await resolveGoal(ctx, user, args.goalId, true);
    const itemId = await convertNoteToItem(ctx, actor, note, goal);
    return { itemId, state: (await ctx.db.get(itemId))!.state };
  },
});

// ---------- SOPs, runbooks and runs ----------

function normalizeIds<T extends "notes" | "items" | "users" | "sops">(ctx: QueryCtx, table: T, raw: string[] | undefined) {
  return raw?.map((r) => {
    const id = ctx.db.normalizeId(table, r);
    if (!id) throw new ConvexError(`Unknown ${table.slice(0, -1)}: ${r}`);
    return id;
  });
}

async function resolveRunbook(ctx: QueryCtx, user: Doc<"users">, raw: string, needEdit: boolean) {
  const id = ctx.db.normalizeId("runbooks", raw);
  const runbook = id ? await ctx.db.get(id) : null;
  if (!runbook) throw new ConvexError(`Runbook not found: ${raw}`);
  const { canvas } = await resolveCanvas(ctx, user, runbook.canvasId, needEdit);
  return { runbook, canvas };
}

async function resolveSop(ctx: QueryCtx, user: Doc<"users">, raw: string) {
  const id = ctx.db.normalizeId("sops", raw);
  const sop = id ? await ctx.db.get(id) : null;
  if (!sop) throw new ConvexError(`SOP not found: ${raw}`);
  await resolveCanvas(ctx, user, sop.canvasId, true);
  return sop;
}

export const listRunbooks = query({
  args: { accessToken: v.string(), canvasId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, false);
    const view = await buildRunbooksView(ctx, canvas);
    return {
      canvasId: canvas._id,
      stages: STAGES.map((st) => `${st}: ${STAGE_MEANINGS[st]}`),
      blockStages: view.blockStages,
      sops: view.sops,
      runbooks: view.runbooks.map(({ ownerId, ...r }) => ({
        ...r,
        owner: ownerId ? { userId: ownerId, name: r.owner } : undefined,
      })),
      needsAttention: view.attention.map((r) => ({
        runbookId: r.runbookId,
        title: r.title,
        keepsFailingAtStep: r.stats.keepsFailingAt,
        reviewDue: r.reviewDue,
      })),
    };
  },
});

export const createSopForAgent = mutation({
  args: { accessToken: v.string(), canvasId: v.string(), title: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { canvas } = await resolveCanvas(ctx, user, args.canvasId, true);
    return { sopId: await createSop(ctx, actor, canvas._id, args) };
  },
});

export const updateSopForAgent = mutation({
  args: { accessToken: v.string(), sopId: v.string(), title: v.optional(v.string()), description: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const sop = await resolveSop(ctx, user, args.sopId);
    await updateSop(ctx, sop, args);
    return { sopId: sop._id };
  },
});

export const deleteSopForAgent = mutation({
  args: { accessToken: v.string(), sopId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTokenUser(ctx, args.accessToken);
    const sop = await resolveSop(ctx, user, args.sopId);
    await deleteSop(ctx, sop);
    return { sopId: sop._id, deleted: true };
  },
});

const agentRunbookFields = {
  title: v.optional(v.string()),
  trigger: v.optional(v.union(v.string(), v.null())),
  ownerUserId: v.optional(v.union(v.string(), v.null())),
  steps: v.optional(v.array(v.string())),
  noteIds: v.optional(v.array(v.string())),
  itemIds: v.optional(v.array(v.string())),
  sopId: v.optional(v.union(v.string(), v.null())),
  reviewDate: v.optional(v.union(v.string(), v.null())),
};

function runbookFieldsFrom(ctx: QueryCtx, args: {
  title?: string;
  trigger?: string | null;
  ownerUserId?: string | null;
  steps?: string[];
  noteIds?: string[];
  itemIds?: string[];
  sopId?: string | null;
  reviewDate?: string | null;
}) {
  return {
    title: args.title,
    trigger: args.trigger,
    ownerId: resolveUser(ctx, args.ownerUserId),
    steps: args.steps,
    noteIds: normalizeIds(ctx, "notes", args.noteIds),
    itemIds: normalizeIds(ctx, "items", args.itemIds),
    sopId: args.sopId === null ? null : args.sopId === undefined ? undefined : normalizeIds(ctx, "sops", [args.sopId])![0],
    reviewDate: args.reviewDate,
  };
}

export const createRunbookForAgent = mutation({
  args: {
    accessToken: v.string(),
    canvasId: v.optional(v.string()),
    // Start from a canvas note or a decided goal item instead of from scratch
    fromNoteId: v.optional(v.string()),
    fromItemId: v.optional(v.string()),
    ...agentRunbookFields,
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const sources = [args.canvasId, args.fromNoteId, args.fromItemId].filter((x) => x !== undefined);
    if (sources.length !== 1) throw new ConvexError("Pass exactly one of canvasId, fromNoteId or fromItemId");
    let runbookId: Id<"runbooks">;
    if (args.fromNoteId) {
      const note = await resolveNote(ctx, user, args.fromNoteId, true);
      runbookId = await runbookFromNote(ctx, actor, note);
    } else if (args.fromItemId) {
      const { item } = await resolveItem(ctx, user, args.fromItemId);
      runbookId = await runbookFromItem(ctx, actor, item);
    } else {
      const { canvas } = await resolveCanvas(ctx, user, args.canvasId!, true);
      if (!args.title) throw new ConvexError("title is required");
      runbookId = await createRunbook(ctx, actor, canvas._id, runbookFieldsFrom(ctx, args));
      return { runbookId, status: "draft" };
    }
    const fields = runbookFieldsFrom(ctx, args);
    if (Object.values(fields).some((x) => x !== undefined)) {
      await updateRunbook(ctx, actor, (await ctx.db.get(runbookId))!, fields);
    }
    return { runbookId, status: "draft" };
  },
});

export const updateRunbookForAgent = mutation({
  args: { accessToken: v.string(), runbookId: v.string(), status: v.optional(runbookStatusValidator), ...agentRunbookFields },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { runbook } = await resolveRunbook(ctx, user, args.runbookId, true);
    const fields = runbookFieldsFrom(ctx, args);
    if (Object.values(fields).some((x) => x !== undefined)) await updateRunbook(ctx, actor, runbook, fields);
    if (args.status) await setRunbookStatus(ctx, actor, (await ctx.db.get(runbook._id))!, args.status);
    const after = (await ctx.db.get(runbook._id))!;
    return { runbookId: after._id, status: after.status };
  },
});

export const deleteRunbookForAgent = mutation({
  args: { accessToken: v.string(), runbookId: v.string() },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    const { runbook } = await resolveRunbook(ctx, user, args.runbookId, true);
    await deleteRunbook(ctx, actor, runbook);
    return { runbookId: runbook._id, deleted: true };
  },
});

export const logRunForAgent = mutation({
  args: {
    accessToken: v.string(),
    runbookId: v.string(),
    outcome: runOutcomeValidator,
    failedStep: v.optional(v.number()),
    numbers: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, actor } = await requireTokenActor(ctx, args.accessToken);
    // Any member can log a run, viewers included
    const { runbook } = await resolveRunbook(ctx, user, args.runbookId, false);
    const runId = await logRun(ctx, actor, runbook, {
      outcome: args.outcome,
      failedStep: args.failedStep,
      numbers: args.numbers,
      note: args.note,
    });
    return { runId, runbookId: runbook._id, outcome: args.outcome };
  },
});
