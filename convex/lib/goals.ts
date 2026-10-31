import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { Actor } from "./history";
import { listCanvasMembers } from "./members";
import { listPeople } from "./people";
import { addDays, checkDate, TestFieldsUpdate, testFieldsPatch, todayUtc } from "./testFields";
import {
  countItems,
  DecisionBasis,
  DEFAULT_REVIEW_DAYS,
  headline,
  isGoalReached,
  ItemState,
  LookBack,
  MAX_CONTEXT_NOTES,
  undecidedState,
} from "./goalModel";

/**
 * Goals, items and decision records: the model a canvas now revolves around. Each function takes
 * an actor and checks nothing about access; callers (goals.ts for the app, mcp.ts for agents) do.
 */

const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 2000;

function cleanText(value: string, label: string, max = MAX_TITLE_LENGTH) {
  const text = value.trim();
  if (!text) throw new ConvexError(`${label} cannot be empty`);
  if (text.length > max) throw new ConvexError(`${label} is too long (at most ${max} characters)`);
  return text;
}

function optionalText(value: string | null | undefined, label: string) {
  if (value === undefined) return undefined;
  const text = value?.trim();
  if (text && text.length > MAX_TEXT_LENGTH) {
    throw new ConvexError(`${label} is too long (at most ${MAX_TEXT_LENGTH} characters)`);
  }
  return text || undefined;
}

function nextOrder(rows: { order: number }[]) {
  return rows.reduce((max, r) => Math.max(max, r.order), -1) + 1;
}

/** Notes that belong to this canvas, deduplicated; throws on any other id. */
async function checkCanvasNotes(ctx: QueryCtx, canvasId: Id<"canvases">, noteIds: Id<"notes">[]) {
  const unique = [...new Set(noteIds)];
  if (unique.length > MAX_CONTEXT_NOTES) {
    throw new ConvexError(`At most ${MAX_CONTEXT_NOTES} linked notes`);
  }
  for (const id of unique) {
    const note = await ctx.db.get(id);
    if (!note || note.canvasId !== canvasId) throw new ConvexError(`Note not found on this canvas: ${id}`);
  }
  return unique;
}

/** The record that currently resolves an item (none while it's open or testing). */
export async function currentRecord(ctx: QueryCtx, itemId: Id<"items">) {
  const records = await ctx.db
    .query("decisionRecords")
    .withIndex("by_item", (q) => q.eq("itemId", itemId))
    .order("desc")
    .collect();
  return records.find((r) => !r.supersededAt) ?? null;
}

// ---------- Goals ----------

export async function createGoal(ctx: MutationCtx, actor: Actor, canvasId: Id<"canvases">, title: string) {
  const goals = await ctx.db
    .query("goals")
    .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
    .collect();
  return await ctx.db.insert("goals", {
    canvasId,
    title: cleanText(title, "Goal"),
    order: nextOrder(goals),
    createdBy: actor.userId,
    updatedAt: Date.now(),
  });
}

export async function renameGoal(ctx: MutationCtx, goal: Doc<"goals">, title: string) {
  await ctx.db.patch(goal._id, { title: cleanText(title, "Goal"), updatedAt: Date.now() });
}

/** Deletes an empty goal. A goal with items keeps them safe: move or delete them first. */
export async function deleteGoal(ctx: MutationCtx, goal: Doc<"goals">) {
  const item = await ctx.db
    .query("items")
    .withIndex("by_goal", (q) => q.eq("goalId", goal._id))
    .first();
  if (item) throw new ConvexError("This goal still has items. Move or delete them first.");
  await ctx.db.delete(goal._id);
}

// ---------- Items ----------

export type ItemFields = TestFieldsUpdate & {
  title?: string;
  detail?: string | null;
  ownerId?: Id<"users"> | null;
  contextNoteIds?: Id<"notes">[];
};

async function checkOwner(ctx: QueryCtx, canvasId: Id<"canvases">, ownerId: Id<"users"> | null | undefined) {
  if (!ownerId) return;
  const canvas = (await ctx.db.get(canvasId))!;
  const members = await listCanvasMembers(ctx, canvas);
  if (!members.some((m) => m.userId === ownerId)) throw new ConvexError("The driver must be a canvas member");
}

export async function createItem(ctx: MutationCtx, actor: Actor, goal: Doc<"goals">, fields: ItemFields) {
  const test = testFieldsPatch(fields);
  await checkOwner(ctx, goal.canvasId, fields.ownerId);
  const items = await ctx.db
    .query("items")
    .withIndex("by_goal", (q) => q.eq("goalId", goal._id))
    .collect();
  return await ctx.db.insert("items", {
    canvasId: goal.canvasId,
    goalId: goal._id,
    title: cleanText(fields.title ?? "", "Item"),
    detail: optionalText(fields.detail, "Detail"),
    state: undecidedState(test),
    order: nextOrder(items),
    ownerId: fields.ownerId ?? undefined,
    ...test,
    contextNoteIds: fields.contextNoteIds?.length
      ? await checkCanvasNotes(ctx, goal.canvasId, fields.contextNoteIds)
      : undefined,
    createdBy: actor.userId,
    updatedAt: Date.now(),
  });
}

