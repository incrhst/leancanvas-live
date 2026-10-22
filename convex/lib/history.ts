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

/** A person without an account, acting from a link they were emailed. */
export type PersonActor = { personId: Id<"people">; via: "link" };

/** Anyone whose change can go in a note's history. */
export type HistoryActor = Actor | PersonActor;

export function isPersonActor(actor: HistoryActor): actor is PersonActor {
  return "personId" in actor;
}

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
  actor: HistoryActor,
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
      !isPersonActor(actor) &&
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
    ...(isPersonActor(actor)
      ? { personId: actor.personId, via: actor.via }
      : { userId: actor.userId, via: actor.via, clientName: actor.clientName }),
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
 * A note's history, newest first, with each author's display name. Driver changes are stored
 * as user ids and returned as names.
 */
export async function listNoteHistory(ctx: QueryCtx, noteId: Id<"notes">) {
  const rows = await ctx.db
    .query("noteHistory")
    .withIndex("by_note", (q) => q.eq("noteId", noteId))
    .order("desc")
    .collect();

  const names = new Map<string, string>();
  // A user id, or a person's id (people have no account; their history rows carry personId)
  const nameOf = async (id: string) => {
    if (!names.has(id)) {
      const userId = ctx.db.normalizeId("users", id);
      const personId = userId ? null : ctx.db.normalizeId("people", id);
      const person = personId ? await ctx.db.get(personId) : null;
      names.set(id, person ? person.name : displayName(userId ? await ctx.db.get(userId) : null));
    }
    return names.get(id)!;
  };

  return await Promise.all(
    rows.map(async (row) => ({
      ...row,
      userName: await nameOf(row.userId ?? row.personId ?? ""),
      changes: await Promise.all(
        row.changes.map(async (c) =>
          c.field === "ownerId" || c.field === "decision.deciderId" || c.field === "decision.deciderPersonId"
            ? {
                field: c.field === "ownerId" ? "driver" : "decision.decider",
                from: c.from === undefined ? undefined : await nameOf(c.from),
                to: c.to === undefined ? undefined : await nameOf(c.to),
              }
            : c
        )
      ),
    }))
  );
}
