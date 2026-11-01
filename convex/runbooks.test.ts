/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { blockStage, runStats } from "./lib/runbookModel";

const modules = import.meta.glob("./**/*.ts");

/** A canvas owned by Celine, Daren view-only, with two notes in channels and one in customer segments. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const celine = await ctx.db.insert("users", { name: "Celine", email: "celine@example.com" });
    const daren = await ctx.db.insert("users", { name: "Daren", email: "daren@example.com" });
    const workspaceId = await ctx.db.insert("workspaces", { name: "Afforrd", ownerId: celine });
    const canvasId = await ctx.db.insert("canvases", {
      workspaceId,
      title: "Kingston events",
      status: "active",
      publicViewToken: "public-token",
      isPublicViewEnabled: true,
      createdBy: celine,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("canvasMembers", { canvasId, userId: celine, role: "owner" });
    await ctx.db.insert("canvasMembers", { canvasId, userId: daren, role: "viewer" });
    const note = (block: "channels" | "customerSegments", content: string, order: number) =>
      ctx.db.insert("notes", {
        canvasId,
        block,
        content,
        order,
        evidenceState: "assumption",
        createdBy: celine,
        updatedAt: Date.now(),
      });
    const referrals = await note("channels", "We reach organisers through referrals", 0);
    const events = await note("channels", "Follow up after every event", 1);
    const organisers = await note("customerSegments", "Event organisers in Kingston", 0);
    return { celine, daren, canvasId, referrals, events, organisers };
  });
  const asCeline = t.withIdentity({ subject: `${ids.celine}|session` });
  const asDaren = t.withIdentity({ subject: `${ids.daren}|session` });
  return { t, asCeline, asDaren, ...ids };
}

async function viewOf(s: Awaited<ReturnType<typeof setup>>) {
  return (await s.asCeline.query(api.runbooks.view, { canvasId: s.canvasId }))!;
}

async function stageOfNote(s: Awaited<ReturnType<typeof setup>>, noteId: string) {
  return (await viewOf(s)).noteStages.find((n) => n.noteId === noteId)!.stage;
}

describe("stages", () => {
  test("notes start as guesses; a box is as runnable as its least runnable note", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.referrals, stage: "repeatable" });
    const view = await viewOf(s);
    expect(view.blockStages.find((b) => b.block === "channels")!.stage).toBe("guess");
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.events, stage: "tested" });
    expect((await viewOf(s)).blockStages.find((b) => b.block === "channels")!.stage).toBe("tested");
  });

  test("stage changes are kept in the note's history", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.referrals, stage: "tested" });
    const history = await s.asCeline.query(api.notes.getNoteHistory, { noteId: s.referrals });
    expect(JSON.stringify(history)).toContain("tested");
  });
});

describe("runbooks", () => {
  test("can't go live while a linked note is still a guess", async () => {
    const s = await setup();
    const runbookId = await s.asCeline.mutation(api.runbooks.fromNote, { noteId: s.referrals });
    await s.asCeline.mutation(api.runbooks.editRunbook, { runbookId, steps: ["Ask happy organisers for one intro"] });
    await expect(s.asCeline.mutation(api.runbooks.setStatus, { runbookId, status: "live" })).rejects.toThrow(
      /Don't scale a guess/
    );
  });

  test("needs steps before it goes live", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.referrals, stage: "repeatable" });
    const runbookId = await s.asCeline.mutation(api.runbooks.fromNote, { noteId: s.referrals });
    await expect(s.asCeline.mutation(api.runbooks.setStatus, { runbookId, status: "live" })).rejects.toThrow(
      /Add the steps/
    );
  });

  test("going live codifies its notes; retiring drops them back to repeatable", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.referrals, stage: "repeatable" });
    const runbookId = await s.asCeline.mutation(api.runbooks.fromNote, { noteId: s.referrals });
    await s.asCeline.mutation(api.runbooks.editRunbook, { runbookId, steps: ["Ask for an intro", "Send the deck"] });
    await s.asCeline.mutation(api.runbooks.setStatus, { runbookId, status: "live" });
    expect(await stageOfNote(s, s.referrals)).toBe("codified");

    await expect(
      s.asCeline.mutation(api.notes.updateNote, { noteId: s.referrals, stage: "tested" })
    ).rejects.toThrow(/codified by the live runbook/);

    await s.asCeline.mutation(api.runbooks.setStatus, { runbookId, status: "retired" });
    expect(await stageOfNote(s, s.referrals)).toBe("repeatable");
  });

  test("unlinking or deleting a live runbook un-codifies only notes with no other live runbook", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.referrals, stage: "repeatable" });
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.events, stage: "repeatable" });
    const a = await s.asCeline.mutation(api.runbooks.addRunbook, {
      canvasId: s.canvasId,
      title: "Referral ask",
      steps: ["Ask"],
      noteIds: [s.referrals, s.events],
    });
    const b = await s.asCeline.mutation(api.runbooks.addRunbook, {
      canvasId: s.canvasId,
      title: "Event follow-up",
      steps: ["Email within a day"],
      noteIds: [s.events],
    });
    await s.asCeline.mutation(api.runbooks.setStatus, { runbookId: a, status: "live" });
    await s.asCeline.mutation(api.runbooks.setStatus, { runbookId: b, status: "live" });

    await s.asCeline.mutation(api.runbooks.editRunbook, { runbookId: a, noteIds: [s.referrals] });
    expect(await stageOfNote(s, s.events)).toBe("codified"); // still codified by b

    await s.asCeline.mutation(api.runbooks.removeRunbook, { runbookId: b });
    expect(await stageOfNote(s, s.events)).toBe("repeatable");
    expect(await stageOfNote(s, s.referrals)).toBe("codified");
  });

  test("linking a guess to a live runbook is refused", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.referrals, stage: "repeatable" });
    const runbookId = await s.asCeline.mutation(api.runbooks.addRunbook, {
      canvasId: s.canvasId,
      title: "Referral ask",
      steps: ["Ask"],
      noteIds: [s.referrals],
    });
    await s.asCeline.mutation(api.runbooks.setStatus, { runbookId, status: "live" });
    await expect(
      s.asCeline.mutation(api.runbooks.editRunbook, { runbookId, noteIds: [s.referrals, s.organisers] })
    ).rejects.toThrow(/Don't scale a guess/);
  });

  test("a decided item becomes a draft runbook resting on its decision", async () => {
    const s = await setup();
    const goalId = await s.asCeline.mutation(api.goals.addGoal, { canvasId: s.canvasId, title: "Launch" });
    const itemId = await s.asCeline.mutation(api.goals.addItem, { goalId, title: "Fallback supplier?" });
    await expect(s.asCeline.mutation(api.runbooks.fromItem, { itemId })).rejects.toThrow(/Decide the item/);
    await s.asCeline.mutation(api.goals.decide, { itemId, text: "Use Acme as fallback", basis: "judgment" });
    const runbookId = await s.asCeline.mutation(api.runbooks.fromItem, { itemId });
    const runbook = (await viewOf(s)).runbooks.find((r) => r.runbookId === runbookId)!;
    expect(runbook).toMatchObject({
      title: "Use Acme as fallback",
      status: "draft",
      items: [{ title: "Fallback supplier?", decision: "Use Acme as fallback" }],
    });
  });

  test("SOPs group runbooks; deleting one leaves its runbooks ungrouped", async () => {
    const s = await setup();
    const sopId = await s.asCeline.mutation(api.runbooks.addSop, { canvasId: s.canvasId, title: "Acquisition" });
    const runbookId = await s.asCeline.mutation(api.runbooks.addRunbook, { canvasId: s.canvasId, title: "Referral ask", sopId });
    expect((await viewOf(s)).runbooks[0].sopId).toBe(sopId);
    await s.asCeline.mutation(api.runbooks.removeSop, { sopId });
    const view = await viewOf(s);
    expect(view.sops).toEqual([]);
    expect(view.runbooks.find((r) => r.runbookId === runbookId)!.sopId).toBeNull();
  });

  test("viewers can see but not edit", async () => {
    const s = await setup();
    await expect(
      s.asDaren.mutation(api.runbooks.addRunbook, { canvasId: s.canvasId, title: "Sneaky" })
    ).rejects.toThrow(/Forbidden/);
    expect((await s.asDaren.query(api.runbooks.view, { canvasId: s.canvasId }))!.role).toBe("viewer");
  });
});

describe("runs", () => {
  async function liveRunbook(s: Awaited<ReturnType<typeof setup>>) {
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.events, stage: "repeatable" });
    const runbookId = await s.asCeline.mutation(api.runbooks.addRunbook, {
      canvasId: s.canvasId,
      title: "Event follow-up",
      steps: ["Export attendees", "Email within a day", "Book a call"],
      noteIds: [s.events],
    });
    await s.asCeline.mutation(api.runbooks.setStatus, { runbookId, status: "live" });
    return runbookId;
  }

  test("only live runbooks can be run, and a viewer can log a run", async () => {
    const s = await setup();
    const draft = await s.asCeline.mutation(api.runbooks.addRunbook, { canvasId: s.canvasId, title: "Draft" });
    await expect(s.asCeline.mutation(api.runbooks.logRunbookRun, { runbookId: draft, outcome: "yes" })).rejects.toThrow(
      /Only a live runbook/
    );
    const runbookId = await liveRunbook(s);
    await s.asDaren.mutation(api.runbooks.logRunbookRun, { runbookId, outcome: "yes", numbers: "12 leads, 3 calls" });
    const r = (await viewOf(s)).runbooks.find((x) => x.runbookId === runbookId)!;
    expect(r.stats).toMatchObject({ total: 1, yes: 1 });
    expect(r.recentRuns[0]).toMatchObject({ ranBy: "Daren", numbers: "12 leads, 3 calls" });
  });

  test("checks the failed step", async () => {
    const s = await setup();
    const runbookId = await liveRunbook(s);
    await expect(
      s.asCeline.mutation(api.runbooks.logRunbookRun, { runbookId, outcome: "no", failedStep: 4 })
    ).rejects.toThrow(/from 1 to 3/);
    await expect(
      s.asCeline.mutation(api.runbooks.logRunbookRun, { runbookId, outcome: "yes", failedStep: 2 })
    ).rejects.toThrow(/no failed step/);
  });

  test("failing twice at the same step flags the runbook", async () => {
    const s = await setup();
    const runbookId = await liveRunbook(s);
    await s.asCeline.mutation(api.runbooks.logRunbookRun, { runbookId, outcome: "no", failedStep: 3 });
    await s.asCeline.mutation(api.runbooks.logRunbookRun, { runbookId, outcome: "yes" });
    expect((await viewOf(s)).attention).toEqual([]);
    await s.asCeline.mutation(api.runbooks.logRunbookRun, { runbookId, outcome: "partly", failedStep: 3 });
    const view = await viewOf(s);
    expect(view.attention.map((r) => r.runbookId)).toEqual([runbookId]);
    expect(view.attention[0].stats.keepsFailingAt).toBe(3);
  });
});

describe("public link", () => {
  test("shows runbooks read-only without an account", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.runbooks.addRunbook, { canvasId: s.canvasId, title: "Referral ask" });
    const view = await s.t.query(api.runbooks.viewByPublicToken, { token: "public-token" });
    expect(view!.role).toBeNull();
    expect(view!.runbooks.map((r) => r.title)).toEqual(["Referral ask"]);
  });
});

describe("model helpers", () => {
  test("blockStage and runStats", () => {
    expect(blockStage([])).toBeNull();
    expect(blockStage([{ stage: "codified" }, {}])).toBe("guess");
    expect(blockStage([{ stage: "codified" }, { stage: "repeatable" }])).toBe("repeatable");
    const stats = runStats([
      { outcome: "no", failedStep: 2, at: 3 },
      { outcome: "partly", failedStep: 2, at: 2 },
      { outcome: "yes", at: 1 },
    ]);
    expect(stats).toMatchObject({ total: 3, yes: 1, no: 1, partly: 1, lastRunAt: 3, keepsFailingAt: 2 });
  });
});
