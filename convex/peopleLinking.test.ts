/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { linkPeopleToUser } from "./lib/people";

const modules = import.meta.glob("./**/*.ts");

/** A canvas owned by Celine with one note, and Ana (no account yet) asked to decide on it. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const celine = await ctx.db.insert("users", { name: "Celine", email: "celine@example.com", emailVerificationTime: 1 });
    const workspaceId = await ctx.db.insert("workspaces", { name: "Afforrd", ownerId: celine });
    const canvasId = await ctx.db.insert("canvases", {
      workspaceId,
      title: "Afforrd launch",
      status: "active",
      isPublicViewEnabled: false,
      createdBy: celine,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("canvasMembers", { canvasId, userId: celine, role: "owner" });
    const noteId = await ctx.db.insert("notes", {
      canvasId,
      block: "channels",
      content: "Market Afforrd through the agency",
      order: 0,
      evidenceState: "assumption",
      createdBy: celine,
      updatedAt: Date.now(),
    });
    return { celine, canvasId, noteId };
  });
  const asCeline = t.withIdentity({ subject: `${ids.celine}|session` });
  return { t, asCeline, ...ids };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function askAna(s: Setup) {
  await s.asCeline.mutation(api.decisions.requestDecision, {
    noteId: s.noteId,
    question: "Do we sign the agency?",
    decider: { name: "Ana Brown", email: "ana@example.com" },
    dueDate: "2099-11-01",
  });
  const jobs = await s.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const email = jobs.map((j) => j.args[0] as { to: string; text: string }).filter((e) => e.to === "ana@example.com").at(-1);
  return email!.text.match(/\/d\/([0-9a-f]{64})/)![1];
}

/**
 * What Convex Auth does when someone uses a sign-in link: creates the user with the email marked
 * verified, then runs afterUserCreatedOrUpdated (convex/auth.ts), which calls linkPeopleToUser.
 */
async function signUp(s: Setup, email: string, opts: { verified?: boolean } = {}) {
  const userId = await s.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email,
      ...(opts.verified === false ? {} : { emailVerificationTime: Date.now() }),
    });
    await linkPeopleToUser(ctx, userId);
    return userId;
  });
  return { userId, as: s.t.withIdentity({ subject: `${userId}|session` }) };
}

const noteOf = async (s: Setup) => (await s.t.run((ctx) => ctx.db.get(s.noteId)))!;
const peopleOf = (s: Setup) => s.t.run((ctx) => ctx.db.query("people").collect());

