import { ConvexError, Infer } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getCanvasRole, sha256Hex } from "./auth";
import { Actor, NoteChange, diffFields, recordNoteHistory, trackedFields } from "./history";
import { displayName } from "./members";
import { emailUser, siteUrl } from "./notify";
import { addDays, checkDate, todayUtc, verdictValidator } from "./testFields";

/**
 * Result links: a test result sent from a phone, with no account (/r/[token]).
 *
 * Two kinds share one page. An editor makes a shareable link for a note and pastes it into
 * WhatsApp or email; anyone holding it can send a result, as often as the test needs. The
 * weekly check-in email gives each driver a link for each question; it answers that one
 * question, then stops.
 *
 * Nothing sent through a link changes the note by itself. It waits as a pending result until an
 * editor accepts it (it becomes the note's latest result, marked "via link, no account") or
 * rejects it. Accepting never changes the evidence state: the note's test card then asks the
 * editor whether to, as it does for any result.
 */

type Verdict = Infer<typeof verdictValidator>;

export const MAX_RESULT_LENGTH = 280;
const MAX_NAME_LENGTH = 80;
// Per link: at most this many results in any one window, so a leaked link can't flood a note
export const RESULTS_PER_WINDOW = 10;
const WINDOW_MS = 60 * 60 * 1000;
// Per note: past this many waiting results, links stop taking more until an editor catches up
export const MAX_PENDING_PER_NOTE = 20;

const LINK_DEAD = "This link no longer works. Ask whoever sent it for a new one.";

/** A fresh unguessable token (256 bits), and the hash that's looked up. Same shape as decision links. */
async function newLinkToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return { token, hash: await sha256Hex(token) };
}

export function resultLinkUrl(token: string) {
  return `${siteUrl()}/r/${token}`;
}

async function isEditor(ctx: QueryCtx, canvasId: Id<"canvases">, userId: Id<"users">) {
  const role = await getCanvasRole(ctx, canvasId, userId);
  return role === "owner" || role === "editor";
}

/**
 * The link behind a token, with its note, while it still works: not turned off or replaced, the
 * note still there, and whoever it stands for still able to use it (the editor still an editor;
 * for a check-in, the question still waiting and the driver still driving the note).
 */
async function checkLink(ctx: QueryCtx, link: Doc<"resultLinks">) {
  if (link.revokedAt) return null;
  const note = await ctx.db.get(link.noteId);
  if (!note) return null;
  if (link.checkInItemId) {
    const item = await ctx.db.get(link.checkInItemId);
    if (!item || item.status !== "pending" || note.ownerId !== link.createdBy) return null;
    if (!(await getCanvasRole(ctx, note.canvasId, link.createdBy))) return null;
    return { link, note, item };
  }
  if (!(await isEditor(ctx, note.canvasId, link.createdBy))) return null;
  return { link, note, item: null };
}

async function findLink(ctx: QueryCtx, token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const link = await ctx.db
    .query("resultLinks")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", hash))
    .unique();
  return link ? await checkLink(ctx, link) : null;
}

/** The note's shareable link that works now, if any (check-in links aren't shareable). */
async function activeNoteLink(ctx: QueryCtx, noteId: Id<"notes">) {
  const links = await ctx.db
    .query("resultLinks")
    .withIndex("by_note", (q) => q.eq("noteId", noteId))
    .collect();
  return links.find((l) => !l.checkInItemId && !l.revokedAt) ?? null;
}

async function touch(ctx: MutationCtx, canvasId: Id<"canvases">, userId: Id<"users">, message: string) {
  const now = Date.now();
  await ctx.db.patch(canvasId, { updatedAt: now });
  await ctx.db.insert("activity", { canvasId, userId, type: "result_link", message, createdAt: now });
}

/**
 * Makes a new shareable result link for a note; any earlier one stops working. With `off`, just
 * turns the link off. Returns the new token. Caller must have verified editor access.
 */
export async function replaceResultLinkForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  opts: { off?: boolean } = {}
) {
  const now = Date.now();
  const current = await activeNoteLink(ctx, note._id);
  if (current) await ctx.db.patch(current._id, { revokedAt: now });
  if (opts.off) {
    if (current) await touch(ctx, note.canvasId, actor.userId, "turned off a result link");
    return null;
  }
  const { token, hash } = await newLinkToken();
  await ctx.db.insert("resultLinks", {
    canvasId: note.canvasId,
    noteId: note._id,
    tokenHash: hash,
    token,
    createdBy: actor.userId,
    createdAt: now,
  });
  await touch(ctx, note.canvasId, actor.userId, current ? "made a new result link" : "made a result link");
  return token;
}

/**
 * Gives a weekly check-in question its own answer link, for the driver's email. The token is
 * returned for the email and only its hash is kept.
 */
