/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { defaultOutcomeLine } from "./lib/decisionText";

const modules = import.meta.glob("./**/*.ts");

/** A canvas owned by Celine, with Daren as a view-only member and one note. */
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
      publicViewToken: "public-token",
      isPublicViewEnabled: true,
      createdBy: celine,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("canvasMembers", { canvasId, userId: celine, role: "owner" });
    const darenMembership = await ctx.db.insert("canvasMembers", { canvasId, userId: daren, role: "viewer" });
    const noteId = await ctx.db.insert("notes", {
      canvasId,
      block: "channels",
      content: "Market Afforrd through the agency",
      order: 0,
      evidenceState: "supported",
      createdBy: celine,
      updatedAt: Date.now(),
    });
    return { celine, daren, canvasId, noteId, darenMembership };
  });
  const asCeline = t.withIdentity({ subject: `${ids.celine}|session` });
  const asDaren = t.withIdentity({ subject: `${ids.daren}|session` });
  return { t, asCeline, asDaren, ...ids };
}

/** The emails queued so far, oldest first. */
async function sentEmails(t: ReturnType<typeof convexTest>) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs
    .filter((j) => j.name.startsWith("email"))
    .map((j) => j.args[0] as { to: string; subject: string; text: string });
}

/** The answer-link token in the latest email to `to`. */
async function latestLinkToken(t: ReturnType<typeof convexTest>, to: string) {
  const email = (await sentEmails(t)).filter((e) => e.to === to).at(-1);
  const match = email?.text.match(/\/d\/([0-9a-f]{64})/);
  if (!match) throw new Error(`No answer link emailed to ${to}`);
  return match[1];
}

async function askDaren(s: Awaited<ReturnType<typeof setup>>, extra: { options?: string[]; deferOptions?: string[] } = {}) {
  await s.asCeline.mutation(api.decisions.requestDecision, {
    noteId: s.noteId,
    question: "How do we start marketing Afforrd?",
    deciderId: s.daren,
    dueDate: "2099-11-01",
    defaultOutcome: "We sign the agency",
    ...extra,
  });
  return await latestLinkToken(s.t, "daren@example.com");
}

async function noteOf(s: Awaited<ReturnType<typeof setup>>) {
  return (await s.t.run((ctx) => ctx.db.get(s.noteId)))!;
}

describe("the default if nobody decides", () => {
  test("reads as one sentence before the due date", () => {
    expect(defaultOutcomeLine({ defaultOutcome: "We sign the agency", dueDate: "2026-11-01", status: "open" }, "2026-10-18")).toBe(
      "If nothing is decided by 1 November, we sign the agency."
    );
  });

  test("says plainly that it applies once the due date has passed", () => {
    expect(defaultOutcomeLine({ defaultOutcome: "We sign the agency.", dueDate: "2026-11-01", status: "open" }, "2026-11-02")).toBe(
      "Nothing was decided by 1 November, so the default now applies: we sign the agency."
    );
  });

  test("the due day itself still counts as on time, and answered decisions keep the plain wording", () => {
    const d = { defaultOutcome: "We sign the agency", dueDate: "2026-11-01" };
    expect(defaultOutcomeLine({ ...d, status: "open" }, "2026-11-01")).toMatch(/^If nothing is decided/);
    expect(defaultOutcomeLine({ ...d, status: "decided" }, "2026-12-01")).toMatch(/^If nothing is decided/);
    expect(defaultOutcomeLine({ dueDate: "2026-11-01", status: "open" }, "2026-10-18")).toBeNull();
  });

  test("a past due date changes nothing stored: the request stays open until someone answers", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.decisions.requestDecision, {
      noteId: s.noteId,
      question: "Sign the agency?",
      deciderId: s.daren,
      dueDate: "2020-01-01",
      defaultOutcome: "We sign the agency",
    });
    const note = await noteOf(s);
    expect(note.decision).toMatchObject({ status: "open", defaultOutcome: "We sign the agency" });
    expect(note.evidenceState).toBe("supported");
  });
});

