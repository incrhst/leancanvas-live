import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { daysBetween } from "./testFields";
import { diffFields, NoteChange, trackedFields } from "./history";
import { displayName } from "./members";

type SnapshotNote = Omit<Doc<"snapshotNotes">, "_id" | "_creationTime" | "snapshotId">;

function snapshotNoteOf(note: Doc<"notes">): SnapshotNote {
  return {
    noteId: note._id,
    block: note.block,
    content: note.content,
    order: note.order,
    evidenceState: note.evidenceState,
    measure: note.measure,
    passMark: note.passMark,
    reviewDate: note.reviewDate,
    latestResult: note.latestResult,
    ownerId: note.ownerId,
    markets: note.markets,
    decisionStatus: note.decision?.status,
  };
}

/** What a comparison looks at: everything history tracks, plus where a decision request stands. */
function comparedFields(note: SnapshotNote) {
  return { ...trackedFields(note), "decision.status": note.decisionStatus };
}

async function currentNotes(ctx: QueryCtx, canvasId: Id<"canvases">) {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvasId))
    .collect();
  return notes.map(snapshotNoteOf);
}

/** Freezes the canvas's notes under a label. Caller must have verified editor access. */
export async function createSnapshotForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  canvas: Doc<"canvases">,
  rawLabel: string
) {
  const label = rawLabel.trim();
  if (!label) throw new ConvexError("Give the snapshot a label, e.g. Day 30");
  if (label.length > 80) throw new ConvexError("Keep the label under 80 characters");

  const notes = await currentNotes(ctx, canvas._id);
  const now = Date.now();
  const snapshotId = await ctx.db.insert("canvasSnapshots", {
    canvasId: canvas._id,
    label,
    takenBy: userId,
    takenAt: now,
    noteCount: notes.length,
  });
  for (const note of notes) {
    await ctx.db.insert("snapshotNotes", { snapshotId, ...note });
  }
  await ctx.db.insert("activity", {
    canvasId: canvas._id,
    userId,
    type: "snapshot_taken",
    message: `took a snapshot: ${label}`,
    createdAt: now,
  });
  return snapshotId;
}

export async function deleteSnapshotRows(ctx: MutationCtx, snapshotId: Id<"canvasSnapshots">) {
  const rows = await ctx.db
    .query("snapshotNotes")
    .withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshotId))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
  await ctx.db.delete(snapshotId);
}

/** A canvas's snapshots, newest first. `day` is the plan day it was taken on, when there's a launch date. */
export async function listSnapshots(ctx: QueryCtx, canvas: Doc<"canvases">) {
  const snapshots = await ctx.db
    .query("canvasSnapshots")
    .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
    .order("desc")
    .collect();
  return await Promise.all(
    snapshots.map(async (s) => ({
      snapshotId: s._id,
      label: s.label,
      takenAt: s.takenAt,
      takenBy: displayName(await ctx.db.get(s.takenBy)),
      noteCount: s.noteCount,
      day: canvas.launchDate
        ? daysBetween(canvas.launchDate, new Date(s.takenAt).toISOString().slice(0, 10))
        : undefined,
    }))
  );
}

async function loadSide(ctx: QueryCtx, canvas: Doc<"canvases">, side: Id<"canvasSnapshots"> | "current") {
  if (side === "current") {
    return { label: "Now", takenAt: Date.now(), notes: await currentNotes(ctx, canvas._id) };
  }
  const snapshot = await ctx.db.get(side);
  if (!snapshot || snapshot.canvasId !== canvas._id) throw new ConvexError("Snapshot not found on this canvas");
  const notes = await ctx.db
    .query("snapshotNotes")
    .withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshot._id))
    .collect();
  return { label: snapshot.label, takenAt: snapshot.takenAt, notes: notes as SnapshotNote[] };
}

/**
 * What was added, removed, or changed between two snapshots (or a snapshot and now).
 * Notes are matched by id, so a note that was deleted and re-added counts as removed plus added.
 */
export async function compareSnapshots(
  ctx: QueryCtx,
  canvas: Doc<"canvases">,
  fromId: Id<"canvasSnapshots"> | "current",
  toId: Id<"canvasSnapshots"> | "current"
) {
  const [from, to] = await Promise.all([loadSide(ctx, canvas, fromId), loadSide(ctx, canvas, toId)]);
  const before = new Map(from.notes.map((n) => [n.noteId, n]));
  const after = new Map(to.notes.map((n) => [n.noteId, n]));

  const names = new Map<string, string>();
  const nameOf = async (userId: string) => {
    if (!names.has(userId)) {
      const id = ctx.db.normalizeId("users", userId);
      names.set(userId, displayName(id ? await ctx.db.get(id) : null));
    }
    return names.get(userId)!;
  };
  const readable = async (changes: NoteChange[]) =>
    await Promise.all(
      changes.map(async (c) =>
        c.field === "ownerId"
          ? {
              field: "owner",
              from: c.from === undefined ? undefined : await nameOf(c.from),
              to: c.to === undefined ? undefined : await nameOf(c.to),
            }
          : c
      )
    );
  const summary = (n: SnapshotNote) => ({
    noteId: n.noteId,
    block: n.block,
    text: n.content,
    evidenceState: n.evidenceState,
  });
  const byPosition = (a: SnapshotNote, b: SnapshotNote) => a.block.localeCompare(b.block) || a.order - b.order;

  const changed = [];
  for (const note of [...after.values()].sort(byPosition)) {
    const old = before.get(note.noteId);
    if (!old) continue;
    const changes = diffFields(comparedFields(old), comparedFields(note));
    if (changes.length > 0) changed.push({ ...summary(note), changes: await readable(changes) });
  }

  return {
    from: { label: from.label, takenAt: from.takenAt },
    to: { label: to.label, takenAt: to.takenAt },
    added: [...after.values()].filter((n) => !before.has(n.noteId)).sort(byPosition).map(summary),
    removed: [...before.values()].filter((n) => !after.has(n.noteId)).sort(byPosition).map(summary),
    changed,
  };
}