describe("signing up with the email someone was asked by", () => {
  test("links the person, keeps the link working, and lets them answer in the app as themselves", async () => {
    const s = await setup();
    const token = await askAna(s);
    const ana = await signUp(s, "ana@example.com");

    const [person] = await peopleOf(s);
    expect(person.userId).toBe(ana.userId);
    // The decision still belongs to the person; nothing was converted
    const decision = (await noteOf(s)).decision!;
    expect(decision).toMatchObject({ deciderPersonId: person._id, status: "open" });
    expect(decision.deciderId).toBeUndefined();

    // The emailed link still works
    expect(await s.t.query(api.decisions.getByLink, { token })).toMatchObject({ deciderName: "Ana Brown", status: "open" });

    // It's waiting for them in the app, though they aren't on the canvas
    const open = await ana.as.query(api.decisions.myOpenDecisions, {});
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ noteId: s.noteId, question: "Do we sign the agency?", onCanvas: false });

    await ana.as.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "approve" });
    expect((await noteOf(s)).decision).toMatchObject({ status: "approved" });
    expect(await ana.as.query(api.decisions.myOpenDecisions, {})).toEqual([]);

    // History still names them as the person they were asked as
    const history = await s.asCeline.query(api.notes.getNoteHistory, { noteId: s.noteId });
    const answered = history.find((h) => h.kind === "decision_answered")!;
    expect(answered).toMatchObject({ via: "ui", personId: person._id, userName: "Ana Brown" });
    expect(answered.userId).toBeUndefined();
    const requested = history.find((h) => h.kind === "decision_requested")!;
    expect(requested.changes).toContainEqual({ field: "decision.decider", from: undefined, to: "Ana Brown" });
  });

  test("leaves the link as a way to answer too", async () => {
    const s = await setup();
    const token = await askAna(s);
    await signUp(s, "ana@example.com");
    await s.t.mutation(api.decisions.answerByLink, { token, answer: "reject" });
    expect((await noteOf(s)).decision).toMatchObject({ status: "rejected", answeredVia: "link" });
  });

  test("links them on every canvas that asked them", async () => {
    const s = await setup();
    await askAna(s);
    const otherCanvas = await s.t.run(async (ctx) => {
      const { workspaceId } = (await ctx.db.get(s.canvasId))!;
      const canvasId = await ctx.db.insert("canvases", {
        workspaceId,
        title: "Other",
        status: "active",
        isPublicViewEnabled: false,
        createdBy: s.celine,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("people", { canvasId, name: "Ana", email: "ana@example.com", createdBy: s.celine, createdAt: 0 });
      return canvasId;
    });
    const ana = await signUp(s, "ana@example.com");
    const people = await peopleOf(s);
    expect(people.map((p) => p.canvasId).sort()).toEqual([s.canvasId, otherCanvas].sort());
    expect(people.every((p) => p.userId === ana.userId)).toBe(true);
  });

  test("a different email changes nothing", async () => {
    const s = await setup();
    const token = await askAna(s);
    const other = await signUp(s, "someone@example.com");

    expect((await peopleOf(s))[0].userId).toBeUndefined();
    expect(await other.as.query(api.decisions.myOpenDecisions, {})).toEqual([]);
    await expect(other.as.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "approve" })).rejects.toThrow(
      /Only Ana Brown can answer/
    );
    expect(await s.t.query(api.decisions.getByLink, { token })).toMatchObject({ withoutAccount: true, status: "open" });
  });

  test("an unverified email changes nothing", async () => {
    const s = await setup();
    await askAna(s);
    const ana = await signUp(s, "ana@example.com", { verified: false });
    expect((await peopleOf(s))[0].userId).toBeUndefined();
    expect(await ana.as.query(api.decisions.myOpenDecisions, {})).toEqual([]);
  });
});

describe("other ways the link is made", () => {
  test("asking someone who already has an account but isn't on the canvas links them straight away", async () => {
    const s = await setup();
    const ana = await signUp(s, "ana@example.com");
    await askAna(s);
    const [person] = await peopleOf(s);
    expect(person.userId).toBe(ana.userId);
    expect((await noteOf(s)).decision!.deciderPersonId).toBe(person._id);
    expect(await ana.as.query(api.decisions.myOpenDecisions, {})).toHaveLength(1);
  });

  test("joining the canvas from an invite links them, and the canvas shows them as the decider", async () => {
    const s = await setup();
    await askAna(s);
    // Ana's account predates linking, so her person row isn't linked yet
    const ana = await s.t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "ana@example.com", emailVerificationTime: 1 });
      return userId;
    });
    const asAna = s.t.withIdentity({ subject: `${ana}|session` });
    expect((await peopleOf(s))[0].userId).toBeUndefined();

    const { token } = await s.asCeline.mutation(api.invites.createInvite, {
      canvasId: s.canvasId,
      email: "ana@example.com",
      role: "viewer",
    });
    await asAna.mutation(api.invites.acceptInvite, { token });

    expect((await peopleOf(s))[0].userId).toBe(ana);
    const canvas = await asAna.query(api.canvases.getCanvas, { canvasId: s.canvasId });
    expect(canvas!.notes[0].decision).toMatchObject({ deciderName: "Ana Brown", deciderUserId: ana });
    const open = await asAna.query(api.decisions.myOpenDecisions, {});
    expect(open).toMatchObject([{ noteId: s.noteId, onCanvas: true }]);
    await asAna.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "approve" });
  });

  test("an account already linked isn't replaced by another with the same email", async () => {
    const s = await setup();
    await askAna(s);
    const first = await signUp(s, "ana@example.com");
    await signUp(s, "ana@example.com");
    expect((await peopleOf(s))[0].userId).toBe(first.userId);
  });
});
