/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/** A canvas owned by Celine, with Daren as a view-only member. Omar has an account but isn't on it. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const celine = await ctx.db.insert("users", { name: "Celine", email: "celine@example.com" });
    const daren = await ctx.db.insert("users", { name: "Daren", email: "daren@example.com" });
    const omar = await ctx.db.insert("users", { name: "Omar", email: "omar@example.com" });
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
    return { celine, daren, omar, canvasId };
  });
  return {
    t,
    ...ids,
    asCeline: t.withIdentity({ subject: `${ids.celine}|session` }),
    asDaren: t.withIdentity({ subject: `${ids.daren}|session` }),
    asOmar: t.withIdentity({ subject: `${ids.omar}|session` }),
  };
}

describe("presence", () => {
  test("members on a canvas see each other", async () => {
    const { asCeline, asDaren, canvasId, celine, daren } = await setup();
    await asCeline.mutation(api.presence.heartbeat, { canvasId });
    await asDaren.mutation(api.presence.heartbeat, { canvasId });

    const seen = await asCeline.query(api.presence.getPresence, { canvasId });
    expect(seen.map((p) => p.userId).sort()).toEqual([celine, daren].sort());
    expect(seen.find((p) => p.userId === daren)?.userName).toBe("Daren");
  });

  test("a second heartbeat updates the same record", async () => {
    const { asDaren, canvasId } = await setup();
    await asDaren.mutation(api.presence.heartbeat, { canvasId });
    await asDaren.mutation(api.presence.heartbeat, { canvasId });
    expect(await asDaren.query(api.presence.getPresence, { canvasId })).toHaveLength(1);
  });

  test("someone silent for too long is no longer listed", async () => {
    const { t, asCeline, asDaren, canvasId, daren } = await setup();
    await asDaren.mutation(api.presence.heartbeat, { canvasId });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("presence")
        .withIndex("by_canvas_user", (q) => q.eq("canvasId", canvasId).eq("userId", daren))
        .first();
      await ctx.db.patch(row!._id, { updatedAt: Date.now() - 26_000 });
    });
    expect(await asCeline.query(api.presence.getPresence, { canvasId })).toEqual([]);
  });

  test("people who aren't on the canvas neither see nor appear", async () => {
    const { t, asCeline, asOmar, canvasId } = await setup();
    await asCeline.mutation(api.presence.heartbeat, { canvasId });
    await asOmar.mutation(api.presence.heartbeat, { canvasId });
    await t.mutation(api.presence.heartbeat, { canvasId });

    expect(await asOmar.query(api.presence.getPresence, { canvasId })).toEqual([]);
    expect(await t.query(api.presence.getPresence, { canvasId })).toEqual([]);
    expect(await asCeline.query(api.presence.getPresence, { canvasId })).toHaveLength(1);
  });
});
