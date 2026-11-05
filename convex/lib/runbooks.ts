import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { Actor, diffFields, recordNoteHistory, trackedFields } from "./history";
import { listCanvasMembers } from "./members";
import { checkDate, todayUtc } from "./testFields";
import { currentRecord } from "./goals";
import {
  blockStage,
  MAX_RUNBOOK_LINKS,
  MAX_STEPS,
  RunbookStatus,
  RunOutcome,
  runStats,
  Stage,
  stageOf,
  stageRank,
  STAGE_LABELS,
} from "./runbookModel";

/**
 * SOPs, runbooks and their runs, and the stage of each canvas note (guess -> codified).
 * Like lib/goals.ts, nothing here checks access; goals/runbooks.ts and mcp.ts do.
 *
 * Rules:
 * - A runbook can go live only when every note it codifies is at least repeatable
 *   ("don't scale a guess"). Going live marks those notes codified.
 * - Codified is never set by hand. When a note's last live runbook is retired, unlinked or
 *   deleted, the note drops back to repeatable.
 */

const MAX_TITLE = 200;
const MAX_TEXT = 2000;
const MAX_STEP = 500;

function title(value: string, label: string) {
  const text = value.trim();
  if (!text) throw new ConvexError(`${label} cannot be empty`);
  if (text.length > MAX_TITLE) throw new ConvexError(`${label} is too long (at most ${MAX_TITLE} characters)`);
  return text;
}

function optional(value: string | null | undefined, label: string) {
  if (value === undefined) return undefined;
  const text = value?.trim();
  if (text && text.length > MAX_TEXT) throw new ConvexError(`${label} is too long (at most ${MAX_TEXT} characters)`);
  return text || undefined;
}

function cleanSteps(steps: string[]) {
  const clean = steps.map((s) => s.trim()).filter(Boolean);
  if (clean.length > MAX_STEPS) throw new ConvexError(`At most ${MAX_STEPS} steps`);
  for (const s of clean) {
    if (s.length > MAX_STEP) throw new ConvexError(`A step is too long (at most ${MAX_STEP} characters)`);
  }
  return clean;
}

async function checkIds<T extends "notes" | "items">(
  ctx: QueryCtx,
  canvasId: Id<"canvases">,
  ids: Id<T>[],
  label: string
): Promise<Id<T>[]> {
  const unique = [...new Set(ids)];
  if (unique.length > MAX_RUNBOOK_LINKS) throw new ConvexError(`At most ${MAX_RUNBOOK_LINKS} linked ${label}`);
  for (const id of unique) {
    const doc = (await ctx.db.get(id)) as unknown as { canvasId: Id<"canvases"> } | null;
    if (!doc || doc.canvasId !== canvasId) throw new ConvexError(`Not found on this canvas: ${id}`);
  }
  return unique;
}

async function checkOwner(ctx: QueryCtx, canvasId: Id<"canvases">, ownerId: Id<"users"> | null | undefined) {
  if (!ownerId) return;
  const canvas = (await ctx.db.get(canvasId))!;
  const members = await listCanvasMembers(ctx, canvas);
  if (!members.some((m) => m.userId === ownerId)) throw new ConvexError("The owner must be a canvas member");
}

function nextOrder(rows: { order: number }[]) {
  return rows.reduce((max, r) => Math.max(max, r.order), -1) + 1;
}

async function canvasRunbooks(ctx: QueryCtx, canvasId: Id<"canvases">) {
  return await ctx.db
    .query("runbooks")
    .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
    .collect();
}

// ---------- Stages ----------

async function setNoteStage(ctx: MutationCtx, actor: Actor, note: Doc<"notes">, stage: Stage, reason?: string) {
  if (stageOf(note) === stage) return;
  const next = { ...note, stage };
  await ctx.db.patch(note._id, { stage, updatedAt: Date.now() });
  await recordNoteHistory(ctx, actor, note, "updated", diffFields(trackedFields(note), trackedFields(next)), { reason });
}

/** Live runbooks that codify this note. */
export async function liveRunbooksFor(ctx: QueryCtx, note: Doc<"notes">) {
  const runbooks = await canvasRunbooks(ctx, note.canvasId);
  return runbooks.filter((r) => r.status === "live" && r.noteIds.includes(note._id));
}

/**
 * Sets a note's stage by hand: guess, tested or repeatable. A note a live runbook codifies stays
 * codified until that runbook is retired.
 */
export async function setStageByHand(ctx: MutationCtx, actor: Actor, note: Doc<"notes">, stage: Exclude<Stage, "codified">) {
  const live = await liveRunbooksFor(ctx, note);
  if (live.length > 0) {
    throw new ConvexError(
      `This note is codified by the live runbook "${live[0].title}". Retire the runbook or unlink the note first.`
    );
  }
  await setNoteStage(ctx, actor, note, stage);
}

