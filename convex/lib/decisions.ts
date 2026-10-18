import { ConvexError, Infer, v } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getCanvasRole, sha256Hex } from "./auth";
import { Actor, NoteChange, recordNoteHistory } from "./history";
import { displayName } from "./members";
import { checkDate, todayUtc } from "./testFields";
import { emailUser, siteUrl } from "./notify";
import { defaultOutcomeLine, formatLongDate } from "./decisionText";

/** A request for someone to decide on a note. Stays on the note after it's answered, as the record. */
export const decisionStatusValidator = v.union(
  v.literal("open"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("changes_requested"),
  // One of the request's own options was chosen (see `choice`)
  v.literal("decided")
);

export const decisionRequestValidator = v.object({
  question: v.string(),
  deciderId: v.id("users"),
  dueDate: v.string(),
  // What happens if nobody decides by dueDate, e.g. "We sign the agency". Shown, never applied for them.
  defaultOutcome: v.optional(v.string()),
  // The decider's choices instead of approve / reject, e.g. ["Sign the agency", "Build in-house"]
  options: v.optional(v.array(v.string())),
  requestedBy: v.id("users"),
  requestedAt: v.number(),
  status: decisionStatusValidator,
  // The option picked, when status is "decided"
  choice: v.optional(v.string()),
  comment: v.optional(v.string()),
  answeredAt: v.optional(v.number()),
  // Answered from the emailed link (no sign-in), and the name they gave, if any
  answeredVia: v.optional(v.literal("link")),
  answeredByName: v.optional(v.string()),
  // SHA-256 of this request's answer link token. Unset = link turned off. The token itself is only in the email.
  linkTokenHash: v.optional(v.string()),
});

export const decisionAnswerValidator = v.union(
  v.literal("approve"),
  v.literal("reject"),
  v.literal("change"),
  v.literal("choose")
);

export type DecisionAnswer = Infer<typeof decisionAnswerValidator>;
type Decision = NonNullable<Doc<"notes">["decision"]>;

const STATUS_FOR_ANSWER = {
  approve: "approved",
  reject: "rejected",
  change: "changes_requested",
  choose: "decided",
} as const;

export const MAX_DEFAULT_OUTCOME_LENGTH = 200;
export const MAX_OPTIONS = 4;
export const MAX_OPTION_LENGTH = 60;
const MAX_NAME_LENGTH = 80;

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

/** A fresh unguessable answer token (256 bits), and the hash that's stored. */
async function newLinkToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return { token, hash: await sha256Hex(token) };
}

export function decisionLinkUrl(token: string) {
  return `${siteUrl()}/d/${token}`;
}

function checkDefaultOutcome(value: string | undefined) {
  const outcome = value?.trim() || undefined;
  if (outcome && outcome.length > MAX_DEFAULT_OUTCOME_LENGTH) {
    throw new ConvexError(`Keep the default under ${MAX_DEFAULT_OUTCOME_LENGTH} characters`);
  }
  return outcome;
}

/** No options means approve / reject. Otherwise 2 to 4 distinct, short choices. */
function checkOptions(value: string[] | undefined) {
  const options = (value ?? []).map((o) => o.trim()).filter(Boolean);
  if (options.length === 0) return undefined;
  if (options.length < 2) throw new ConvexError("Give at least two options, or none to ask for approve or reject");
  if (options.length > MAX_OPTIONS) throw new ConvexError(`Give at most ${MAX_OPTIONS} options`);
  if (options.some((o) => o.length > MAX_OPTION_LENGTH)) {
    throw new ConvexError(`Keep each option under ${MAX_OPTION_LENGTH} characters`);
  }
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    throw new ConvexError("Each option must be different");
  }
  return options;
}

/** The decision request email: the question, the default, and the link that answers it without signing in. */
async function emailDecider(
  ctx: MutationCtx,
  note: Doc<"notes">,
  decision: Decision,
  token: string,
  opts: { reminder?: boolean } = {}
) {
  const canvas = await ctx.db.get(note.canvasId);
  const requester = await ctx.db.get(decision.requestedBy);
  const today = todayUtc();
  const by = formatLongDate(decision.dueDate, Number(today.slice(0, 4)));
  const fallback = defaultOutcomeLine(decision, today);
  await emailUser(ctx, decision.deciderId, {
    subject: `${opts.reminder ? "New link: " : ""}Decision needed by ${by}: ${decision.question}`,
    text: [
      `${displayName(requester)} has asked you to decide on a note in "${canvas?.title ?? "a canvas"}".`,
      "",
      `Question: ${decision.question}`,
      ...(decision.options ? [`Options: ${decision.options.join(" / ")}`] : []),
      `Note: ${note.content}`,
      `Needed by: ${by}`,
      ...(fallback ? [fallback] : []),
      "",
      `Answer here, no sign-in needed: ${decisionLinkUrl(token)}`,
      "",
      "The link is just for this decision. It stops working once the decision is made or withdrawn.",
      ...(opts.reminder ? ["Any earlier link for this decision no longer works."] : []),
    ].join("\n"),
  });
}