describe("the decision email", () => {
  test("links to a one-decision answer page, not the signed-in /decisions page, and states the default", async () => {
    const s = await setup();
    const token = await askDaren(s);
    const [email] = await sentEmails(s.t);
    expect(email.to).toBe("daren@example.com");
    expect(email.text).toContain(`/d/${token}`);
    expect(email.text).not.toContain("/decisions");
    expect(email.text).toContain("no sign-in needed");
    expect(email.text).toContain("If nothing is decided by 1 November 2099, we sign the agency.");
  });

  test("stores only a hash of the token", async () => {
    const s = await setup();
    const token = await askDaren(s);
    const note = await noteOf(s);
    expect(note.decision!.linkTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(note.decision!.linkTokenHash).not.toBe(token);
  });
});

describe("answering from the link, signed out", () => {
  test("shows the question, the default and the deadline, and no member ids", async () => {
    const s = await setup();
    const token = await askDaren(s, { options: ["Sign the agency", "Build in-house", "Ask me Friday"] });
    const view = await s.t.query(api.decisions.getByLink, { token });
    expect(view).toEqual({
      canvasTitle: "Afforrd launch",
      noteText: "Market Afforrd through the agency",
      question: "How do we start marketing Afforrd?",
      dueDate: "2099-11-01",
      defaultOutcome: "We sign the agency",
      options: ["Sign the agency", "Build in-house", "Ask me Friday"],
      deciderName: "Daren",
      requestedBy: "Celine",
      status: "open",
      choice: undefined,
      answeredAt: undefined,
    });
  });

  test("an unknown or malformed token shows nothing", async () => {
    const s = await setup();
    await askDaren(s);
    expect(await s.t.query(api.decisions.getByLink, { token: "0".repeat(64) })).toBeNull();
    expect(await s.t.query(api.decisions.getByLink, { token: "not-a-token" })).toBeNull();
    await expect(s.t.mutation(api.decisions.answerByLink, { token: "0".repeat(64), answer: "approve" })).rejects.toThrow(
      /no longer works/
    );
  });

  test("records the choice against the decision, via link, with the name given", async () => {
    const s = await setup();
    const token = await askDaren(s, { options: ["Sign the agency", "Build in-house", "Ask me Friday"] });
    await s.t.mutation(api.decisions.answerByLink, { token, answer: "choose", choice: "Build in-house", name: "Daren B" });

    const note = await noteOf(s);
    expect(note.evidenceState).toBe("decision");
    expect(note.decision).toMatchObject({
      status: "decided",
      choice: "Build in-house",
      answeredVia: "link",
      answeredByName: "Daren B",
    });

    const history = await s.t.run((ctx) =>
      ctx.db
        .query("noteHistory")
        .withIndex("by_note", (q) => q.eq("noteId", s.noteId))
        .collect()
    );
    const answered = history.find((h) => h.kind === "decision_answered")!;
    expect(answered).toMatchObject({ via: "link", userId: s.daren });
    expect(answered.changes).toContainEqual({ field: "decision.choice", to: "Build in-house" });
    expect(answered.changes).toContainEqual({ field: "decision.answeredByName", to: "Daren B" });

    const toCeline = (await sentEmails(s.t)).filter((e) => e.to === "celine@example.com");
    expect(toCeline.at(-1)!.text).toContain("chose “Build in-house”");
  });

  test("approve and reject work when the request has no options", async () => {
    const s = await setup();
    const token = await askDaren(s);
    await s.t.mutation(api.decisions.answerByLink, { token, answer: "approve" });
    expect((await noteOf(s)).decision).toMatchObject({ status: "approved", answeredVia: "link" });
  });

  test("asking for a change needs a comment and leaves the note as it was", async () => {
    const s = await setup();
    const token = await askDaren(s);
    await expect(s.t.mutation(api.decisions.answerByLink, { token, answer: "change" })).rejects.toThrow(/what should change/);
    await s.t.mutation(api.decisions.answerByLink, { token, answer: "change", comment: "Get the fee breakdown first" });
    const note = await noteOf(s);
    expect(note.decision).toMatchObject({ status: "changes_requested", comment: "Get the fee breakdown first" });
    expect(note.evidenceState).toBe("supported");
  });

  test("only the request's own options are accepted", async () => {
    const s = await setup();
    const token = await askDaren(s, { options: ["Sign the agency", "Build in-house"] });
    await expect(s.t.mutation(api.decisions.answerByLink, { token, answer: "choose", choice: "Hybrid" })).rejects.toThrow(
      /Choose one of the options/
    );
    await expect(s.t.mutation(api.decisions.answerByLink, { token, answer: "approve" })).rejects.toThrow(
      /Choose one of the options/
    );
    expect((await noteOf(s)).decision!.status).toBe("open");
  });

  test("the link expires once the decision is made", async () => {
    const s = await setup();
    const token = await askDaren(s);
    await s.t.mutation(api.decisions.answerByLink, { token, answer: "reject" });
    await expect(s.t.mutation(api.decisions.answerByLink, { token, answer: "approve" })).rejects.toThrow(/already been made/);
    expect(await s.t.query(api.decisions.getByLink, { token })).toMatchObject({ status: "rejected" });
    expect((await noteOf(s)).decision!.status).toBe("rejected");
  });

  test("answering in the app also closes the link", async () => {
    const s = await setup();
    const token = await askDaren(s);
    await s.asDaren.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "approve" });
    await expect(s.t.mutation(api.decisions.answerByLink, { token, answer: "reject" })).rejects.toThrow(/already been made/);
  });

  test("the token is for this one decision: a new request gets a new link", async () => {
    const s = await setup();
    const first = await askDaren(s);
    await s.t.mutation(api.decisions.answerByLink, { token: first, answer: "change", comment: "Ask again with the fees" });
    const second = await askDaren(s);
    expect(second).not.toBe(first);
    expect(await s.t.query(api.decisions.getByLink, { token: first })).toBeNull();
    expect(await s.t.query(api.decisions.getByLink, { token: second })).toMatchObject({ status: "open" });
  });
});

