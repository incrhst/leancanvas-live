/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { MAX_PENDING_PER_NOTE, RESULTS_PER_WINDOW } from "./lib/resultLinks";

const modules = import.meta.glob("./**/*.ts");

/**
 * A canvas run by Ola (the operator, owner), with Dev driving a note that carries a test and
 * Vee as a view-only member.
 */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ola = await ctx.db.insert("users", { name: "Ola", email: "ola@example.com" });
    const dev = await ctx.db.insert("users", { name: "Dev", email: "dev@example.com" });
    const vee = await ctx.db.insert("users", { name: "Vee", email: "vee@example.com" });
    const workspaceId = await ctx.db.insert("workspaces", { name: "Shop", ownerId: ola });
    const canvasId = await ctx.db.insert("canvases", {
      workspaceId,
      title: "Shop launch",
      status: "active",
      isPublicViewEnabled: false,
      createdBy: ola,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("canvasMembers", { canvasId, userId: ola, role: "owner" });
    await ctx.db.insert("canvasMembers", { canvasId, userId: dev, role: "viewer" });
    await ctx.db.insert("canvasMembers", { canvasId, userId: vee, role: "viewer" });
    const noteId = await ctx.db.insert("notes", {
      canvasId,
      block: "channels",
      content: "Small shops sign up from the WhatsApp post",
      order: 0,
      evidenceState: "assumption",
      measure: "sign-ups from the post",
      passMark: "at least 20 in two weeks",
      reviewDate: "2099-11-01",
      ownerId: dev,
      createdBy: ola,
      updatedAt: Date.now(),
    });
    return { ola, dev, vee, canvasId, noteId };
  });
  const asOla = t.withIdentity({ subject: `${ids.ola}|session` });
  const asDev = t.withIdentity({ subject: `${ids.dev}|session` });
  const asVee = t.withIdentity({ subject: `${ids.vee}|session` });
  return { t, asOla, asDev, asVee, ...ids };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function sentEmails(t: Setup["t"]) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs
    .filter((j) => j.name.startsWith("email"))
    .map((j) => j.args[0] as { to: string; subject: string; text: string });
}

async function shareLink(s: Setup) {
  const token = await s.asOla.mutation(api.resultLinks.replaceLink, { noteId: s.noteId });
  if (!token) throw new Error("No token");
  return token;
}

async function noteOf(s: Setup) {
  return (await s.t.run((ctx) => ctx.db.get(s.noteId)))!;
}

async function historyKinds(s: Setup) {
  const rows = await s.asOla.query(api.notes.getNoteHistory, { noteId: s.noteId });
  return rows.map((r) => ({ kind: r.kind, via: r.via, changes: r.changes }));
}

