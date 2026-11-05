/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { sha256Hex } from "./lib/auth";
import { DAY_MS } from "./lib/billing";

const modules = import.meta.glob("./**/*.ts");

const ADMIN_TOKEN = "admin-access-token";
const DRIVER_TOKEN = "driver-access-token";

/** Two canvases created by Celine, with Daren as a view-only member of the first, and an admin. */
async function setup() {
  const t = convexTest(schema, modules);
  process.env.ADMIN_EMAILS = "admin@example.com";
  const ids = await t.run(async (ctx) => {
    const celine = await ctx.db.insert("users", { name: "Celine", email: "celine@example.com" });
    const daren = await ctx.db.insert("users", { name: "Daren", email: "daren@example.com" });
    const admin = await ctx.db.insert("users", { name: "Admin", email: "admin@example.com" });
    const workspaceId = await ctx.db.insert("workspaces", { name: "Afforrd", ownerId: celine });
    const canvas = async (title: string) => {
      const canvasId = await ctx.db.insert("canvases", {
        workspaceId,
        title,
        status: "active",
        publicViewToken: crypto.randomUUID(),
        isPublicViewEnabled: false,
        createdBy: celine,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("canvasMembers", { canvasId, userId: celine, role: "owner" });
      const noteId = await ctx.db.insert("notes", {
        canvasId,
        block: "channels",
        content: "Market through the agency",
        order: 0,
        evidenceState: "assumption",
        createdBy: celine,
        updatedAt: Date.now(),
      });
      return { canvasId, noteId };
    };
    const first = await canvas("Afforrd launch");
    const second = await canvas("Afforrd Trinidad");
    await ctx.db.insert("canvasMembers", { canvasId: first.canvasId, userId: daren, role: "viewer" });
    for (const [userId, token] of [
      [admin, ADMIN_TOKEN],
      [celine, DRIVER_TOKEN],
    ] as const) {
      await ctx.db.insert("oauthTokens", {
        accessTokenHash: await sha256Hex(token),
        refreshTokenHash: await sha256Hex(`${token}-refresh`),
        clientId: "claude",
        userId,
        accessExpiresAt: Date.now() + DAY_MS,
      });
    }
    return { celine, daren, first, second };
  });
  const asCeline = t.withIdentity({ subject: `${ids.celine}|session` });
  const asDaren = t.withIdentity({ subject: `${ids.daren}|session` });
  return { t, asCeline, asDaren, ...ids };
}

const planOf = (t: ReturnType<typeof convexTest>, canvasId: Id<"canvases">) =>
  t.run(async (ctx) => (await ctx.db.get(canvasId))?.plan ?? null);

/** Moves a canvas's trial end into the past and runs the scheduled check. */
async function endTrial(t: ReturnType<typeof convexTest>, canvasId: Id<"canvases">) {
  await t.run(async (ctx) => {
    const canvas = (await ctx.db.get(canvasId))!;
    await ctx.db.patch(canvasId, { plan: { ...canvas.plan!, trialEndsAt: Date.now() - 1000 } });
  });
  await t.mutation(internal.billing.checkPlan, { canvasId });
}

describe("going live", () => {
  test("a free canvas stays free while it's only notes", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, content: "Market through radio" });
    expect(await planOf(s.t, s.first.canvasId)).toBeNull();
  });

  test("the first test starts a 30-day trial", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, measure: "Sign-ups per week" });
    const plan = await planOf(s.t, s.first.canvasId);
    expect(plan?.status).toBe("trial");
    expect(plan!.trialEndsAt! - plan!.liveSince).toBe(30 * DAY_MS);
  });

  test("clearing a test doesn't make a canvas live", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, measure: null });
    expect(await planOf(s.t, s.first.canvasId)).toBeNull();
  });

  test("a second live plan needs paying for once the trial is used", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.canvases.updateCanvasMeta, { canvasId: s.first.canvasId, launchDate: "2026-11-02" });
    await expect(
      s.asCeline.mutation(api.snapshots.createSnapshot, { canvasId: s.second.canvasId, label: "Day 0" })
    ).rejects.toThrow(/PLAN_REQUIRED/);
    expect(await planOf(s.t, s.second.canvasId)).toBeNull();
  });
});

