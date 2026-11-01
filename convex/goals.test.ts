/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/** A canvas owned by Celine, with Daren as a view-only member, one goal and one note. */
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
  const goalId = await asCeline.mutation(api.goals.addGoal, { canvasId: ids.canvasId, title: "Launch Afforrd" });
  return { t, asCeline, asDaren, goalId, ...ids };
}

async function itemOf(s: Awaited<ReturnType<typeof setup>>, itemId: string) {
  const view = await s.asCeline.query(api.goals.view, { canvasId: s.canvasId });
  return view!.goals.flatMap((g) => g.items).find((i) => i.itemId === itemId)!;
}

describe("items", () => {
  test("move from open to testing to decided to done, and the headline counts them", async () => {
    const s = await setup();
    const itemId = await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Which channel first?" });
    await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Price point" });
    expect((await itemOf(s, itemId)).state).toBe("open");

    await s.asCeline.mutation(api.goals.editItem, { itemId, measure: "Signups per week", passMark: "50" });
    expect((await itemOf(s, itemId)).state).toBe("testing");

    await s.asCeline.mutation(api.goals.editItem, {
      itemId,
      latestResult: { text: "62 signups", verdict: "pass" },
    });
    await s.asCeline.mutation(api.goals.decide, {
      itemId,
      text: "Go with the agency",
      basis: "test",
      reviewDate: "2026-12-01",
    });
    const decided = await itemOf(s, itemId);
    expect(decided.state).toBe("decided");
    expect(decided.decision).toMatchObject({
      text: "Go with the agency",
      basis: "test",
      decidedBy: "Celine",
      reviewDate: "2026-12-01",
      testSnapshot: { resultText: "62 signups", verdict: "pass" },
    });

    await s.asCeline.mutation(api.goals.markDone, { itemId });
    const view = await s.asCeline.query(api.goals.view, { canvasId: s.canvasId });
    expect(view!.goals[0].headline).toBe("Launch Afforrd: 1 open, 0 testing, 0 decided, 1 done.");
    expect(view!.goals[0].reached).toBe(false);
  });

  test("keeps a decide-by date, checks it, and clears it", async () => {
    const s = await setup();
    const itemId = await s.asCeline.mutation(api.goals.addItem, {
      goalId: s.goalId,
      title: "Launch price",
      decideBy: "2026-11-06",
    });
    expect((await itemOf(s, itemId)).decideBy).toBe("2026-11-06");
    await expect(s.asCeline.mutation(api.goals.editItem, { itemId, decideBy: "next week" })).rejects.toThrow(
      /decideBy must be a date/
    );
    await s.asCeline.mutation(api.goals.editItem, { itemId, decideBy: null });
    expect((await itemOf(s, itemId)).decideBy).toBeUndefined();
  });

  test("can go straight from open to decided on a judgment call", async () => {
    const s = await setup();
    const itemId = await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Brand name" });
    await s.asCeline.mutation(api.goals.decide, { itemId, text: "Afforrd", basis: "judgment" });
    const item = await itemOf(s, itemId);
    expect(item.state).toBe("decided");
    expect(item.decision!.reviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("a test basis needs a result first", async () => {
    const s = await setup();
    const itemId = await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Channel" });
    await expect(s.asCeline.mutation(api.goals.decide, { itemId, text: "Agency", basis: "test" })).rejects.toThrow(
      /needs the item's test to have a result/
    );
  });

  test("clearing a test takes a testing item back to open", async () => {
    const s = await setup();
    const itemId = await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Channel" });
    await s.asCeline.mutation(api.goals.editItem, { itemId, measure: "Signups" });
    await s.asCeline.mutation(api.goals.editItem, { itemId, measure: null });
    expect((await itemOf(s, itemId)).state).toBe("open");
  });

  test("reopening keeps the old decision as an earlier one", async () => {
    const s = await setup();
    const itemId = await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Channel" });
    await s.asCeline.mutation(api.goals.decide, { itemId, text: "Agency", basis: "expert" });
    await s.asCeline.mutation(api.goals.reopen, { itemId });
    const item = await itemOf(s, itemId);
    expect(item.state).toBe("open");
    expect(item.decision).toBeNull();
    expect(item.earlierDecisions.map((d) => d.text)).toEqual(["Agency"]);
    await expect(s.asCeline.mutation(api.goals.markDone, { itemId })).rejects.toThrow(/Only a decided item/);
  });

  test("viewers can see but not change", async () => {
    const s = await setup();
    await expect(s.asDaren.mutation(api.goals.addItem, { goalId: s.goalId, title: "Sneaky" })).rejects.toThrow(
      /Forbidden/
    );
    const view = await s.asDaren.query(api.goals.view, { canvasId: s.canvasId });
    expect(view!.role).toBe("viewer");
    expect(view!.goals.map((g) => g.title)).toEqual(["Launch Afforrd"]);
  });

  test("a goal with items can't be deleted", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Channel" });
    await expect(s.asCeline.mutation(api.goals.removeGoal, { goalId: s.goalId })).rejects.toThrow(/still has items/);
  });
});

describe("looking back", () => {
  test("is due on the review date once the item is done, and feeds the basis stats", async () => {
    const s = await setup();
    const itemId = await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Channel" });
    await s.asCeline.mutation(api.goals.decide, {
      itemId,
      text: "Agency",
      basis: "judgment",
      reviewDate: "2020-01-01",
    });
    await expect(s.asCeline.mutation(api.goals.lookBack, { itemId, outcome: "yes" })).rejects.toThrow(
      /once the item is done/
    );
    await s.asCeline.mutation(api.goals.markDone, { itemId });
    let view = await s.asCeline.query(api.goals.view, { canvasId: s.canvasId });
    expect(view!.lookBacksDue.map((i) => i.itemId)).toEqual([itemId]);

    await s.asCeline.mutation(api.goals.lookBack, { itemId, outcome: "partly", note: "Slow start" });
    view = await s.asCeline.query(api.goals.view, { canvasId: s.canvasId });
    expect(view!.lookBacksDue).toEqual([]);
    expect(view!.basisStats).toEqual({ judgment: { yes: 0, no: 0, partly: 1 } });
    expect(view!.goals[0].reached).toBe(true);
  });
});

describe("converting a note", () => {
  test("carries its test and driver over and links the note", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.patch(s.noteId, { measure: "Leads per week", ownerId: s.daren })
    );
    const itemId = await s.asCeline.mutation(api.goals.convertNote, { noteId: s.noteId, goalId: s.goalId });
    const item = await itemOf(s, itemId);
    expect(item).toMatchObject({
      title: "Market Afforrd through the agency",
      state: "testing",
      measure: "Leads per week",
      driver: "Daren",
      contextNotes: [{ noteId: s.noteId, text: "Market Afforrd through the agency" }],
    });
    await expect(
      s.asCeline.mutation(api.goals.convertNote, { noteId: s.noteId, goalId: s.goalId })
    ).rejects.toThrow(/already an item/);
  });

  test("turns an answered decision request into the decision record", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.patch(s.noteId, {
        decision: {
          question: "Which channel?",
          deciderId: s.daren,
          dueDate: "2026-11-30",
          options: ["Agency", "In-house"],
          requestedBy: s.celine,
          requestedAt: Date.now(),
          status: "decided",
          choice: "Agency",
          comment: "Cheaper to start",
          answeredAt: Date.now(),
        },
      })
    );
    const itemId = await s.asCeline.mutation(api.goals.convertNote, { noteId: s.noteId, goalId: s.goalId });
    const item = await itemOf(s, itemId);
    expect(item.state).toBe("decided");
    expect(item.decision).toMatchObject({
      text: "Which channel? Agency",
      basis: "judgment",
      basisNote: "Cheaper to start",
      decidedBy: "Daren",
    });
  });

  test("leaves a put-off answer undecided", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.patch(s.noteId, {
        decision: {
          question: "Which channel?",
          deciderId: s.daren,
          dueDate: "2026-11-30",
          options: ["Agency", "Decide after day 3"],
          deferOptions: ["Decide after day 3"],
          requestedBy: s.celine,
          requestedAt: Date.now(),
          status: "decided",
          choice: "Decide after day 3",
          answeredAt: Date.now(),
        },
      })
    );
    const itemId = await s.asCeline.mutation(api.goals.convertNote, { noteId: s.noteId, goalId: s.goalId });
    expect((await itemOf(s, itemId)).state).toBe("open");
  });
});

describe("public link", () => {
  test("shows goals read-only without an account", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.goals.addItem, { goalId: s.goalId, title: "Channel" });
    const view = await s.t.query(api.goals.viewByPublicToken, { token: "public-token" });
    expect(view!.role).toBeNull();
    expect(view!.goals[0].headline).toBe("Launch Afforrd: 1 open, 0 testing, 0 decided, 0 done.");
    expect(await s.t.query(api.goals.viewByPublicToken, { token: "wrong" })).toBeNull();
  });
});