describe("revoking the link", () => {
  test("a new link replaces the old one", async () => {
    const s = await setup();
    const old = await askDaren(s);
    await s.asCeline.mutation(api.decisions.replaceDecisionLink, { noteId: s.noteId });
    const fresh = await latestLinkToken(s.t, "daren@example.com");
    expect(fresh).not.toBe(old);
    expect(await s.t.query(api.decisions.getByLink, { token: old })).toBeNull();
    await expect(s.t.mutation(api.decisions.answerByLink, { token: old, answer: "approve" })).rejects.toThrow(/no longer works/);
    await s.t.mutation(api.decisions.answerByLink, { token: fresh, answer: "approve" });
    expect((await noteOf(s)).decision!.status).toBe("approved");
  });

  test("turning the link off leaves the request open for the app", async () => {
    const s = await setup();
    const token = await askDaren(s);
    await s.asCeline.mutation(api.decisions.replaceDecisionLink, { noteId: s.noteId, off: true });
    expect(await s.t.query(api.decisions.getByLink, { token })).toBeNull();
    const decision = (await noteOf(s)).decision!;
    expect(decision.status).toBe("open");
    expect(decision.linkTokenHash).toBeUndefined();
    await s.asDaren.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "approve" });
  });

  test("only editors can change the link", async () => {
    const s = await setup();
    await askDaren(s);
    await expect(s.asDaren.mutation(api.decisions.replaceDecisionLink, { noteId: s.noteId })).rejects.toThrow(/Forbidden/);
  });

  test("withdrawing the request kills the link", async () => {
    const s = await setup();
    const token = await askDaren(s);
    await s.asCeline.mutation(api.decisions.withdrawDecision, { noteId: s.noteId });
    expect(await s.t.query(api.decisions.getByLink, { token })).toBeNull();
  });

  test("the link stops working if the decider leaves the canvas", async () => {
    const s = await setup();
    const token = await askDaren(s);
    await s.t.run((ctx) => ctx.db.delete(s.darenMembership));
    expect(await s.t.query(api.decisions.getByLink, { token })).toBeNull();
    await expect(s.t.mutation(api.decisions.answerByLink, { token, answer: "approve" })).rejects.toThrow(/no longer works/);
  });
});

describe("asking for a decision", () => {
  test("options must be 2 to 4 distinct choices", async () => {
    const s = await setup();
    const ask = (options: string[]) =>
      s.asCeline.mutation(api.decisions.requestDecision, {
        noteId: s.noteId,
        question: "Which route?",
        deciderId: s.daren,
        dueDate: "2099-11-01",
        options,
      });
    await expect(ask(["Only one"])).rejects.toThrow(/at least two/);
    await expect(ask(["A", "B", "C", "D", "E"])).rejects.toThrow(/at most 4/);
    await expect(ask(["Agency", "agency"])).rejects.toThrow(/different/);
    await ask(["  Agency ", "In-house", ""]);
    expect((await noteOf(s)).decision!.options).toEqual(["Agency", "In-house"]);
  });
});

describe("asking yourself", () => {
  test("emails you the answer link on the first request, like Send a new link does", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.decisions.requestDecision, {
      noteId: s.noteId,
      question: "Do we sign the agency?",
      deciderId: s.celine,
      dueDate: "2099-11-01",
    });
    const first = await latestLinkToken(s.t, "celine@example.com");
    expect(await s.t.query(api.decisions.getByLink, { token: first })).toMatchObject({ status: "open", deciderName: "Celine" });

    await s.asCeline.mutation(api.decisions.replaceDecisionLink, { noteId: s.noteId });
    const second = await latestLinkToken(s.t, "celine@example.com");
    expect(second).not.toBe(first);
    expect(await s.t.query(api.decisions.getByLink, { token: first })).toBeNull();

    await s.t.mutation(api.decisions.answerByLink, { token: second, answer: "approve" });
    expect((await noteOf(s)).evidenceState).toBe("decision");
    // No "you answered your own request" email back to yourself
    expect((await sentEmails(s.t)).filter((e) => e.to === "celine@example.com")).toHaveLength(2);
  });
});