/**
 * Changes an item's words, driver, test or linked notes, or moves it to another goal on the same
 * canvas. An undecided item follows its test: adding one makes it Testing, clearing it makes it Open.
 */
export async function updateItem(
  ctx: MutationCtx,
  item: Doc<"items">,
  fields: ItemFields & { goalId?: Id<"goals"> }
) {
  const patch: Partial<Doc<"items">> = { ...testFieldsPatch(fields), updatedAt: Date.now() };
  if (fields.title !== undefined) patch.title = cleanText(fields.title, "Item");
  if (fields.detail !== undefined) patch.detail = optionalText(fields.detail, "Detail");
  if (fields.ownerId !== undefined) {
    await checkOwner(ctx, item.canvasId, fields.ownerId);
    patch.ownerId = fields.ownerId ?? undefined;
  }
  if (fields.contextNoteIds !== undefined) {
    const ids = await checkCanvasNotes(ctx, item.canvasId, fields.contextNoteIds);
    patch.contextNoteIds = ids.length ? ids : undefined;
  }
  if (fields.goalId !== undefined && fields.goalId !== item.goalId) {
    const goal = await ctx.db.get(fields.goalId);
    if (!goal || goal.canvasId !== item.canvasId) throw new ConvexError("Goal not found on this canvas");
    patch.goalId = goal._id;
    const records = await ctx.db
      .query("decisionRecords")
      .withIndex("by_item", (q) => q.eq("itemId", item._id))
      .collect();
    for (const r of records) await ctx.db.patch(r._id, { goalId: goal._id });
  }
  const next = { ...item, ...patch };
  if (item.state === "open" || item.state === "testing") patch.state = undecidedState(next);
  await ctx.db.patch(item._id, patch);
}

/** Deletes an item and its decision records. The canvas notes it linked to stay. */
export async function deleteItem(ctx: MutationCtx, item: Doc<"items">) {
  const records = await ctx.db
    .query("decisionRecords")
    .withIndex("by_item", (q) => q.eq("itemId", item._id))
    .collect();
  for (const r of records) await ctx.db.delete(r._id);
  await ctx.db.delete(item._id);
}

// ---------- Decisions ----------

export type DecideArgs = {
  text: string;
  basis: DecisionBasis;
  basisNote?: string;
  linkedNoteIds?: Id<"notes">[];
  // Who made the call: a canvas member (default: whoever records it) or a typed name
  decidedBy?: Id<"users">;
  decidedByName?: string;
  // When to look back; default DEFAULT_REVIEW_DAYS from today
  reviewDate?: string;
};

/** Makes the call on an open or testing item: writes its decision record and moves it to Decided. */
export async function decideItem(ctx: MutationCtx, actor: Actor, item: Doc<"items">, args: DecideArgs) {
  if (item.state === "decided" || item.state === "done") {
    throw new ConvexError("This item is already decided. Reopen it to make a new call.");
  }
  if (args.basis === "test" && !item.latestResult) {
    throw new ConvexError("A decision based on a test needs the item's test to have a result first");
  }
  const decidedByName = args.decidedByName?.trim() || undefined;
  if (args.decidedBy && decidedByName) throw new ConvexError("Pass decidedBy or decidedByName, not both");
  await checkOwner(ctx, item.canvasId, args.decidedBy);
  const reviewDate = args.reviewDate?.trim()
    ? checkDate(args.reviewDate.trim(), "reviewDate")
    : addDays(todayUtc(), DEFAULT_REVIEW_DAYS);

  const recordId = await ctx.db.insert("decisionRecords", {
    canvasId: item.canvasId,
    goalId: item.goalId,
    itemId: item._id,
    text: cleanText(args.text, "Decision", MAX_TEXT_LENGTH),
    basis: args.basis,
    basisNote: optionalText(args.basisNote, "Basis note"),
    linkedNoteIds: args.linkedNoteIds?.length
      ? await checkCanvasNotes(ctx, item.canvasId, args.linkedNoteIds)
      : undefined,
    testSnapshot:
      item.measure || item.passMark || item.latestResult
        ? {
            measure: item.measure,
            passMark: item.passMark,
            resultText: item.latestResult?.text,
            verdict: item.latestResult?.verdict,
          }
        : undefined,
    decidedBy: decidedByName ? undefined : (args.decidedBy ?? actor.userId),
    decidedByName,
    decidedAt: Date.now(),
    recordedBy: actor.userId,
    via: actor.via,
    clientName: actor.clientName,
    reviewDate,
  });
  await ctx.db.patch(item._id, { state: "decided", updatedAt: Date.now() });
  return recordId;
}