describe("the shareable result link", () => {
  test("only editors can make one, and it stays copyable from the note", async () => {
    const s = await setup();
    await expect(s.asVee.mutation(api.resultLinks.replaceLink, { noteId: s.noteId })).rejects.toThrow(/Editor/);
    const token = await shareLink(s);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const view = await s.asOla.query(api.resultLinks.forNote, { noteId: s.noteId });
    expect(view).toEqual({ token, pending: [] });
    await expect(s.asVee.query(api.resultLinks.forNote, { noteId: s.noteId })).rejects.toThrow(/Editor/);
  });

  test("shows the measure and pass mark, and nothing that identifies members", async () => {
    const s = await setup();
    const token = await shareLink(s);
    const view = await s.t.query(api.resultLinks.getByLink, { token });
    expect(view).toEqual({
      kind: "note",
      canvasTitle: "Shop launch",
      noteText: "Small shops sign up from the WhatsApp post",
      measure: "sign-ups from the post",
      passMark: "at least 20 in two weeks",
      reviewDate: "2099-11-01",
      personName: "Ola",
    });
  });

  test("a new link kills the old one, and turning it off kills both", async () => {
    const s = await setup();
    const first = await shareLink(s);
    const second = await shareLink(s);
    expect(await s.t.query(api.resultLinks.getByLink, { token: first })).toBeNull();
    expect(await s.t.query(api.resultLinks.getByLink, { token: second })).not.toBeNull();
    await expect(s.t.mutation(api.resultLinks.submitByLink, { token: first, text: "12" })).rejects.toThrow(
      /no longer works/
    );

    await s.asOla.mutation(api.resultLinks.replaceLink, { noteId: s.noteId, off: true });
    expect(await s.t.query(api.resultLinks.getByLink, { token: second })).toBeNull();
    expect((await s.asOla.query(api.resultLinks.forNote, { noteId: s.noteId }))!.token).toBeNull();
  });

  test("stops working when whoever made it is no longer an editor", async () => {
    const s = await setup();
    const token = await shareLink(s);
    await s.t.run(async (ctx) => {
      const row = await ctx.db
        .query("canvasMembers")
        .withIndex("by_canvas_user", (q) => q.eq("canvasId", s.canvasId).eq("userId", s.ola))
        .unique();
      await ctx.db.patch(row!._id, { role: "viewer" });
      // The canvas creator always counts as owner, so hand the canvas to someone else too
      await ctx.db.patch(s.canvasId, { createdBy: s.vee });
    });
    expect(await s.t.query(api.resultLinks.getByLink, { token })).toBeNull();
  });

  test("rejects junk tokens without looking anything up", async () => {
    const s = await setup();
    expect(await s.t.query(api.resultLinks.getByLink, { token: "nope" })).toBeNull();
    expect(await s.t.query(api.resultLinks.getByLink, { token: "a".repeat(64) })).toBeNull();
  });
});

describe("sending a result from the link, signed out", () => {
  test("waits on the note without changing it, records history and tells the operator", async () => {
    const s = await setup();
    const token = await shareLink(s);
    const before = await noteOf(s);
    const result = await s.t.mutation(api.resultLinks.submitByLink, {
      token,
      text: "  23 sign-ups  ",
      verdict: "pass",
      name: "Shop assistant",
    });
    expect(result).toEqual({ status: "sent" });

    const note = await noteOf(s);
    expect(note.latestResult).toBeUndefined();
    expect(note.evidenceState).toBe(before.evidenceState);

    const view = await s.asOla.query(api.resultLinks.forNote, { noteId: s.noteId });
    expect(view!.pending).toHaveLength(1);
    expect(view!.pending[0]).toMatchObject({ text: "23 sign-ups", verdict: "pass", name: "Shop assistant" });

    const [row] = await historyKinds(s);
    expect(row).toMatchObject({ kind: "result_submitted", via: "link" });
    expect(row.changes).toEqual([
      { field: "result.text", to: "23 sign-ups" },
      { field: "result.verdict", to: "pass" },
      { field: "result.name", to: "Shop assistant" },
    ]);

    const emails = await sentEmails(s.t);
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("ola@example.com");
    expect(emails[0].subject).toBe("New result via link: sign-ups from the post");
    expect(emails[0].text).toContain("Shop assistant sent a test result");
    expect(emails[0].text).toContain("Result: 23 sign-ups (they say: pass)");
    expect(emails[0].text).toContain(`?note=${s.noteId}`);
    expect(emails[0].text).not.toMatch(/\b(client|owner)\b/i);
  });

  test("needs some text, and keeps it short", async () => {
    const s = await setup();
    const token = await shareLink(s);
    await expect(s.t.mutation(api.resultLinks.submitByLink, { token, text: "   " })).rejects.toThrow(/Type the result/);
    await expect(s.t.mutation(api.resultLinks.submitByLink, { token, text: "x".repeat(281) })).rejects.toThrow(
      /under 280/
    );
    await expect(s.t.mutation(api.resultLinks.submitByLink, { token, nothingNew: true })).rejects.toThrow();
  });

  test("dates a result by the sender's calendar, but not far from today", async () => {
    const s = await setup();
    const token = await shareLink(s);
    await s.t.mutation(api.resultLinks.submitByLink, { token, text: "18", date: "2001-01-01" });
    const [pending] = (await s.asOla.query(api.resultLinks.forNote, { noteId: s.noteId }))!.pending;
    expect(pending.date).toBe(new Date().toISOString().slice(0, 10));
  });

  test(`takes at most ${RESULTS_PER_WINDOW} results an hour per link`, async () => {
    const s = await setup();
    const token = await shareLink(s);
    for (let i = 0; i < RESULTS_PER_WINDOW; i++) {
      await s.t.mutation(api.resultLinks.submitByLink, { token, text: `${i}` });
    }
    await expect(s.t.mutation(api.resultLinks.submitByLink, { token, text: "one more" })).rejects.toThrow(
      /last hour/
    );
    // A fresh window lets it through again
    await s.t.run(async (ctx) => {
      const link = await ctx.db.query("resultLinks").first();
      await ctx.db.patch(link!._id, { windowStart: Date.now() - 2 * 60 * 60 * 1000 });
    });
    await s.t.mutation(api.resultLinks.submitByLink, { token, text: "later" });
  });

  test(`stops taking results once ${MAX_PENDING_PER_NOTE} are waiting on the note`, async () => {
    const s = await setup();
    const token = await shareLink(s);
    await s.t.run(async (ctx) => {
      const link = (await ctx.db.query("resultLinks").first())!;
      for (let i = 0; i < MAX_PENDING_PER_NOTE; i++) {
        await ctx.db.insert("resultSubmissions", {
          canvasId: s.canvasId,
          noteId: s.noteId,
          linkId: link._id,
          text: `${i}`,
          date: "2026-10-19",
          status: "pending",
        });
      }
    });
    await expect(s.t.mutation(api.resultLinks.submitByLink, { token, text: "21" })).rejects.toThrow(/waiting/);
  });
});