describe("options that put the decision off", () => {
  const options = ["Sign the agency", "Build in-house", "Decide after Roti Day 3"];

  test("choosing one records the answer but leaves the note's evidence state alone", async () => {
    const s = await setup();
    const token = await askDaren(s, { options, deferOptions: ["decide after roti day 3"] });
    const note = await noteOf(s);
    expect(note.decision!.deferOptions).toEqual(["Decide after Roti Day 3"]);
    expect((await sentEmails(s.t)).at(-1)!.text).toContain("Decide after Roti Day 3 (puts it off)");
    expect(await s.t.query(api.decisions.getByLink, { token })).toMatchObject({ deferOptions: ["Decide after Roti Day 3"] });

    await s.t.mutation(api.decisions.answerByLink, { token, answer: "choose", choice: "Decide after Roti Day 3" });
    const answered = await noteOf(s);
    expect(answered.evidenceState).toBe("supported");
    expect(answered.decision).toMatchObject({ status: "decided", choice: "Decide after Roti Day 3", answeredVia: "link" });

    const history = await s.t.run((ctx) =>
      ctx.db
        .query("noteHistory")
        .withIndex("by_note", (q) => q.eq("noteId", s.noteId))
        .collect()
    );
    const entry = history.find((h) => h.kind === "decision_answered")!;
    expect(entry.changes).toContainEqual({ field: "decision.choice", to: "Decide after Roti Day 3" });
    expect(entry.changes).toContainEqual({ field: "decision.deferred", to: "yes" });
    expect(entry.changes.some((c) => c.field === "evidenceState")).toBe(false);

    const toCeline = (await sentEmails(s.t)).filter((e) => e.to === "celine@example.com").at(-1)!;
    expect(toCeline.subject).toContain("deferred your request");
    expect(toCeline.text).toContain("Their answer: Decide after Roti Day 3");
  });

  test("choosing an option that doesn't defer still makes the note a decision", async () => {
    const s = await setup();
    await askDaren(s, { options, deferOptions: ["Decide after Roti Day 3"] });
    await s.asDaren.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "choose", choice: "Build in-house" });
    expect((await noteOf(s)).evidenceState).toBe("decision");
  });

  test("must be among the options, and at least one option must decide", async () => {
    const s = await setup();
    const ask = (extra: { options?: string[]; deferOptions: string[] }) =>
      s.asCeline.mutation(api.decisions.requestDecision, {
        noteId: s.noteId,
        question: "Which route?",
        deciderId: s.daren,
        dueDate: "2099-11-01",
        ...extra,
      });
    await expect(ask({ options, deferOptions: ["Hybrid"] })).rejects.toThrow(/must be one of the options/);
    await expect(ask({ options: ["Later", "Much later"], deferOptions: ["Later", "Much later"] })).rejects.toThrow(
      /At least one option must make the decision/
    );
    await expect(ask({ deferOptions: ["Later"] })).rejects.toThrow(/Only a request with options/);
    expect((await noteOf(s)).decision).toBeUndefined();
  });

  test("requests stored before deferOptions existed answer as before", async () => {
    const s = await setup();
    await askDaren(s, { options: ["Sign the agency", "Build in-house"] });
    expect((await noteOf(s)).decision!.deferOptions).toBeUndefined();
    await s.asDaren.mutation(api.decisions.answerDecision, { noteId: s.noteId, answer: "choose", choice: "Sign the agency" });
    expect((await noteOf(s)).evidenceState).toBe("decision");
  });
});

describe("the public share view", () => {
  test("shows the decision and its default, but not member ids or the link hash", async () => {
    const s = await setup();
    await askDaren(s);
    const view = await s.t.query(api.canvases.getCanvasByPublicToken, { token: "public-token" });
    if (!view?.notes) throw new Error("expected the shared canvas");
    expect(view.notes[0].decision).toEqual({
      question: "How do we start marketing Afforrd?",
      dueDate: "2099-11-01",
      defaultOutcome: "We sign the agency",
      options: undefined,
      status: "open",
      choice: undefined,
      answeredAt: undefined,
      deciderName: "Daren",
    });
  });
});