/** The call has been acted on. */
export async function markItemDone(ctx: MutationCtx, item: Doc<"items">) {
  if (item.state !== "decided") throw new ConvexError("Only a decided item can be marked done");
  await ctx.db.patch(item._id, { state: "done", updatedAt: Date.now() });
}

/**
 * Takes a decided or done item back to Open (or Testing, if it has a test). Its decision record
 * stays, marked superseded, so the trail is kept.
 */
export async function reopenItem(ctx: MutationCtx, item: Doc<"items">) {
  if (item.state !== "decided" && item.state !== "done") throw new ConvexError("This item isn't decided yet");
  const record = await currentRecord(ctx, item._id);
  if (record) await ctx.db.patch(record._id, { supersededAt: Date.now() });
  await ctx.db.patch(item._id, { state: undecidedState(item), updatedAt: Date.now() });
}

/** Did it pan out? Answered on a done item's decision, usually once its review date comes. */
export async function recordLookBack(
  ctx: MutationCtx,
  actor: Actor,
  item: Doc<"items">,
  args: { outcome: LookBack; note?: string }
) {
  if (item.state !== "done") throw new ConvexError("Look back once the item is done");
  const record = await currentRecord(ctx, item._id);
  if (!record) throw new ConvexError("This item has no decision record");
  await ctx.db.patch(record._id, {
    outcome: args.outcome,
    outcomeNote: optionalText(args.note, "Note"),
    outcomeAt: Date.now(),
    outcomeBy: actor.userId,
  });
}

// ---------- Converting notes ----------

/**
 * Turns a canvas note into an item under a goal. Its test and driver carry over, the note stays
 * linked as context, and an answered decision request becomes the item's decision record.
 * An open request stays on the note, where it can still be answered.
 */
export async function convertNoteToItem(ctx: MutationCtx, actor: Actor, note: Doc<"notes">, goal: Doc<"goals">) {
  if (goal.canvasId !== note.canvasId) throw new ConvexError("Goal not found on this canvas");
  const existing = await ctx.db
    .query("items")
    .withIndex("by_from_note", (q) => q.eq("fromNoteId", note._id))
    .first();
  if (existing) throw new ConvexError("This note is already an item");

  const items = await ctx.db
    .query("items")
    .withIndex("by_goal", (q) => q.eq("goalId", goal._id))
    .collect();
  const test = {
    measure: note.measure,
    passMark: note.passMark,
    reviewDate: note.reviewDate,
    latestResult: note.latestResult,
  };
  const itemId = await ctx.db.insert("items", {
    canvasId: note.canvasId,
    goalId: goal._id,
    title: note.content.trim().slice(0, MAX_TITLE_LENGTH) || "Untitled",
    state: undecidedState(test),
    order: nextOrder(items),
    ownerId: note.ownerId,
    ...test,
    contextNoteIds: [note._id],
    fromNoteId: note._id,
    createdBy: actor.userId,
    updatedAt: Date.now(),
  });

  const d = note.decision;
  const deferred = d?.status === "decided" && !!d.choice && !!d.deferOptions?.includes(d.choice);
  const answered = d && (d.status === "approved" || d.status === "rejected" || d.status === "decided") && !deferred;
  if (d && answered) {
    const text =
      d.status === "decided" ? `${d.question} ${d.choice}` : `${d.question} ${d.status === "approved" ? "Yes" : "No"}`;
    let decidedByName: string | undefined;
    if (d.deciderPersonId) {
      const people = await listPeople(ctx, note.canvasId, { withEmail: false });
      decidedByName = people.find((p) => p.id === d.deciderPersonId)?.name ?? "Unknown person";
    }
    const today = todayUtc();
    await ctx.db.insert("decisionRecords", {
      canvasId: note.canvasId,
      goalId: goal._id,
      itemId,
      text: text.slice(0, MAX_TEXT_LENGTH),
      basis: note.latestResult ? "test" : "judgment",
      basisNote: d.comment,
      linkedNoteIds: [note._id],
      testSnapshot: note.latestResult
        ? {
            measure: note.measure,
            passMark: note.passMark,
            resultText: note.latestResult.text,
            verdict: note.latestResult.verdict,
          }
        : undefined,
      decidedBy: d.deciderId,
      decidedByName,
      decidedAt: d.answeredAt ?? Date.now(),
      recordedBy: actor.userId,
      via: actor.via,
      clientName: actor.clientName,
      reviewDate: note.reviewDate && note.reviewDate > today ? note.reviewDate : addDays(today, DEFAULT_REVIEW_DAYS),
      fromNoteId: note._id,
    });
    await ctx.db.patch(itemId, { state: "decided" });
  }
  return itemId;
}