/**
 * Asks one canvas member to decide on a note, and emails them a link that answers it without
 * signing in. Caller must have verified editor access.
 */
export async function requestDecisionForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  args: {
    question: string;
    deciderId: Id<"users">;
    dueDate: string;
    defaultOutcome?: string;
    options?: string[];
  }
) {
  if (note.decision?.status === "open") {
    throw new ConvexError("This note already has an open decision request. Withdraw it first to ask again.");
  }
  const question = args.question.trim();
  if (!question) throw new ConvexError("The question can't be empty");
  const dueDate = checkDate(args.dueDate.trim(), "dueDate");
  const defaultOutcome = checkDefaultOutcome(args.defaultOutcome);
  const options = checkOptions(args.options);
  if (!(await getCanvasRole(ctx, note.canvasId, args.deciderId))) {
    throw new ConvexError("The decider must be a member of this canvas");
  }

  const now = Date.now();
  const link = await newLinkToken();
  const decision: Decision = {
    question,
    deciderId: args.deciderId,
    dueDate,
    defaultOutcome,
    options,
    requestedBy: actor.userId,
    requestedAt: now,
    status: "open",
    linkTokenHash: link.hash,
  };
  await ctx.db.patch(note._id, { decision, updatedAt: now });

  const changes: NoteChange[] = [
    { field: "decision.question", to: question },
    { field: "decision.deciderId", to: args.deciderId },
    { field: "decision.dueDate", to: dueDate },
  ];
  if (defaultOutcome) changes.push({ field: "decision.defaultOutcome", to: defaultOutcome });
  if (options) changes.push({ field: "decision.options", to: options.join(" / ") });
  await recordNoteHistory(ctx, actor, note, "decision_requested", changes);

  const decider = await ctx.db.get(args.deciderId);
  await touch(ctx, note, actor, `asked ${displayName(decider)} for a decision`);

  if (args.deciderId !== actor.userId) await emailDecider(ctx, note, decision, link.token);
}

/** Checks an answer against the request and returns the fields it sets. */
function checkAnswer(decision: Decision, args: { answer: DecisionAnswer; choice?: string; comment?: string }) {
  const comment = args.comment?.trim() || undefined;
  if (args.answer === "change" && !comment) throw new ConvexError("Say what should change");
  if (decision.options) {
    if (args.answer === "approve" || args.answer === "reject") {
      throw new ConvexError(`Choose one of the options: ${decision.options.join(", ")}`);
    }
    if (args.answer === "choose") {
      const choice = decision.options.find((o) => o.toLowerCase() === args.choice?.trim().toLowerCase());
      if (!choice) throw new ConvexError(`Choose one of the options: ${decision.options.join(", ")}`);
      return { status: STATUS_FOR_ANSWER.choose, choice, comment };
    }
  } else if (args.answer === "choose") {
    throw new ConvexError("This request has no options. Approve, reject or ask for a change.");
  }
  return { status: STATUS_FOR_ANSWER[args.answer], choice: undefined, comment };
}

/** What the decider did, as a phrase: "approved", "chose “Build in-house” on", … */
function answerPhrase(status: Decision["status"], choice?: string) {
  if (status === "decided") return `chose “${choice}” on`;
  return { open: "answered", approved: "approved", rejected: "rejected", changes_requested: "asked for changes on" }[
    status
  ];
}

/**
 * Records an answer for the named decider (signed in, or holding the link). Approving, rejecting
 * or choosing an option makes the note a decision; asking for a change sends it back to whoever
 * asked, with the note unchanged.
 */
async function recordAnswer(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  decision: Decision,
  args: { answer: DecisionAnswer; choice?: string; comment?: string; name?: string }
) {
  const { status, choice, comment } = checkAnswer(decision, args);
  const viaLink = actor.via === "link";
  const name = viaLink ? args.name?.trim().slice(0, MAX_NAME_LENGTH) || undefined : undefined;

  const now = Date.now();
  const evidenceState = status === "changes_requested" ? note.evidenceState : "decision";
  await ctx.db.patch(note._id, {
    decision: {
      ...decision,
      status,
      choice,
      comment,
      answeredAt: now,
      answeredVia: viaLink ? "link" : undefined,
      answeredByName: name,
    },
    evidenceState,
    updatedAt: now,
  });

  const changes: NoteChange[] = [{ field: "decision.status", from: "open", to: status }];
  if (choice) changes.push({ field: "decision.choice", to: choice });
  if (evidenceState !== note.evidenceState) {
    changes.push({ field: "evidenceState", from: note.evidenceState, to: evidenceState });
  }
  if (comment) changes.push({ field: "decision.comment", to: comment });
  if (name) changes.push({ field: "decision.answeredByName", to: name });
  await recordNoteHistory(ctx, actor, note, "decision_answered", changes);

  const label = answerPhrase(status, choice);
  await touch(ctx, note, actor, `${label} a decision request${viaLink ? " from the answer link" : ""}`);

  if (decision.requestedBy !== actor.userId) {
    const canvas = await ctx.db.get(note.canvasId);
    const decider = displayName(await ctx.db.get(actor.userId));
    const who = name && name !== decider ? `${decider} (signed “${name}”)` : decider;
    await emailUser(ctx, decision.requestedBy, {
      subject: `${decider} ${label} your request: ${decision.question}`,
      text: [
        `${who} ${label} your decision request in "${canvas?.title ?? "a canvas"}"${viaLink ? ", from the emailed link" : ""}.`,
        "",
        `Question: ${decision.question}`,
        ...(comment ? [`Comment: ${comment}`] : []),
        "",
        `Open the canvas: ${siteUrl()}/canvas/${note.canvasId}`,
      ].join("\n"),
    });
  }
}