export async function createCheckInLink(ctx: MutationCtx, item: Doc<"checkInItems">) {
  const { token, hash } = await newLinkToken();
  await ctx.db.insert("resultLinks", {
    canvasId: item.canvasId,
    noteId: item.noteId,
    tokenHash: hash,
    checkInItemId: item._id,
    createdBy: item.userId,
    createdAt: Date.now(),
  });
  return token;
}

/**
 * What the result page shows for a link: the note, what we watch and what counts as a pass.
 * Null when the link doesn't work. Shows nothing else from the canvas.
 */
export async function getResultLink(ctx: QueryCtx, token: string) {
  const found = await findLink(ctx, token);
  if (!found) return null;
  const { link, note, item } = found;
  const canvas = await ctx.db.get(note.canvasId);
  return {
    kind: item ? ("check_in" as const) : ("note" as const),
    canvasTitle: canvas?.title ?? "",
    noteText: note.content,
    measure: note.measure,
    passMark: note.passMark,
    reviewDate: note.reviewDate,
    // Who sent the link (shareable) or who it's for (check-in)
    personName: displayName(await ctx.db.get(link.createdBy)),
  };
}

function cleanDate(date: string | undefined) {
  // The sender's calendar date, within a day of ours either way; otherwise today (UTC)
  const today = todayUtc();
  if (!date) return today;
  const value = checkDate(date.trim(), "date");
  return value >= addDays(today, -1) && value <= addDays(today, 1) ? value : today;
}

/** Fixed-window throttle on one link. Throws when the window is full. */
async function spendLinkQuota(ctx: MutationCtx, link: Doc<"resultLinks">, now: number) {
  const inWindow = link.windowStart !== undefined && now - link.windowStart < WINDOW_MS;
  const count = inWindow ? (link.windowCount ?? 0) : 0;
  if (count >= RESULTS_PER_WINDOW) {
    throw new ConvexError("This link has taken a lot of results in the last hour. Try again later.");
  }
  await ctx.db.patch(link._id, { windowStart: inWindow ? link.windowStart : now, windowCount: count + 1 });
}

async function pendingFor(ctx: QueryCtx, noteId: Id<"notes">) {
  return await ctx.db
    .query("resultSubmissions")
    .withIndex("by_note_and_status", (q) => q.eq("noteId", noteId).eq("status", "pending"))
    .take(MAX_PENDING_PER_NOTE + 1);
}

/**
 * Sends a result from a link, with no sign-in. It waits on the note for an editor; nothing on the
 * note changes. A check-in link can instead say there's nothing new, which answers the question
 * the way the driver would in the app. `name` is who says they're sending it, recorded as given.
 */
export async function submitResultByLink(
  ctx: MutationCtx,
  token: string,
  args: { text?: string; verdict?: Verdict; name?: string; date?: string; nothingNew?: boolean }
) {
  const found = await findLink(ctx, token);
  if (!found) throw new ConvexError(LINK_DEAD);
  const { link, note, item } = found;
  const now = Date.now();
  const name = args.name?.trim().slice(0, MAX_NAME_LENGTH) || undefined;
  // A link stands for whoever it was made by or sent to; history shows the name typed, if any
  const actor: Actor = { userId: link.createdBy, via: "link" };

  if (args.nothingNew) {
    if (!item) throw new ConvexError("Send a result, or close this page if there's nothing new.");
    await spendLinkQuota(ctx, link, now);
    await recordNoteHistory(ctx, actor, note, "check_in", [{ field: "checkIn", to: "no new evidence" }]);
    await ctx.db.patch(item._id, { status: "answered", hasEvidence: false, answeredAt: now });
    return { status: "nothing_new" as const };
  }

  const text = args.text?.trim();
  if (!text) throw new ConvexError("Type the result first");
  if (text.length > MAX_RESULT_LENGTH) throw new ConvexError(`Keep the result under ${MAX_RESULT_LENGTH} characters`);
  const date = cleanDate(args.date);
  if ((await pendingFor(ctx, note._id)).length >= MAX_PENDING_PER_NOTE) {
    throw new ConvexError("This note has a lot of results waiting to be checked. Try again once they've been looked at.");
  }
  await spendLinkQuota(ctx, link, now);

  await ctx.db.insert("resultSubmissions", {
    canvasId: note.canvasId,
    noteId: note._id,
    linkId: link._id,
    text,
    verdict: args.verdict,
    name,
    date,
    status: "pending",
  });

  const changes: NoteChange[] = [];
  if (item) changes.push({ field: "checkIn", to: "new evidence" });
  changes.push({ field: "result.text", to: text });
  if (args.verdict) changes.push({ field: "result.verdict", to: args.verdict });
  if (name) changes.push({ field: "result.name", to: name });
  await recordNoteHistory(ctx, actor, note, "result_submitted", changes);
  if (item) await ctx.db.patch(item._id, { status: "answered", hasEvidence: true, answer: text, answeredAt: now });

  const who = name ?? "Someone";
  await touch(ctx, note.canvasId, link.createdBy, `${who} sent a test result from a link`);

  // Tell the operator: the editor who shared the link, or for a check-in, whoever runs the canvas
  const canvas = await ctx.db.get(note.canvasId);
  const operatorId = item ? canvas?.createdBy : link.createdBy;
  if (operatorId) {
    const label = note.measure ?? note.content;
    await emailUser(ctx, operatorId, {
      subject: `New result via link: ${label}`,
      text: [
        `${who} sent a test result for a note in "${canvas?.title ?? "a canvas"}", from a link with no account.`,
        "",
        `Note: ${note.content}`,
        ...(note.measure ? [`We watch: ${note.measure}`] : []),
        ...(note.passMark ? [`It passes if: ${note.passMark}`] : []),
        `Result: ${text}${args.verdict ? ` (they say: ${args.verdict})` : ""}`,
        "",
        "It isn't on the note yet. Accept it or reject it here:",
        `${siteUrl()}/canvas/${note.canvasId}?note=${note._id}`,
      ].join("\n"),
    });
  }
  return { status: "sent" as const };
}

