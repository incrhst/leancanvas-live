/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { PERSON_EMAILS_PER_WINDOW } from "./lib/people";
import { sha256Hex } from "./lib/auth";

const modules = import.meta.glob("./**/*.ts");

/** A canvas owned by Celine, with Daren as a view-only member and one note. Ana has no account. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const celine = await ctx.db.insert("users", { name: "Celine", email: "celine@example.com" });
    const daren = await ctx.db.insert("users", { name: "Daren", email: "daren@example.com" });
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
    await ctx.db.insert("canvasMembers", { canvasId, userId: daren, role: "viewer" });
    const noteId = await ctx.db.insert("notes", {
      canvasId,
      block: "channels",
      content: "Market Afforrd through the agency",
      order: 0,
      evidenceState: "assumption",
      createdBy: celine,
      updatedAt: Date.now(),
    });
    return { celine, daren, canvasId, noteId };
  });
  const asCeline = t.withIdentity({ subject: `${ids.celine}|session` });
  const asDaren = t.withIdentity({ subject: `${ids.daren}|session` });
  return { t, asCeline, asDaren, ...ids };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function sentEmails(t: ReturnType<typeof convexTest>) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((j) => j.name.startsWith("email")).map((j) => j.args[0] as { to: string; subject: string; text: string });
}

async function latestLinkToken(t: ReturnType<typeof convexTest>, to: string) {
  const email = (await sentEmails(t)).filter((e) => e.to === to).at(-1);
  const match = email?.text.match(/\/d\/([0-9a-f]{64})/);
  if (!match) throw new Error(`No answer link emailed to ${to}`);
  return match[1];
}

const ANA = { name: "Ana Brown", email: "Ana@Example.com" };

async function askAna(s: Setup, extra: { options?: string[] } = {}) {
  await s.asCeline.mutation(api.decisions.requestDecision, {
    noteId: s.noteId,
    question: "Do we sign the agency?",
    decider: ANA,
    dueDate: "2099-11-01",
    defaultOutcome: "We sign the agency",
    ...extra,
  });
  return await latestLinkToken(s.t, "ana@example.com");
}

const noteOf = async (s: Setup) => (await s.t.run((ctx) => ctx.db.get(s.noteId)))!;
const peopleOf = (s: Setup) => s.t.run((ctx) => ctx.db.query("people").collect());

describe("asking someone without an account", () => {
  test("adds them as a person by name and email and emails them the answer link", async () => {
    const s = await setup();
    const token = await askAna(s);

    const people = await peopleOf(s);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ name: "Ana Brown", email: "ana@example.com", canvasId: s.canvasId });

    const decision = (await noteOf(s)).decision!;
    expect(decision.deciderPersonId).toBe(people[0]._id);
    expect(decision.deciderId).toBeUndefined();

    const email = (await sentEmails(s.t)).at(-1)!;
    expect(email.to).toBe("ana@example.com");
    expect(email.text).toContain(`/d/${token}`);
    expect(email.text).toContain("Stop these emails");

    expect(await s.t.query(api.decisions.getByLink, { token })).toMatchObject({
      deciderName: "Ana Brown",
      withoutAccount: true,
      emailsStopped: false,
      status: "open",
    });
  });

  test("their answer from the link counts, and history names them", async () => {
    const s = await setup();
    const token = await askAna(s, { options: ["Sign the agency", "Build in-house"] });
    await s.t.mutation(api.decisions.answerByLink, { token, answer: "choose", choice: "Build in-house" });

    const note = await noteOf(s);
    expect(note.evidenceState).toBe("decision");
    expect(note.decision).toMatchObject({ status: "decided", choice: "Build in-house", answeredVia: "link" });

    const [person] = await peopleOf(s);
    const history = await s.asCeline.query(api.notes.getNoteHistory, { noteId: s.noteId });
    const answered = history.find((h) => h.kind === "decision_answered")!;
    expect(answered).toMatchObject({ via: "link", personId: person._id, userName: "Ana Brown" });
    expect(answered.userId).toBeUndefined();
    const requested = history.find((h) => h.kind === "decision_requested")!;
    expect(requested.changes).toContainEqual({ field: "decision.decider", from: undefined, to: "Ana Brown" });

    const toCeline = (await sentEmails(s.t)).filter((e) => e.to === "celine@example.com").at(-1)!;
    expect(toCeline.subject).toBe("Ana Brown chose “Build in-house” on your request: Do we sign the agency?");
  });

  test("they can't answer in the app, since they have no account", async () => {
    const s = await setup();
    await askAna(s);
    await expect(s.asDaren.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "approve" })).rejects.toThrow(
      /Only Ana Brown can answer this decision request, from the link/
    );
  });

  test("a member named by their email decides as themselves, with no person added", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.decisions.requestDecision, {
      noteId: s.noteId,
      question: "Sign?",
      decider: { name: "D", email: "DAREN@example.com" },
      dueDate: "2099-11-01",
    });
    expect((await noteOf(s)).decision!.deciderId).toBe(s.daren);
    expect(await peopleOf(s)).toHaveLength(0);
    await s.asDaren.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "approve" });
  });

  test("the same email reuses the person, who keeps their first name", async () => {
    const s = await setup();
    const token = await askAna(s);
    await s.t.mutation(api.decisions.answerByLink, { token, answer: "approve" });
    await s.asCeline.mutation(api.decisions.requestDecision, {
      noteId: s.noteId,
      question: "Again?",
      decider: { name: "Ana B.", email: "ana@example.com " },
      dueDate: "2099-11-01",
    });
    const people = await peopleOf(s);
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe("Ana Brown");

    // And can be asked by id next time
    await s.asCeline.mutation(api.decisions.withdrawDecision, { noteId: s.noteId });
    await s.asCeline.mutation(api.decisions.requestDecision, {
      noteId: s.noteId,
      question: "Third time?",
      deciderPersonId: people[0]._id,
      dueDate: "2099-11-01",
    });
    expect((await noteOf(s)).decision!.deciderPersonId).toBe(people[0]._id);
  });

  test("needs exactly one decider, a name, and a usable email", async () => {
    const s = await setup();
    const ask = (who: Record<string, unknown>) =>
      s.asCeline.mutation(api.decisions.requestDecision, { noteId: s.noteId, question: "Q?", dueDate: "2099-11-01", ...who });
    await expect(ask({})).rejects.toThrow(/Name one decider/);
    await expect(ask({ deciderId: s.daren, decider: ANA })).rejects.toThrow(/Name one decider/);
    await expect(ask({ decider: { name: " ", email: "ana@example.com" } })).rejects.toThrow(/decider's name/);
    await expect(ask({ decider: { name: "Ana", email: "not an email" } })).rejects.toThrow(/email address/);
    expect(await peopleOf(s)).toHaveLength(0);
    expect((await noteOf(s)).decision).toBeUndefined();
  });

  test("only editors can ask", async () => {
    const s = await setup();
    await expect(
      s.asDaren.mutation(api.decisions.requestDecision, { noteId: s.noteId, question: "Q?", decider: ANA, dueDate: "2099-11-01" })
    ).rejects.toThrow(/Forbidden/);
  });
});

describe("stopping the emails", () => {
  test("from the link, then nobody on the canvas can email them again", async () => {
    const s = await setup();
    const token = await askAna(s);
    await s.t.mutation(api.decisions.stopEmails, { token });

    expect((await peopleOf(s))[0].stoppedAt).toBeTypeOf("number");
    expect(await s.t.query(api.decisions.getByLink, { token })).toMatchObject({ emailsStopped: true, status: "open" });
    // They can still answer the link they have
    await expect(s.asCeline.mutation(api.decisions.replaceDecisionLink, { noteId: s.noteId })).rejects.toThrow(
      /asked not to get emails/
    );
    await s.t.mutation(api.decisions.answerByLink, { token, answer: "approve" });

    await expect(
      s.asCeline.mutation(api.decisions.requestDecision, { noteId: s.noteId, question: "Q?", decider: ANA, dueDate: "2099-11-01" })
    ).rejects.toThrow(/asked not to get emails/);
  });

  test("is for people without accounts only", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.decisions.requestDecision, {
      noteId: s.noteId,
      question: "Q?",
      deciderId: s.daren,
      dueDate: "2099-11-01",
    });
    const token = await latestLinkToken(s.t, "daren@example.com");
    await expect(s.t.mutation(api.decisions.stopEmails, { token })).rejects.toThrow(/without an account/);
    await expect(s.t.mutation(api.decisions.stopEmails, { token: "0".repeat(64) })).rejects.toThrow(/no longer works/);
  });
});

describe("guardrails", () => {
  test(`at most ${PERSON_EMAILS_PER_WINDOW} emails a day to one person`, async () => {
    const s = await setup();
    await askAna(s);
    for (let i = 1; i < PERSON_EMAILS_PER_WINDOW; i++) {
      await s.asCeline.mutation(api.decisions.replaceDecisionLink, { noteId: s.noteId });
    }
    await expect(s.asCeline.mutation(api.decisions.replaceDecisionLink, { noteId: s.noteId })).rejects.toThrow(
      /emails from this canvas today/
    );
    expect((await sentEmails(s.t)).filter((e) => e.to === "ana@example.com")).toHaveLength(PERSON_EMAILS_PER_WINDOW);
  });
});

describe("what the canvas shows", () => {
  test("decisions carry the decider's name; editors get the people list with emails, viewers don't", async () => {
    const s = await setup();
    await askAna(s);
    const asEditor = await s.asCeline.query(api.canvases.getCanvas, { canvasId: s.canvasId });
    expect(asEditor!.notes[0].decision).toMatchObject({ deciderName: "Ana Brown" });
    expect(asEditor!.people).toEqual([
      { id: expect.any(String), name: "Ana Brown", email: "ana@example.com", stopped: false },
    ]);
    const asViewer = await s.asDaren.query(api.canvases.getCanvas, { canvasId: s.canvasId });
    expect(asViewer!.people).toEqual([]);
  });

  test("deleting the canvas removes its people", async () => {
    const s = await setup();
    await askAna(s);
    await s.asCeline.mutation(api.canvases.deleteCanvas, { canvasId: s.canvasId });
    expect(await peopleOf(s)).toHaveLength(0);
  });
});

describe("agents (MCP)", () => {
  async function withToken(s: Setup) {
    await s.t.run(async (ctx) => {
      await ctx.db.insert("oauthTokens", {
        accessTokenHash: await sha256Hex("celine-agent-token"),
        refreshTokenHash: await sha256Hex("celine-refresh-token"),
        clientId: "test-client",
        userId: s.celine,
        accessExpiresAt: Date.now() + 60 * 60 * 1000,
      });
    });
    return "celine-agent-token";
  }

  test("request_decision takes a name and email, and get_canvas shows them as without an account", async () => {
    const s = await setup();
    const accessToken = await withToken(s);
    const note = await s.t.mutation(api.mcp.requestDecision, {
      accessToken,
      noteId: s.noteId,
      question: "Do we sign the agency?",
      deciderName: "Ana Brown",
      deciderEmail: "ana@example.com",
      dueDate: "2099-11-01",
    });
    expect(note.decision!.decider).toEqual({ name: "Ana Brown", withoutAccount: true });
    expect((await sentEmails(s.t)).at(-1)!.to).toBe("ana@example.com");
  });

  test("needs a member or a full name and email, not both", async () => {
    const s = await setup();
    const accessToken = await withToken(s);
    const ask = (who: Record<string, string>) =>
      s.t.mutation(api.mcp.requestDecision, { accessToken, noteId: s.noteId, question: "Q?", dueDate: "2099-11-01", ...who });
    await expect(ask({})).rejects.toThrow(/deciderUserId for a canvas member/);
    await expect(ask({ deciderUserId: s.daren, deciderName: "Ana", deciderEmail: "ana@example.com" })).rejects.toThrow(
      /deciderUserId for a canvas member/
    );
    await expect(ask({ deciderName: "Ana" })).rejects.toThrow(/both deciderName and deciderEmail/);
  });
});