/** Only the named decider can answer in the app, whatever their role on the canvas (view-only included). */
export async function answerDecisionForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  args: { answer: DecisionAnswer; choice?: string; comment?: string }
) {
  const decision = note.decision;
  if (!decision || decision.status !== "open") throw new ConvexError("This note has no open decision request");
  if (decision.deciderId !== actor.userId || !(await getCanvasRole(ctx, note.canvasId, actor.userId))) {
    const decider = await ctx.db.get(decision.deciderId);
    throw new ConvexError(`Only ${displayName(decider)} can answer this decision request`);
  }
  await recordAnswer(ctx, actor, note, decision, args);
}

/** The note whose decision this answer-link token belongs to, if any (open or not). */
async function noteForLink(ctx: QueryCtx, token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  return await ctx.db
    .query("notes")
    .withIndex("by_decision_link", (q) => q.eq("decision.linkTokenHash", hash))
    .unique();
}

const LINK_DEAD = "This link no longer works. Ask whoever sent it for a new one.";

/**
 * Answers a decision from its emailed link, with no sign-in. The link stands in for the decider,
 * so it works only while the request is open, its link hasn't been turned off, and the decider
 * is still on the canvas. `name` is who says they're answering, recorded as given.
 */
export async function answerDecisionByLink(
  ctx: MutationCtx,
  token: string,
  args: { answer: DecisionAnswer; choice?: string; comment?: string; name?: string }
) {
  const note = await noteForLink(ctx, token);
  const decision = note?.decision;
  if (!note || !decision) throw new ConvexError(LINK_DEAD);
  if (decision.status !== "open") throw new ConvexError("This decision has already been made.");
  if (!(await getCanvasRole(ctx, note.canvasId, decision.deciderId))) throw new ConvexError(LINK_DEAD);
  await recordAnswer(ctx, { userId: decision.deciderId, via: "link" }, note, decision, args);
}

/**
 * What the answer page shows for a link: the question, the default and the deadline while it's
 * open; the outcome once it's made. Null for unknown, turned-off or withdrawn links, and when
 * the decider has left the canvas. Shows nothing else from the canvas.
 */
export async function getDecisionByLink(ctx: QueryCtx, token: string) {
  const note = await noteForLink(ctx, token);
  const decision = note?.decision;
  if (!note || !decision) return null;
  if (!(await getCanvasRole(ctx, note.canvasId, decision.deciderId))) return null;
  const canvas = await ctx.db.get(note.canvasId);
  return {
    canvasTitle: canvas?.title ?? "",
    noteText: note.content,
    question: decision.question,
    dueDate: decision.dueDate,
    defaultOutcome: decision.defaultOutcome,
    options: decision.options,
    deciderName: displayName(await ctx.db.get(decision.deciderId)),
    requestedBy: displayName(await ctx.db.get(decision.requestedBy)),
    status: decision.status,
    choice: decision.choice,
    answeredAt: decision.answeredAt,
  };
}

/**
 * Replaces an open request's answer link and emails the new one to the decider; the old link
 * stops working. With `{ off: true }` it only turns the link off (the decider can still answer
 * in the app). Caller must have verified editor access.
 */
export async function replaceDecisionLinkForUser(
  ctx: MutationCtx,
  actor: Actor,
  note: Doc<"notes">,
  opts: { off?: boolean } = {}
) {
  const decision = note.decision;
  if (decision?.status !== "open") throw new ConvexError("This note has no open decision request");
  const link = opts.off ? null : await newLinkToken();
  const next: Decision = { ...decision, linkTokenHash: link?.hash };
  await ctx.db.patch(note._id, { decision: next, updatedAt: Date.now() });
  await touch(ctx, note, actor, link ? "sent a new decision link" : "turned off a decision link");
  if (link) await emailDecider(ctx, note, next, link.token, { reminder: true });
}

/** Cancels an open decision request, which also kills its link. Caller must have verified editor access. */
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
      defaultOutcome: decision.defaultOutcome,
      options: decision.options,
      requestedBy: displayName(await ctx.db.get(decision.requestedBy)),
      requestedAt: decision.requestedAt,
    });
  }
  return results.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