describe("the operator checks a result sent from a link", () => {
  async function sent(s: Setup) {
    const token = await shareLink(s);
    await s.t.mutation(api.resultLinks.submitByLink, { token, text: "23 sign-ups", verdict: "pass", name: "Sam" });
    const [pending] = (await s.asOla.query(api.resultLinks.forNote, { noteId: s.noteId }))!.pending;
    return pending._id;
  }

  test("accepting makes it the latest result, marked via link, and leaves the evidence state alone", async () => {
    const s = await setup();
    const id = await sent(s);
    await expect(s.asVee.mutation(api.resultLinks.accept, { submissionId: id })).rejects.toThrow(/Editor/);
    await s.asOla.mutation(api.resultLinks.accept, { submissionId: id });

    const note = await noteOf(s);
    expect(note.latestResult).toMatchObject({ text: "23 sign-ups", verdict: "pass", via: "link", byName: "Sam" });
    expect(note.evidenceState).toBe("assumption");
    expect((await s.asOla.query(api.resultLinks.forNote, { noteId: s.noteId }))!.pending).toEqual([]);

    const [row] = await historyKinds(s);
    expect(row).toMatchObject({ kind: "result_accepted", via: "ui" });
    expect(row.changes).toEqual(
      expect.arrayContaining([
        { field: "latestResult.text", to: "23 sign-ups" },
        { field: "latestResult.verdict", to: "pass" },
        { field: "result.name", to: "Sam" },
      ])
    );
    expect(row.changes.some((c) => c.field === "evidenceState")).toBe(false);

    await expect(s.asOla.mutation(api.resultLinks.accept, { submissionId: id })).rejects.toThrow(/already/);
  });

  test("the operator can change the sender's verdict on the way in", async () => {
    const s = await setup();
    const id = await sent(s);
    await s.asOla.mutation(api.resultLinks.accept, { submissionId: id, verdict: "inconclusive" });
    expect((await noteOf(s)).latestResult!.verdict).toBe("inconclusive");
  });

  test("rejecting drops it and the note doesn't change", async () => {
    const s = await setup();
    const id = await sent(s);
    await s.asOla.mutation(api.resultLinks.reject, { submissionId: id, reason: "Counted twice" });
    const note = await noteOf(s);
    expect(note.latestResult).toBeUndefined();
    const [row] = await s.asOla.query(api.notes.getNoteHistory, { noteId: s.noteId });
    expect(row).toMatchObject({ kind: "result_rejected", reason: "Counted twice" });
    expect((await s.asOla.query(api.resultLinks.forNote, { noteId: s.noteId }))!.pending).toEqual([]);
  });

  test("deleting the note removes its links and waiting results", async () => {
    const s = await setup();
    await sent(s);
    await s.asOla.mutation(api.notes.deleteNote, { noteId: s.noteId });
    const left = await s.t.run(async (ctx) => ({
      links: (await ctx.db.query("resultLinks").collect()).length,
      results: (await ctx.db.query("resultSubmissions").collect()).length,
    }));
    expect(left).toEqual({ links: 0, results: 0 });
  });
});

