import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

/** Who made a change, and through which surface. */
export type Actor = {
  userId: Id<"users">;
  via: Doc<"noteHistory">["via"];
  clientName?: string;
};

export type NoteChange = Doc<"noteHistory">["changes"][number];

// Edits by the same person within this window fold into one row, so clicking through
// evidence states or retyping a note doesn't bury the history in steps.
const COALESCE_WINDOW_MS = 2 * 60 * 1000;

/** The fields a note's history tracks, as strings. */
export function trackedFields(
  note: Pick<Doc<"notes">, "content" | "block" | "evidenceState" | "measure" | "passMark" | "reviewDate" | "latestResult">
) {
  return {
    content: note.content,
    block: note.block,
    evidenceState: note.evidenceState,
    measure: note.measure,
    passMark: note.passMark,
    reviewDate: note.reviewDate,
    "latestResult.text": note.latestResult?.text,
    "latestResult.date": note.latestResult?.date,
    "latestResult.verdict": note.latestResult?.verdict,
  } as Record<string, string | undefined>;
}

/** Field-by-field changes between two versions of a note's tracked fields. */
export function diffFields(
  before: Record<string, string | undefined>,
  after: Record<string, string | undefined>
): NoteChange[] {
  const changes: NoteChange[] = [];
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[field] !== after[field]) {
      changes.push({ field, from: before[field], to: after[field] });
    }
  }
  return changes;
}

export async function recordNoteHistory(
  ctx: MutationCtx,
  actor: Actor,
  note: { _id: Id<"notes">; canvasId: Id<"canvases"> },
  kind: Doc<"noteHistory">["kind"],
  changes: NoteChange[],
  opts: { reason?: string; link?: string } = {}
) {
  const now = Date.now();
  const reason = opts.reason?.trim() || undefined;
  const link = opts.link?.trim() || undefined;

  if (kind === "updated") {
    if (changes.length === 0) return;

    const last = await ctx.db
      .query("noteHistory")
      .withIndex("by_note", (q) => q.eq("noteId", note._id))
      .order("desc")
      .first();
    const canFold =
      last &&
      last.kind === "updated" &&
      last.userId === actor.userId &&
      last.via === actor.via &&
      !last.reason &&
      !last.link &&
      !reason &&
      !link &&
      now - last.at < COALESCE_WINDOW_MS;

    if (last && canFold) {
      // Keep each field's original `from`, take the newest `to`, and drop fields that ended where they started
      const merged = [...last.changes];
      for (const change of changes) {
        const existing = merged.find((c) => c.field === change.field);
        if (existing) existing.to = change.to;
        else merged.push(change);
      }
      const net = merged.filter((c) => c.from !== c.to);
      if (net.length === 0) await ctx.db.delete(last._id);
      else await ctx.db.patch(last._id, { changes: net, at: now });
      return;
    }
  }

  await ctx.db.insert("noteHistory", {
    canvasId: note.canvasId,
    noteId: note._id,
    userId: actor.userId,
    via: actor.via,
    clientName: actor.clientName,
    kind,
    changes,
    reason,
    link,
    at: now,
  });
}

/** A note's history, newest first, with each author's display name. */
export async function listNoteHistory(ctx: QueryCtx, noteId: Id<"notes">) {
  const rows = await ctx.db
    .query("noteHistory")
    .withIndex("by_note", (q) => q.eq("noteId", noteId))
    .order("desc")
    .collect();

  const names = new Map<Id<"users">, string>();
  for (const row of rows) {
    if (names.has(row.userId)) continue;
    const user = await ctx.db.get(row.userId);
    names.set(row.userId, user?.name || user?.email || "Unknown user");
  }

  return rows.map((row) => ({ ...row, userName: names.get(row.userId)! }));
}
