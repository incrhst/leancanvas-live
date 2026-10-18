/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { sha256Hex } from "./lib/auth";

const modules = import.meta.glob("./**/*.ts");

/**
 * A canvas owned by Celine, with Daren as a view-only member driving one note.
 * Celine is the canvas owner (a role); Daren is the note's driver (the person doing the work).
 */
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
      isPublicViewEnabled: false,
      createdBy: celine,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("canvasMembers", { canvasId, userId: celine, role: "owner" });
    await ctx.db.insert("canvasMembers", { canvasId, userId: daren, role: "viewer" });
    const noteId = await ctx.db.insert("notes", {
      canvasId,
      block: "channels",
      content: "Small shops will pay for same-day delivery",
      order: 0,
      evidenceState: "assumption",
      ownerId: daren,
      createdBy: celine,
      updatedAt: Date.now(),
    });
    const otherNoteId = await ctx.db.insert("notes", {
      canvasId,
      block: "channels",
      content: "Agencies refer us their clients",
      order: 1,
      evidenceState: "assumption",
      createdBy: celine,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("oauthTokens", {
      accessTokenHash: await sha256Hex("celine-agent-token"),
      refreshTokenHash: await sha256Hex("celine-refresh-token"),
      clientId: "test-client",
      userId: celine,
      accessExpiresAt: Date.now() + 60 * 60 * 1000,
    });
    return { celine, daren, canvasId, noteId, otherNoteId };
  });
  const asCeline = t.withIdentity({ subject: `${ids.celine}|session` });
  return { t, asCeline, accessToken: "celine-agent-token", ...ids };
}

/** The emails queued so far, oldest first. */
async function sentEmails(t: ReturnType<typeof convexTest>) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs
    .filter((j) => j.name.startsWith("email"))
    .map((j) => j.args[0] as { to: string; subject: string; text: string });
}

describe("the weekly check-in email", () => {
  test("goes to the note's driver and calls them the driver, not the owner", async () => {
    const s = await setup();
    const result = await s.asCeline.mutation(api.checkIns.sendNow, { canvasId: s.canvasId });
    expect(result).toEqual({ questions: 1, drivers: 1 });

    const emails = await sentEmails(s.t);
    expect(emails.map((e) => e.to)).toEqual(["daren@example.com"]);
    expect(emails[0].text).toContain(`Any new evidence this week on the notes you're driving in "Afforrd launch"?`);
    expect(emails[0].text).toContain("- Small shops will pay for same-day delivery");
    expect(emails[0].text).not.toMatch(/\bown(er|s|ed)?\b/i);
  });
});

describe("agents see the driver", () => {
  test("get_canvas names each note's driver", async () => {
    const s = await setup();
    const canvas = await s.t.query(api.mcp.getCanvas, { accessToken: s.accessToken, canvasId: s.canvasId });
    const [driven, unassigned] = canvas.blocks.channels;
    expect(driven.driver).toEqual({ userId: s.daren, name: "Daren" });
    expect(unassigned.driver).toBeUndefined();
    expect(driven).not.toHaveProperty("owner");
  });

  test("driverUserId narrows to one person's notes, and the older ownerUserId still works", async () => {
    const s = await setup();
    const byDriver = await s.t.query(api.mcp.getCanvas, {
      accessToken: s.accessToken,
      canvasId: s.canvasId,
      driverUserId: s.daren,
    });
    expect(byDriver.filteredByDriver).toBe(s.daren);
    expect(byDriver.blocks.channels.map((n) => n.noteId)).toEqual([s.noteId]);

    const unassigned = await s.t.query(api.mcp.getCanvas, {
      accessToken: s.accessToken,
      canvasId: s.canvasId,
      driverUserId: "unassigned",
    });
    expect(unassigned.blocks.channels.map((n) => n.noteId)).toEqual([s.otherNoteId]);

    const legacy = await s.t.query(api.mcp.getCanvas, {
      accessToken: s.accessToken,
      canvasId: s.canvasId,
      ownerUserId: s.daren,
    });
    expect(legacy.blocks.channels.map((n) => n.noteId)).toEqual([s.noteId]);
  });

  test("update_note sets the driver with driverUserId", async () => {
    const s = await setup();
    await s.t.mutation(api.mcp.updateNote, {
      accessToken: s.accessToken,
      noteId: s.otherNoteId,
      driverUserId: s.celine,
    });
    const note = await s.t.run((ctx) => ctx.db.get(s.otherNoteId));
    expect(note!.ownerId).toBe(s.celine);
  });
});

describe("the note's history", () => {
  test("labels a change of driver as the driver", async () => {
    const s = await setup();
    await s.asCeline.mutation(api.notes.updateNote, { noteId: s.noteId, ownerId: s.celine });
    const history = await s.asCeline.query(api.notes.getNoteHistory, { noteId: s.noteId });
    expect(history[0].changes).toEqual([{ field: "driver", from: "Daren", to: "Celine" }]);
  });

  test("refuses a driver who isn't on the canvas", async () => {
    const s = await setup();
    const outsider = await s.t.run((ctx) => ctx.db.insert("users", { name: "Outsider", email: "out@example.com" }));
    await expect(s.asCeline.mutation(api.notes.updateNote, { noteId: s.noteId, ownerId: outsider })).rejects.toThrow(
      "A note's driver must be a member of its canvas"
    );
  });
});
