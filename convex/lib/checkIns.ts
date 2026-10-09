import { ConvexError, Infer } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getCanvasRole } from "./auth";
import { Actor, diffFields, recordNoteHistory, trackedFields } from "./history";
import { emailUser, siteUrl } from "./notify";
import { checkDate, todayUtc, verdictValidator } from "./testFields";

/**
 * Weekly check-ins: once a week each note's owner is asked whether there's new evidence on it.
 * "Yes" plus a line becomes the note's latest result; either answer goes into its history.
 * Owners can be view-only; answering a check-in is one of the two things viewers can do.
 */

/** Monday of the week containing `date` (YYYY-MM-DD, UTC). */
export function mondayOf(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Notes worth asking about: owned, not yet a decision, and either still unproven
 * (unknown, assumption, observed) or carrying a test.
 */
export function needsCheckIn(note: Doc<"notes">) {
  if (!note.ownerId || note.evidenceState === "decision") return false;
  const unproven = note.evidenceState === "unknown" || note.evidenceState === "assumption" || note.evidenceState === "observed";
  const hasTest = !!(note.measure || note.passMark || note.reviewDate || note.latestResult);
  return unproven || hasTest;
}

/**
 * Creates this week's check-in questions for a canvas and emails each owner once.
 * Older unanswered questions about the same notes expire, so nobody has a backlog.
 */
export async function startCheckInForCanvas(ctx: MutationCtx, canvas: Doc<"canvases">, weekOf: string) {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
    .collect();

  const perOwner = new Map<Id<"users">, Doc<"notes">[]>();
  for (const note of notes.filter(needsCheckIn)) {
    const ownerId = note.ownerId!;
    if (!(await getCanvasRole(ctx, canvas._id, ownerId))) continue;

    const pending = await ctx.db
      .query("checkInItems")
      .withIndex("by_note_and_status", (q) => q.eq("noteId", note._id).eq("status", "pending"))
      .collect();
    if (pending.some((p) => p.weekOf === weekOf && p.userId === ownerId)) continue;
    for (const old of pending) await ctx.db.patch(old._id, { status: "expired" });

    await ctx.db.insert("checkInItems", {
      userId: ownerId,
      canvasId: canvas._id,
      noteId: note._id,
      weekOf,
      status: "pending",
    });
    perOwner.set(ownerId, [...(perOwner.get(ownerId) ?? []), note]);
  }

  for (const [ownerId, owned] of perOwner) {
    await emailUser(ctx, ownerId, {
      subject: `Weekly check-in: ${owned.length} ${owned.length === 1 ? "note" : "notes"} on ${canvas.title}`,
      text: [
        `Any new evidence this week on the notes you own in "${canvas.title}"?`,
        "",
        ...owned.map((n) => `- ${n.content}`),
        "",
        `Answer yes or no for each (a line if yes): ${siteUrl()}/check-in`,
      ].join("\n"),
    });
  }
  return { questions: [...perOwner.values()].reduce((sum, list) => sum + list.length, 0), owners: perOwner.size };
}

/** A user's unanswered check-in questions, skipping notes that were deleted or changed owner. */
export async function listPendingCheckIns(ctx: QueryCtx, userId: Id<"users">) {
  const items = await ctx.db
    .query("checkInItems")
    .withIndex("by_user_and_status", (q) => q.eq("userId", userId).eq("status", "pending"))
    .collect();
  const results = [];
  for (const item of items) {
    const note = await ctx.db.get(item.noteId);
    const canvas = await ctx.db.get(item.canvasId);
    if (!note || !canvas || note.ownerId !== userId) continue;
    results.push({
      noteId: note._id,
      canvasId: canvas._id,
      canvasTitle: canvas.title,
      weekOf: item.weekOf,
      block: note.block,
      text: note.content,
      evidenceState: note.evidenceState,
      measure: note.measure,
      passMark: note.passMark,
      reviewDate: note.reviewDate,
      latestResult: note.latestResult,
      markets: note.markets,
    });
  }
  return results.sort((a, b) => a.canvasTitle.localeCompare(b.canvasTitle) || a.block.localeCompare(b.block));
}

/** Records an owner's answer. "Yes" needs a line, which becomes the note's latest result. */
export async function answerCheckInForUser(
  ctx: MutationCtx,
  actor: Actor,
  noteId: Id<"notes">,
  args: { hasEvidence: boolean; text?: string; verdict?: Infer<typeof verdictValidator>; date?: string }
) {
  const note = await ctx.db.get(noteId);
  if (!note) throw new ConvexError("Note not found");
  const item = (
    await ctx.db
      .query("checkInItems")
      .withIndex("by_note_and_status", (q) => q.eq("noteId", noteId).eq("status", "pending"))
      .collect()
  ).find((i) => i.userId === actor.userId);
  if (!item || note.ownerId !== actor.userId || !(await getCanvasRole(ctx, note.canvasId, actor.userId))) {
    throw new ConvexError("There's no check-in waiting for you on this note");
  }

  const now = Date.now();
  const text = args.text?.trim();
  if (args.hasEvidence) {
    if (!text) throw new ConvexError("Add a line about the new evidence");
    const latestResult = {
      text,
      date: args.date ? checkDate(args.date, "date") : todayUtc(),
      verdict: args.verdict,
    };
    await ctx.db.patch(note._id, { latestResult, updatedAt: now });
    await ctx.db.patch(note.canvasId, { updatedAt: now });
    await recordNoteHistory(
      ctx,
      actor,
      note,
      "check_in",
      [
        { field: "checkIn", to: "new evidence" },
        ...diffFields(trackedFields(note), trackedFields({ ...note, latestResult })),
      ]
    );
  } else {
    await recordNoteHistory(ctx, actor, note, "check_in", [{ field: "checkIn", to: "no new evidence" }], {
      reason: text || undefined,
    });
  }
  await ctx.db.patch(item._id, { status: "answered", hasEvidence: args.hasEvidence, answer: text, answeredAt: now });
}
