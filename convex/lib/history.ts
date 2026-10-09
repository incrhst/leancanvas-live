import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { displayName } from "./members";
import { marketsLabel } from "./markets";

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
  note: Pick<
    Doc<"notes">,
    | "content"
    | "block"
    | "evidenceState"
    | "measure"
    | "passMark"
    | "reviewDate"
    | "latestResult"
    | "ownerId"
    | "markets"
  >
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
    ownerId: note.ownerId,
    markets: marketsLabel(note.markets),
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

// How long after a change its author can still add a reason to it
const ANNOTATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Adds a reason to the actor's most recent change to a note, so a change made with one click
 * can still be explained. Fails if someone else has changed the note since.
 */
export async function annotateLatestChange(
  ctx: MutationCtx,
  actor: Actor,
  noteId: Id<"notes">,
  reason: string
) {
  const last = await ctx.db
    .query("noteHistory")
    .withIndex("by_note", (q) => q.eq("noteId", noteId))
    .order("desc")
    .first();
  if (!last || last.userId !== actor.userId || last.kind === "deleted" || Date.now() - last.at > ANNOTATE_WINDOW_MS) {
    throw new Error("There's no recent change of yours on this note to add a reason to.");
  }
  await ctx.db.patch(last._id, { reason: reason.trim() || undefined });
}

/**
 * A note's history, newest first, with each author's display name. Owner changes are stored
 * as user ids and returned as names.
 */
export async function listNoteHistory(ctx: QueryCtx, noteId: Id<"notes">) {
  const rows = await ctx.db
    .query("noteHistory")
    .withIndex("by_note", (q) => q.eq("noteId", noteId))
    .order("desc")
    .collect();

  const names = new Map<string, string>();
  const nameOf = async (userId: string) => {
    if (!names.has(userId)) {
      const id = ctx.db.normalizeId("users", userId);
      names.set(userId, displayName(id ? await ctx.db.get(id) : null));
    }
    return names.get(userId)!;
  };

  return await Promise.all(
    rows.map(async (row) => ({
      ...row,
      userName: await nameOf(row.userId),
      changes: await Promise.all(
        row.changes.map(async (c) =>
          c.field === "ownerId" || c.field === "decision.deciderId"
            ? {
                field: c.field === "ownerId" ? "owner" : "decision.decider",
                from: c.from === undefined ? undefined : await nameOf(c.from),
                to: c.to === undefined ? undefined : await nameOf(c.to),
              }
            : c
        )
      ),
    }))
  );
}