describe("answering the weekly check-in from its emailed link", () => {
  async function checkInToken(s: Setup) {
    await s.asOla.mutation(api.checkIns.sendNow, { canvasId: s.canvasId });
    const email = (await sentEmails(s.t)).find((e) => e.to === "dev@example.com");
    const match = email?.text.match(/\/r\/([0-9a-f]{64})/);
    if (!match) throw new Error("No check-in link emailed to Dev");
    return { token: match[1], email: email! };
  }

  test("the email carries one no-sign-in link per question, and keeps the signed-in page", async () => {
    const s = await setup();
    const { email } = await checkInToken(s);
    expect(email.text).toContain("- Small shops sign up from the WhatsApp post");
    expect(email.text).toContain("Answer from your phone, no sign-in:");
    expect(email.text).toContain("/check-in");
  });

  test("the link shows the check-in for the driver and keeps no token on file", async () => {
    const s = await setup();
    const { token } = await checkInToken(s);
    const view = await s.t.query(api.resultLinks.getByLink, { token });
    expect(view).toMatchObject({ kind: "check_in", personName: "Dev", measure: "sign-ups from the post" });
    const link = await s.t.run(async (ctx) => await ctx.db.query("resultLinks").first());
    expect(link!.token).toBeUndefined();
  });

  test("nothing new answers the question and kills the link", async () => {
    const s = await setup();
    const { token } = await checkInToken(s);
    expect(await s.t.mutation(api.resultLinks.submitByLink, { token, nothingNew: true })).toEqual({
      status: "nothing_new",
    });
    expect(await s.asDev.query(api.checkIns.myPending, {})).toEqual([]);
    const [row] = await historyKinds(s);
    expect(row).toMatchObject({ kind: "check_in", via: "link", changes: [{ field: "checkIn", to: "no new evidence" }] });
    expect(await s.t.query(api.resultLinks.getByLink, { token })).toBeNull();
  });

  test("a result waits for the operator, answers the question, and kills the link", async () => {
    const s = await setup();
    const { token } = await checkInToken(s);
    await s.t.mutation(api.resultLinks.submitByLink, { token, text: "9 so far" });
    expect((await noteOf(s)).latestResult).toBeUndefined();
    expect((await s.asOla.query(api.resultLinks.forNote, { noteId: s.noteId }))!.pending).toHaveLength(1);
    expect(await s.asDev.query(api.checkIns.myPending, {})).toEqual([]);
    const notice = (await sentEmails(s.t)).at(-1)!;
    expect(notice.to).toBe("ola@example.com");
    await expect(s.t.mutation(api.resultLinks.submitByLink, { token, text: "again" })).rejects.toThrow(
      /no longer works/
    );
  });

  test("answering signed in kills the emailed link too", async () => {
    const s = await setup();
    const { token } = await checkInToken(s);
    await s.asDev.mutation(api.checkIns.answer, { noteId: s.noteId, hasEvidence: false });
    expect(await s.t.query(api.resultLinks.getByLink, { token })).toBeNull();
  });
});