/** After runbooks change: notes with no live runbook left drop from codified to repeatable. */
async function settleNotes(ctx: MutationCtx, actor: Actor, noteIds: Id<"notes">[]) {
  for (const id of new Set(noteIds)) {
    const note = await ctx.db.get(id);
    if (!note || note.stage !== "codified") continue;
    if ((await liveRunbooksFor(ctx, note)).length === 0) {
      await setNoteStage(ctx, actor, note, "repeatable", "No live runbook codifies it any more");
    }
  }
}

// ---------- SOPs ----------

export async function createSop(
  ctx: MutationCtx,
  actor: Actor,
  canvasId: Id<"canvases">,
  args: { title: string; description?: string }
) {
  const sops = await ctx.db
    .query("sops")
    .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
    .collect();
  return await ctx.db.insert("sops", {
    canvasId,
    title: title(args.title, "SOP"),
    description: optional(args.description, "Description"),
    order: nextOrder(sops),
    createdBy: actor.userId,
    updatedAt: Date.now(),
  });
}

export async function updateSop(ctx: MutationCtx, sop: Doc<"sops">, args: { title?: string; description?: string | null }) {
  const patch: Partial<Doc<"sops">> = { updatedAt: Date.now() };
  if (args.title !== undefined) patch.title = title(args.title, "SOP");
  if (args.description !== undefined) patch.description = optional(args.description, "Description");
  await ctx.db.patch(sop._id, patch);
}

/** Deletes an SOP; its runbooks stay, ungrouped. */
export async function deleteSop(ctx: MutationCtx, sop: Doc<"sops">) {
  const runbooks = await ctx.db
    .query("runbooks")
    .withIndex("by_sop", (q) => q.eq("sopId", sop._id))
    .collect();
  for (const r of runbooks) await ctx.db.patch(r._id, { sopId: undefined });
  await ctx.db.delete(sop._id);
}

// ---------- Runbooks ----------

export type RunbookFields = {
  title?: string;
  trigger?: string | null;
  ownerId?: Id<"users"> | null;
  steps?: string[];
  noteIds?: Id<"notes">[];
  itemIds?: Id<"items">[];
  sopId?: Id<"sops"> | null;
  reviewDate?: string | null;
};

async function checkSop(ctx: QueryCtx, canvasId: Id<"canvases">, sopId: Id<"sops"> | null | undefined) {
  if (!sopId) return;
  const sop = await ctx.db.get(sopId);
  if (!sop || sop.canvasId !== canvasId) throw new ConvexError("SOP not found on this canvas");
}

/** A new runbook starts as a draft. Notes at any stage can be linked to a draft. */
export async function createRunbook(ctx: MutationCtx, actor: Actor, canvasId: Id<"canvases">, fields: RunbookFields) {
  await checkOwner(ctx, canvasId, fields.ownerId);
  await checkSop(ctx, canvasId, fields.sopId);
  const runbooks = await canvasRunbooks(ctx, canvasId);
  return await ctx.db.insert("runbooks", {
    canvasId,
    sopId: fields.sopId ?? undefined,
    title: title(fields.title ?? "", "Runbook"),
    trigger: optional(fields.trigger, "Trigger"),
    ownerId: fields.ownerId ?? undefined,
    steps: cleanSteps(fields.steps ?? []),
    noteIds: await checkIds(ctx, canvasId, fields.noteIds ?? [], "notes"),
    itemIds: await checkIds(ctx, canvasId, fields.itemIds ?? [], "items"),
    status: "draft",
    reviewDate: fields.reviewDate?.trim() ? checkDate(fields.reviewDate.trim(), "reviewDate") : undefined,
    order: nextOrder(runbooks),
    createdBy: actor.userId,
    updatedAt: Date.now(),
  });
}

/** Notes that would block going live: anything still a guess or only tested. */
async function notReadyNotes(ctx: QueryCtx, noteIds: Id<"notes">[]) {
  const blocking: Doc<"notes">[] = [];
  for (const id of noteIds) {
    const note = await ctx.db.get(id);
    if (note && stageRank(stageOf(note)) < stageRank("repeatable")) blocking.push(note);
  }
  return blocking;
}

function dontScaleAGuess(notes: Doc<"notes">[]) {
  const list = notes
    .slice(0, 3)
    .map((n) => `"${n.content.slice(0, 60)}" (${STAGE_LABELS[stageOf(n)].toLowerCase()})`)
    .join(", ");
  return new ConvexError(
    `Don't scale a guess: mark these notes repeatable before the runbook goes live: ${list}${notes.length > 3 ? " and more" : ""}`
  );
}

