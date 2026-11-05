import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getCanvasRole } from "./auth";

/**
 * People are who a canvas can ask to decide without giving them an account: a name and an email.
 * They answer only from the link they're emailed, and can stop the emails from that same link.
 */

export const MAX_PERSON_NAME_LENGTH = 80;
// Per canvas, so edit access can't be used to email strangers in bulk
export const MAX_PEOPLE_PER_CANVAS = 50;
// Emails to one person from one canvas, per window
export const PERSON_EMAILS_PER_WINDOW = 5;
export const PERSON_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Who someone named by name and email is on this canvas: a member with that email (they decide
 * as themselves), or a person, created on first use. An existing person keeps the name they were
 * first given. Caller must have verified editor access.
 */
export async function resolveDecider(
  ctx: MutationCtx,
  canvasId: Id<"canvases">,
  createdBy: Id<"users">,
  contact: { name: string; email: string }
): Promise<{ userId: Id<"users"> } | { personId: Id<"people"> }> {
  const name = contact.name.trim();
  const email = normalizeEmail(contact.email);
  if (!name) throw new ConvexError("Give the decider's name");
  if (name.length > MAX_PERSON_NAME_LENGTH) throw new ConvexError(`Keep the name under ${MAX_PERSON_NAME_LENGTH} characters`);
  if (!EMAIL_PATTERN.test(email)) throw new ConvexError("Give an email address the link can go to");

  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
  if (user && (await getCanvasRole(ctx, canvasId, user._id))) return { userId: user._id };

  const existing = await ctx.db
    .query("people")
    .withIndex("by_canvas_and_email", (q) => q.eq("canvasId", canvasId).eq("email", email))
    .unique();
  if (existing) return { personId: existing._id };

  const count = (
    await ctx.db
      .query("people")
      .withIndex("by_canvas_and_email", (q) => q.eq("canvasId", canvasId))
      .take(MAX_PEOPLE_PER_CANVAS)
  ).length;
  if (count >= MAX_PEOPLE_PER_CANVAS) {
    throw new ConvexError(`A canvas can ask at most ${MAX_PEOPLE_PER_CANVAS} people without accounts`);
  }
  const personId = await ctx.db.insert("people", { canvasId, name, email, createdBy, createdAt: Date.now() });
  return { personId };
}

/** A person who can still be asked on this canvas, or an error saying why not. */
export async function requireAskablePerson(ctx: QueryCtx, canvasId: Id<"canvases">, personId: Id<"people">) {
  const person = await ctx.db.get(personId);
  if (!person || person.canvasId !== canvasId) throw new ConvexError("That person isn't on this canvas");
  if (person.stoppedAt) throw new ConvexError(`${person.name} asked not to get emails from this canvas`);
  return person;
}

/** The people on a canvas, by name. Emails are for editors only (they're the ones who ask). */
export async function listPeople(ctx: QueryCtx, canvasId: Id<"canvases">, opts: { withEmail: boolean }) {
  const people = await ctx.db
    .query("people")
    .withIndex("by_canvas_and_email", (q) => q.eq("canvasId", canvasId))
    .take(MAX_PEOPLE_PER_CANVAS);
  return people
    .map((p) => ({
      id: p._id,
      name: p.name,
      email: opts.withEmail ? p.email : undefined,
      stopped: !!p.stoppedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Queues a plain-text email to a person, unless they stopped emails from this canvas. Throws
 * once they've had PERSON_EMAILS_PER_WINDOW in the window, so a request can't be resent to flood them.
 */
export async function emailPerson(ctx: MutationCtx, person: Doc<"people">, message: { subject: string; text: string }) {
  if (person.stoppedAt) return;
  const now = Date.now();
  const inWindow = person.windowStart !== undefined && now - person.windowStart < PERSON_EMAIL_WINDOW_MS;
  const count = inWindow ? (person.windowCount ?? 0) : 0;
  if (count >= PERSON_EMAILS_PER_WINDOW) {
    throw new ConvexError(`${person.name} has had ${PERSON_EMAILS_PER_WINDOW} emails from this canvas today. Try again tomorrow.`);
  }
  await ctx.db.patch(person._id, { windowStart: inWindow ? person.windowStart : now, windowCount: count + 1 });
  await ctx.scheduler.runAfter(0, internal.email.send, { to: person.email, ...message });
}

/** Removes a canvas's people (when the canvas is deleted). */
export async function deletePeople(ctx: MutationCtx, canvasId: Id<"canvases">) {
  const people = await ctx.db
    .query("people")
    .withIndex("by_canvas_and_email", (q) => q.eq("canvasId", canvasId))
    .take(MAX_PEOPLE_PER_CANVAS + 50);
  for (const p of people) await ctx.db.delete(p._id);
}