// ---------- Reading ----------

/**
 * Everything the goals view needs: each goal with its headline counts and items (each with its
 * current decision), the look-backs that are due, and how often each kind of basis panned out.
 * Shared by the app (members and public links) and the MCP list_goals tool.
 */
export async function buildGoalsView(ctx: QueryCtx, canvas: Doc<"canvases">) {
  const today = todayUtc();
  const [goals, items, records, members, notes] = await Promise.all([
    ctx.db
      .query("goals")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
      .collect(),
    ctx.db
      .query("items")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
      .collect(),
    ctx.db
      .query("decisionRecords")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
      .collect(),
    listCanvasMembers(ctx, canvas),
    ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
      .collect(),
  ]);
  const nameOf = (id: Id<"users"> | undefined) =>
    id ? (members.find((m) => m.userId === id)?.name ?? "Former member") : undefined;
  const noteText = new Map(notes.map((n) => [n._id as string, n.content]));
  const notesFor = (ids: Id<"notes">[] | undefined) =>
    (ids ?? []).filter((id) => noteText.has(id)).map((id) => ({ noteId: id, text: noteText.get(id)! }));

  const recordView = (r: Doc<"decisionRecords">) => ({
    recordId: r._id,
    text: r.text,
    basis: r.basis,
    basisNote: r.basisNote,
    linkedNotes: notesFor(r.linkedNoteIds),
    testSnapshot: r.testSnapshot,
    decidedBy: r.decidedByName ?? nameOf(r.decidedBy) ?? "Unknown",
    decidedAt: r.decidedAt,
    via: r.via,
    clientName: r.clientName,
    reviewDate: r.reviewDate,
    outcome: r.outcome,
    outcomeNote: r.outcomeNote,
    outcomeAt: r.outcomeAt,
    outcomeBy: nameOf(r.outcomeBy),
  });

  const currentByItem = new Map<string, Doc<"decisionRecords">>();
  const pastByItem = new Map<string, Doc<"decisionRecords">[]>();
  for (const r of records) {
    if (!r.supersededAt) currentByItem.set(r.itemId, r);
    else pastByItem.set(r.itemId, [...(pastByItem.get(r.itemId) ?? []), r]);
  }

  const itemView = (i: Doc<"items">) => {
    const current = currentByItem.get(i._id);
    return {
      itemId: i._id,
      goalId: i.goalId,
      title: i.title,
      detail: i.detail,
      state: i.state as ItemState,
      order: i.order,
      ownerId: i.ownerId,
      driver: nameOf(i.ownerId),
      measure: i.measure,
      passMark: i.passMark,
      reviewDate: i.reviewDate,
      latestResult: i.latestResult,
      contextNotes: notesFor(i.contextNoteIds),
      fromNoteId: i.fromNoteId,
      decision: current ? recordView(current) : null,
      earlierDecisions: (pastByItem.get(i._id) ?? []).sort((a, b) => b.decidedAt - a.decidedAt).map(recordView),
      lookBackDue: i.state === "done" && !!current && !current.outcome && current.reviewDate <= today,
    };
  };

  const sortedGoals = [...goals].sort((a, b) => a.order - b.order);
  const goalViews = sortedGoals.map((g) => {
    const goalItems = items.filter((i) => i.goalId === g._id).sort((a, b) => a.order - b.order);
    const counts = countItems(goalItems);
    return {
      goalId: g._id,
      title: g.title,
      counts,
      headline: headline(g.title, counts),
      reached: isGoalReached(counts),
      items: goalItems.map(itemView),
    };
  });

  // How often each kind of basis panned out, over every look-back answered (superseded ones too)
  const basisStats: Record<string, { yes: number; no: number; partly: number }> = {};
  for (const r of records) {
    if (!r.outcome) continue;
    basisStats[r.basis] ??= { yes: 0, no: 0, partly: 0 };
    basisStats[r.basis][r.outcome]++;
  }

  const convertedNoteIds = items.filter((i) => i.fromNoteId).map((i) => i.fromNoteId!);

  return {
    canvasId: canvas._id,
    today,
    goals: goalViews,
    lookBacksDue: goalViews.flatMap((g) =>
      g.items.filter((i) => i.lookBackDue).map((i) => ({ goal: g.title, ...i }))
    ),
    basisStats,
    convertedNoteIds,
  };
}

export type GoalsView = Awaited<ReturnType<typeof buildGoalsView>>;