export async function updateRunbook(ctx: MutationCtx, actor: Actor, runbook: Doc<"runbooks">, fields: RunbookFields) {
  const patch: Partial<Doc<"runbooks">> = { updatedAt: Date.now() };
  if (fields.title !== undefined) patch.title = title(fields.title, "Runbook");
  if (fields.trigger !== undefined) patch.trigger = optional(fields.trigger, "Trigger");
  if (fields.ownerId !== undefined) {
    await checkOwner(ctx, runbook.canvasId, fields.ownerId);
    patch.ownerId = fields.ownerId ?? undefined;
  }
  if (fields.steps !== undefined) patch.steps = cleanSteps(fields.steps);
  if (fields.itemIds !== undefined) patch.itemIds = await checkIds(ctx, runbook.canvasId, fields.itemIds, "items");
  if (fields.sopId !== undefined) {
    await checkSop(ctx, runbook.canvasId, fields.sopId);
    patch.sopId = fields.sopId ?? undefined;
  }
  if (fields.reviewDate !== undefined) {
    patch.reviewDate = fields.reviewDate?.trim() ? checkDate(fields.reviewDate.trim(), "reviewDate") : undefined;
  }
  let dropped: Id<"notes">[] = [];
  if (fields.noteIds !== undefined) {
    const noteIds = await checkIds(ctx, runbook.canvasId, fields.noteIds, "notes");
    if (runbook.status === "live") {
      const blocking = await notReadyNotes(ctx, noteIds.filter((id) => !runbook.noteIds.includes(id)));
      if (blocking.length) throw dontScaleAGuess(blocking);
    }
    dropped = runbook.noteIds.filter((id) => !noteIds.includes(id));
    patch.noteIds = noteIds;
  }
  await ctx.db.patch(runbook._id, patch);
  if (runbook.status === "live") {
    for (const id of patch.noteIds ?? []) {
      const note = await ctx.db.get(id);
      if (note) await setNoteStage(ctx, actor, note, "codified", `Codified by the runbook "${patch.title ?? runbook.title}"`);
    }
  }
  await settleNotes(ctx, actor, dropped);
}

/** Draft -> live -> retired (and back). Going live codifies its notes; leaving live un-codifies them. */
export async function setRunbookStatus(ctx: MutationCtx, actor: Actor, runbook: Doc<"runbooks">, status: RunbookStatus) {
  if (status === runbook.status) return;
  if (status === "live") {
    if (runbook.steps.length === 0) throw new ConvexError("Add the steps before the runbook goes live");
    const blocking = await notReadyNotes(ctx, runbook.noteIds);
    if (blocking.length) throw dontScaleAGuess(blocking);
  }
  await ctx.db.patch(runbook._id, { status, updatedAt: Date.now() });
  if (status === "live") {
    for (const id of runbook.noteIds) {
      const note = await ctx.db.get(id);
      if (note) await setNoteStage(ctx, actor, note, "codified", `Codified by the runbook "${runbook.title}"`);
    }
  } else if (runbook.status === "live") {
    await settleNotes(ctx, actor, runbook.noteIds);
  }
}

/** Deletes a runbook and its run log. */
export async function deleteRunbook(ctx: MutationCtx, actor: Actor, runbook: Doc<"runbooks">) {
  const runs = await ctx.db
    .query("runbookRuns")
    .withIndex("by_runbook", (q) => q.eq("runbookId", runbook._id))
    .collect();
  for (const r of runs) await ctx.db.delete(r._id);
  await ctx.db.delete(runbook._id);
  if (runbook.status === "live") await settleNotes(ctx, actor, runbook.noteIds);
}

/** A draft runbook made from a canvas note: its words become the title, the note stays linked. */
export async function runbookFromNote(ctx: MutationCtx, actor: Actor, note: Doc<"notes">) {
  return await createRunbook(ctx, actor, note.canvasId, {
    title: note.content.trim().slice(0, MAX_TITLE) || "Untitled runbook",
    ownerId: note.ownerId,
    noteIds: [note._id],
  });
}

/** A draft runbook made from a decided goal item: the decision is what it rests on. */
export async function runbookFromItem(ctx: MutationCtx, actor: Actor, item: Doc<"items">) {
  if (item.state !== "decided" && item.state !== "done") {
    throw new ConvexError("Decide the item before writing its runbook");
  }
  const record = await currentRecord(ctx, item._id);
  return await createRunbook(ctx, actor, item.canvasId, {
    title: (record?.text ?? item.title).slice(0, MAX_TITLE),
    ownerId: item.ownerId,
    itemIds: [item._id],
    noteIds: item.contextNoteIds ?? [],
  });
}

// ---------- Runs ----------

