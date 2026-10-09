import { ConvexError, Infer, v } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getCanvasRole } from "./auth";
import { Actor, NoteChange, recordNoteHistory } from "./history";
import { displayName } from "./members";
import { checkDate } from "./testFields";
import { emailUser, siteUrl } from "./notify";

/** A request for someone to decide on a note. Stays on the note after it's answered, as the record. */
export const decisionStatusValidator = v.union(
  v.literal("open"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("changes_requested")
);

export const decisionRequestValidator = v.object({
  question: v.string(),
  deciderId: v.id("users"),
  dueDate: v.string(),
  requestedBy: v.id("users"),
  requestedAt: v.number(),
  status: decisionStatusValidator,
  comment: v.optional(v.string()),
  answeredAt: v.optional(v.number()),
});


export const decisionAnswerValidator = v.union(v.literal("approve"), v.literal("reject"), v.literal("change"));

export type DecisionAnswer = Infer<typeof decisionAnswerValidator>;

const STATUS_FOR_ANSWER = {
  approve: "approved",
  reject: "rejected",
  change: "changes_requested",
} as const;

async function touch(ctx: MutationCtx, note: Doc<"notes">, actor: Actor, message: string) {
  const now = Date.now();
  await ctx.db.patch(note.canvasId, { updatedAt: now });
  await ctx.db.insert("activity", {
    canvasId: note.canvasId,
    userId: actor.userId,
    type: "decision",
    message,
    createdAt: now,
  });
}

/**
 * Asks one canvas member to decide on a note, and emails them a link to answer.
 * Caller must have verified editor access.
 */
export async function requestDecisionForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  args: { question: string; deciderId: Id<"users">; dueDate: string }
) {
  if (note.decision?.status === "open") {
    throw new ConvexError("This note already has an open decision request. Withdraw it first to ask again.");
  }
  const question = args.question.trim();
  if (!question) throw new ConvexError("The question can't be empty");
  const dueDate = checkDate(args.dueDate.trim(), "dueDate");
  if (!(await getCanvasRole(ctx, note.canvasId, args.deciderId))) {
    throw new ConvexError("The decider must be a member of this canvas");
  }

  const now = Date.now();
  await ctx.db.patch(note._id, {
    decision: { question, deciderId: args.deciderId, dueDate, requestedBy: actor.userId, requestedAt: now, status: "open" },
    updatedAt: now,
  });
  await recordNoteHistory(ctx, actor, note, "decision_requested", [
    { field: "decision.question", to: question },
    { field: "decision.deciderId", to: args.deciderId },
    { field: "decision.dueDate", to: dueDate },
  ]);

  const decider = await ctx.db.get(args.deciderId);
  await touch(ctx, note, actor, `asked ${displayName(decider)} for a decision`);

  if (args.deciderId !== actor.userId) {
    const canvas = await ctx.db.get(note.canvasId);
    const requester = await ctx.db.get(actor.userId);
    await emailUser(ctx, args.deciderId, {
      subject: `Decision needed by ${dueDate}: ${question}`,
      text: [
        `${displayName(requester)} has asked you to decide on a note in "${canvas?.title ?? "a canvas"}".`,
        "",
        `Question: ${question}`,
        `Note: ${note.content}`,
        `Due: ${dueDate}`,
        "",
        `Approve, reject or ask for a change here: ${siteUrl()}/decisions`,
      ].join("\n"),
    });
  }
}

/**
 * Records the decider's answer. Approving or rejecting makes the note a decision; asking for a
 * change sends it back to whoever asked, with the note unchanged. Only the named decider can
 * answer, whatever their role on the canvas (view-only included).
 */
export async function answerDecisionForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  args: { answer: DecisionAnswer; comment?: string }
) {
  const decision = note.decision;
  if (!decision || decision.status !== "open") throw new ConvexError("This note has no open decision request");
  if (decision.deciderId !== actor.userId || !(await getCanvasRole(ctx, note.canvasId, actor.userId))) {
    const decider = await ctx.db.get(decision.deciderId);
    throw new ConvexError(`Only ${displayName(decider)} can answer this decision request`);
  }
  const comment = args.comment?.trim() || undefined;
  if (args.answer === "change" && !comment) throw new ConvexError("Say what should change");

  const now = Date.now();
  const status = STATUS_FOR_ANSWER[args.answer];
  const evidenceState = args.answer === "change" ? note.evidenceState : "decision";
  await ctx.db.patch(note._id, {
    decision: { ...decision, status, comment, answeredAt: now },
    evidenceState,
    updatedAt: now,
  });

  const changes: NoteChange[] = [{ field: "decision.status", from: "open", to: status }];
  if (evidenceState !== note.evidenceState) {
    changes.push({ field: "evidenceState", from: note.evidenceState, to: evidenceState });
  }
  if (comment) changes.push({ field: "decision.comment", to: comment });
  await recordNoteHistory(ctx, actor, note, "decision_answered", changes);

  const label = { approved: "approved", rejected: "rejected", changes_requested: "asked for changes on" }[status];
  await touch(ctx, note, actor, `${label} a decision request`);

  if (decision.requestedBy !== actor.userId) {
    const canvas = await ctx.db.get(note.canvasId);
    const decider = await ctx.db.get(actor.userId);
    await emailUser(ctx, decision.requestedBy, {
      subject: `${displayName(decider)} ${label} your request: ${decision.question}`,
      text: [
        `${displayName(decider)} ${label} your decision request in "${canvas?.title ?? "a canvas"}".`,
        "",
        `Question: ${decision.question}`,
        ...(comment ? [`Comment: ${comment}`] : []),
        "",
        `Open the canvas: ${siteUrl()}/canvas/${note.canvasId}`,
      ].join("\n"),
    });
  }
}

/** Cancels an open decision request. Caller must have verified editor access. */
export async function withdrawDecisionForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  opts: { reason?: string } = {}
) {
  if (note.decision?.status !== "open") throw new ConvexError("This note has no open decision request");
  await ctx.db.patch(note._id, { decision: undefined, updatedAt: Date.now() });
  await recordNoteHistory(
    ctx,
    actor,
    note,
    "decision_withdrawn",
    [{ field: "decision.question", from: note.decision.question }],
    opts
  );
  await touch(ctx, note, actor, "withdrew a decision request");
}

/** The open decisions waiting on a user, across every canvas they can still see, soonest due first. */
export async function listOpenDecisionsFor(ctx: QueryCtx, userId: Id<"users">) {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_decider_and_status", (q) => q.eq("decision.deciderId", userId).eq("decision.status", "open"))
    .collect();

  const results = [];
  for (const note of notes) {
    const canvas = await ctx.db.get(note.canvasId);
    if (!canvas || !(await getCanvasRole(ctx, canvas._id, userId))) continue;
    const decision = note.decision!;
    results.push({
      noteId: note._id,
      canvasId: canvas._id,
      canvasTitle: canvas.title,
      block: note.block,
      noteText: note.content,
      evidenceState: note.evidenceState,
      question: decision.question,
      dueDate: decision.dueDate,
      requestedBy: displayName(await ctx.db.get(decision.requestedBy)),
      requestedAt: decision.requestedAt,
    });
  }
  return results.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