/**
 * What an editor sees on a note: its shareable link (if one works) and the results waiting.
 * Caller must have verified editor access.
 */
export async function resultLinkForNote(ctx: QueryCtx, noteId: Id<"notes">) {
  const link = await activeNoteLink(ctx, noteId);
  const live = link ? await checkLink(ctx, link) : null;
  const pending = await pendingFor(ctx, noteId);
  return {
    token: live ? link!.token ?? null : null,
    pending: pending.map((s) => ({
      _id: s._id,
      text: s.text,
      verdict: s.verdict,
      name: s.name,
      date: s.date,
      sentAt: s._creationTime,
    })),
  };
}

async function pendingSubmission(ctx: QueryCtx, submissionId: Id<"resultSubmissions">) {
  const submission = await ctx.db.get(submissionId);
  if (!submission) throw new ConvexError("Result not found");
  if (submission.status !== "pending") throw new ConvexError("This result has already been accepted or rejected");
  const note = await ctx.db.get(submission.noteId);
  if (!note) throw new ConvexError("Note not found");
  return { submission, note };
}

/** The canvas a pending result belongs to, so callers can check access before acting on it. */
export async function submissionCanvas(ctx: QueryCtx, submissionId: Id<"resultSubmissions">) {
  const submission = await ctx.db.get(submissionId);
  if (!submission) throw new ConvexError("Result not found");
  return submission.canvasId;
}

/**
 * Makes a pending result the note's latest result, marked as sent via link. `verdict` overrides
 * what the sender said. The evidence state is left alone. Caller must have verified editor access.
 */
export async function acceptSubmissionForUser(
  ctx: MutationCtx,
  actor: Actor,
  submissionId: Id<"resultSubmissions">,
  opts: { verdict?: Verdict | null } = {}
) {
  const { submission, note } = await pendingSubmission(ctx, submissionId);
  const now = Date.now();
  const verdict = opts.verdict === null ? undefined : (opts.verdict ?? submission.verdict);
  const latestResult = {
    text: submission.text,
    date: submission.date,
    verdict,
    via: "link" as const,
    byName: submission.name,
  };
  await ctx.db.patch(note._id, { latestResult, updatedAt: now });
  await ctx.db.patch(submission._id, { status: "accepted", reviewedBy: actor.userId, reviewedAt: now });

  const changes = diffFields(trackedFields(note), trackedFields({ ...note, latestResult }));
  if (submission.name) changes.push({ field: "result.name", to: submission.name });
  await recordNoteHistory(ctx, actor, note, "result_accepted", changes);
  await touch(ctx, note.canvasId, actor.userId, "accepted a test result sent from a link");
}

/** Drops a pending result; the note doesn't change. Caller must have verified editor access. */
export async function rejectSubmissionForUser(
  ctx: MutationCtx,
  actor: Actor,
  submissionId: Id<"resultSubmissions">,
  opts: { reason?: string } = {}
) {
  const { submission, note } = await pendingSubmission(ctx, submissionId);
  const now = Date.now();
  await ctx.db.patch(submission._id, { status: "rejected", reviewedBy: actor.userId, reviewedAt: now });
  const changes: NoteChange[] = [{ field: "result.text", from: submission.text }];
  if (submission.name) changes.push({ field: "result.name", from: submission.name });
  await recordNoteHistory(ctx, actor, note, "result_rejected", changes, opts);
  await touch(ctx, note.canvasId, actor.userId, "rejected a test result sent from a link");
}

/** Removes a deleted note's links and waiting results; its history keeps what happened. */
export async function deleteResultLinksForNote(ctx: MutationCtx, noteId: Id<"notes">) {
  for (const link of await ctx.db.query("resultLinks").withIndex("by_note", (q) => q.eq("noteId", noteId)).collect()) {
    await ctx.db.delete(link._id);
  }
  const pending = await ctx.db
    .query("resultSubmissions")
    .withIndex("by_note_and_status", (q) => q.eq("noteId", noteId).eq("status", "pending"))
    .collect();
  for (const s of pending) await ctx.db.delete(s._id);
}