export type RunArgs = { outcome: RunOutcome; failedStep?: number; numbers?: string; note?: string };

/** Logs one use of a live runbook. */
export async function logRun(ctx: MutationCtx, actor: Actor, runbook: Doc<"runbooks">, args: RunArgs) {
  if (runbook.status !== "live") throw new ConvexError("Only a live runbook can be run. Make it live first.");
  if (args.failedStep !== undefined) {
    if (args.outcome === "yes") throw new ConvexError("A run that worked has no failed step");
    if (!Number.isInteger(args.failedStep) || args.failedStep < 1 || args.failedStep > runbook.steps.length) {
      throw new ConvexError(`failedStep must be a step number from 1 to ${runbook.steps.length}`);
    }
  }
  return await ctx.db.insert("runbookRuns", {
    canvasId: runbook.canvasId,
    runbookId: runbook._id,
    outcome: args.outcome,
    failedStep: args.failedStep,
    numbers: optional(args.numbers, "Numbers"),
    note: optional(args.note, "Note"),
    ranBy: actor.userId,
    via: actor.via,
    clientName: actor.clientName,
    at: Date.now(),
  });
}

// ---------- Reading ----------

/**
 * Everything the runbooks view needs: how runnable each canvas box is, SOPs with their runbooks
 * (linked notes, linked decisions, run stats, recent runs), and what needs attention.
 */
export async function buildRunbooksView(ctx: QueryCtx, canvas: Doc<"canvases">) {
  const today = todayUtc();
  const [sops, runbooks, runs, notes, items, members] = await Promise.all([
    ctx.db
      .query("sops")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
      .collect(),
    canvasRunbooks(ctx, canvas._id),
    ctx.db
      .query("runbookRuns")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
      .collect(),
    ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
      .collect(),
    ctx.db
      .query("items")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
      .collect(),
    listCanvasMembers(ctx, canvas),
  ]);
  const nameOf = (id: Id<"users"> | undefined) =>
    id ? (members.find((m) => m.userId === id)?.name ?? "Former member") : undefined;
  const noteById = new Map(notes.map((n) => [n._id as string, n]));
  const itemById = new Map(items.map((i) => [i._id as string, i]));

  const runbookView = async (r: Doc<"runbooks">) => {
    const own = runs.filter((x) => x.runbookId === r._id).sort((a, b) => b.at - a.at);
    const stats = runStats(own);
    const linkedItems = [];
    for (const id of r.itemIds) {
      const item = itemById.get(id);
      if (!item) continue;
      const record = await currentRecord(ctx, item._id);
      linkedItems.push({ itemId: item._id, title: item.title, state: item.state, decision: record?.text });
    }
    return {
      runbookId: r._id,
      sopId: r.sopId ?? null,
      title: r.title,
      trigger: r.trigger,
      ownerId: r.ownerId,
      owner: nameOf(r.ownerId),
      steps: r.steps,
      status: r.status,
      reviewDate: r.reviewDate,
      reviewDue: r.status === "live" && !!r.reviewDate && r.reviewDate <= today,
      notes: r.noteIds
        .filter((id) => noteById.has(id))
        .map((id) => {
          const n = noteById.get(id)!;
          return { noteId: n._id, text: n.content, block: n.block, stage: stageOf(n) };
        }),
      items: linkedItems,
      stats,
      recentRuns: own.slice(0, 10).map((x) => ({
        runId: x._id,
        outcome: x.outcome,
        failedStep: x.failedStep,
        numbers: x.numbers,
        note: x.note,
        ranBy: nameOf(x.ranBy),
        via: x.via,
        clientName: x.clientName,
        at: x.at,
      })),
    };
  };

  const views = await Promise.all([...runbooks].sort((a, b) => a.order - b.order).map(runbookView));

  // How runnable each box is: its least runnable note
  const blocks = new Map<string, Doc<"notes">[]>();
  for (const n of notes) blocks.set(n.block, [...(blocks.get(n.block) ?? []), n]);
  const blockStages = [...blocks.entries()].map(([block, ns]) => ({
    block,
    stage: blockStage(ns)!,
    notes: ns.length,
    codified: ns.filter((n) => stageOf(n) === "codified").length,
  }));

  return {
    canvasId: canvas._id,
    template: canvas.template ?? "lean",
    today,
    blockStages,
    noteStages: notes.map((n) => ({ noteId: n._id, block: n.block, text: n.content, stage: stageOf(n) })),
    sops: [...sops]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ sopId: s._id, title: s.title, description: s.description })),
    runbooks: views,
    attention: views.filter((r) => r.status === "live" && (r.stats.keepsFailingAt !== null || r.reviewDue)),
  };
}

export type RunbooksView = Awaited<ReturnType<typeof buildRunbooksView>>;