describe("a paused plan", () => {
  async function pausedWithDecision() {
    const s = await setup();
    await s.asCeline.mutation(api.decisions.requestDecision, {
      noteId: s.first.noteId,
      question: "Go with the agency?",
      deciderId: s.daren,
      dueDate: "2026-12-01",
    });
    await endTrial(s.t, s.first.canvasId);
    return s;
  }

  test("pauses when the trial ends", async () => {
    const s = await pausedWithDecision();
    expect((await planOf(s.t, s.first.canvasId))?.status).toBe("paused");
  });

  test("stops tests, snapshots and check-ins", async () => {
    const s = await pausedWithDecision();
    await expect(
      s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, passMark: "50 a week" })
    ).rejects.toThrow(/free trial of this plan has ended/);
    await expect(
      s.asCeline.mutation(api.snapshots.createSnapshot, { canvasId: s.first.canvasId, label: "Day 30" })
    ).rejects.toThrow(/PLAN_REQUIRED/);
    await expect(s.asCeline.mutation(api.checkIns.sendNow, { canvasId: s.first.canvasId })).rejects.toThrow(
      /PLAN_REQUIRED/
    );
  });

  test("still lets the canvas be edited and the decider answer", async () => {
    const s = await pausedWithDecision();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, content: "Market through the agency, Q1" });
    await s.asDaren.mutation(api.decisions.answerDecision, { noteId: s.first.noteId, answer: "approve" });
    const note = await s.t.run((ctx) => ctx.db.get(s.first.noteId));
    expect(note?.decision?.status).toBe("approved");
  });

  test("locks the review", async () => {
    const s = await pausedWithDecision();
    const review = await s.asCeline.query(api.review.get, { canvasId: s.first.canvasId });
    expect(review).toMatchObject({ locked: true });
  });

  test("the review is open during the trial", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, measure: "Sign-ups per week" });
    const review = await s.asCeline.query(api.review.get, { canvasId: s.first.canvasId });
    expect(review).not.toHaveProperty("locked");
  });
});

describe("admin tools", () => {
  test("are forbidden to everyone else", async () => {
    const s = await setup();
    expect(await s.t.query(api.admin.isAdmin, { accessToken: DRIVER_TOKEN })).toBe(false);
    await expect(
      s.t.query(api.admin.findAccount, { accessToken: DRIVER_TOKEN, email: "celine@example.com" })
    ).rejects.toThrow(/Forbidden/);
  });

  test("a founding member's plans go live free, up to their allowance", async () => {
    const s = await setup();
    await s.t.mutation(api.admin.updateAccount, {
      accessToken: ADMIN_TOKEN,
      email: "celine@example.com",
      founding: true,
      freeLivePlans: 1,
    });
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, measure: "Sign-ups per week" });
    expect(await planOf(s.t, s.first.canvasId)).toMatchObject({ status: "active", grant: "founding" });
    expect((await planOf(s.t, s.first.canvasId))?.paidUntil).toBeUndefined();

    // The free plan is used, so the next one gets the trial
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.second.noteId, measure: "Sign-ups per week" });
    expect((await planOf(s.t, s.second.canvasId))?.status).toBe("trial");

    const members = await s.t.query(api.admin.listFoundingMembers, { accessToken: ADMIN_TOKEN });
    expect(members).toMatchObject([{ email: "celine@example.com", freeLivePlans: 1, foundingPlansInUse: 1 }]);
  });

  test("a longer trial applies to the next plan to go live", async () => {
    const s = await setup();
    await s.t.mutation(api.admin.updateAccount, { accessToken: ADMIN_TOKEN, email: "celine@example.com", trialDays: 90 });
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, measure: "Sign-ups per week" });
    const plan = await planOf(s.t, s.first.canvasId);
    expect(plan!.trialEndsAt! - plan!.liveSince).toBe(90 * DAY_MS);

    // null puts back the default
    const account = await s.t.mutation(api.admin.updateAccount, {
      accessToken: ADMIN_TOKEN,
      email: "celine@example.com",
      trialDays: null,
    });
    expect(account.trialDays).toBe(30);
  });

  test("extending an ended trial starts it running again", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, measure: "Sign-ups per week" });
    await endTrial(s.t, s.first.canvasId);
    await s.t.mutation(api.admin.setCanvasPlanOverride, {
      accessToken: ADMIN_TOKEN,
      canvasId: s.first.canvasId,
      action: "extend_trial",
      days: 14,
      note: "Asked for two more weeks",
    });
    expect(await planOf(s.t, s.first.canvasId)).toMatchObject({ status: "trial", note: "Asked for two more weeks" });
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, passMark: "50 a week" });
  });

  test("activate with no end date, then pause and reset", async () => {
    const s = await setup();
    const override = (action: "activate" | "pause" | "reset") =>
      s.t.mutation(api.admin.setCanvasPlanOverride, { accessToken: ADMIN_TOKEN, canvasId: s.second.canvasId, action });
    const activated = await override("activate");
    expect(activated).toMatchObject({ status: "active", grant: "admin" });
    expect(activated.paidUntil).toBeUndefined();
    expect(await override("pause")).toMatchObject({ status: "paused" });
    expect(await override("reset")).toMatchObject({ status: "free" });

    const plans = await s.t.query(api.admin.listPlans, { accessToken: ADMIN_TOKEN });
    expect(plans).toEqual([]);
  });
});

test("the weekly check-in skips canvases that aren't live plans", async () => {
  const s = await setup();
  await s.t.run(async (ctx) => {
    await ctx.db.patch(s.first.noteId, { ownerId: s.celine });
    await ctx.db.patch(s.second.noteId, { ownerId: s.celine });
  });
  await s.asCeline.mutation(api.notes.updateNote, { noteId: s.first.noteId, measure: "Sign-ups per week" });
  await s.t.mutation(internal.checkIns.startWeek, {});
  await s.t.finishAllScheduledFunctions(() => {});
  const items = await s.t.run((ctx) => ctx.db.query("checkInItems").collect());
  expect(items.map((i) => i.canvasId)).toEqual([s.first.canvasId]);
});
