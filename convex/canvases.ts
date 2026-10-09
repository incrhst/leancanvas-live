import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { hashPassword, verifyPassword } from "./lib/password";
import { checkDate } from "./lib/testFields";
import { displayName } from "./lib/members";
import { requireAuth, requireOwner, requireEditor, getCurrentUser, getCanvasRole, Role, sha256Hex } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import {
  BlockId,
  CanvasTemplate,
  DEFAULT_TITLE_BY_TEMPLATE,
  canvasTemplateValidator,
  templateOf,
} from "./lib/canvasTemplates";

type EvidenceState = Doc<"notes">["evidenceState"];
type SeedNote = { block: BlockId; content: string; order: number; evidenceState: EvidenceState };

// Initial seed notes for new canvases (standard Lean Canvas starter items)
const LEAN_SEED_NOTES: SeedNote[] = [
  {
    block: "problem",
    content: "Existing solutions are clunky, siloed, and fail to provide fast validation signals.",
    order: 0,
    evidenceState: "observed",
  },
  {
    block: "customerSegments",
    content: "Early-stage startup founders and product leads iterating fast.",
    order: 0,
    evidenceState: "supported",
  },
  {
    block: "uniqueValueProposition",
    content: "Realtime collaborative Lean Canvas with automated AI stress-testing and evidence tracking.",
    order: 0,
    evidenceState: "assumption",
  },
  {
    block: "solution",
    content: "Live multiplayer canvas with 1-click shareable read-only links and assumption heatmaps.",
    order: 0,
    evidenceState: "assumption",
  },
];

// GTM starter notes are untested guesses, so they start as assumptions or unknowns, not evidence
const GTM_SEED_NOTES: SeedNote[] = [
  {
    block: "idealCustomer",
    content: "Early-stage B2B SaaS founders about to start selling, with no written go-to-market plan.",
    order: 0,
    evidenceState: "assumption",
  },
  {
    block: "painsAndAlternatives",
    content: "GTM plans live in scattered docs and go stale within weeks; teams guess at what is working.",
    order: 0,
    evidenceState: "assumption",
  },
  {
    block: "messaging",
    content: "One shared plan that tells the whole team who to sell to, what to say, and where to reach them.",
    order: 0,
    evidenceState: "unknown",
  },
  {
    block: "channels",
    content: "Founder-led outbound plus one content channel; test paid channels once conversion is proven.",
    order: 0,
    evidenceState: "unknown",
  },
];

const SEED_NOTES: Record<CanvasTemplate, SeedNote[]> = {
  lean: LEAN_SEED_NOTES,
  gtm: GTM_SEED_NOTES,
};

/**
 * Shared implementation for creating a canvas (used by the web app and the MCP server).
 */
export async function createCanvasForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { title: string; description?: string; seedNotes?: boolean; template?: CanvasTemplate; launchDate?: string }
): Promise<Id<"canvases">> {
  const template = args.template ?? "lean";

  // Get or create user workspace
  let workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
    .first();

  if (!workspace) {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: `${user.name || "My"} Workspace`,
      ownerId: user._id,
    });
    workspace = await ctx.db.get(workspaceId);
  }

  if (!workspace) throw new Error("Could not initialize workspace");

  const now = Date.now();
  const title = args.title.trim() || DEFAULT_TITLE_BY_TEMPLATE[template];

  const canvasId = await ctx.db.insert("canvases", {
    workspaceId: workspace._id,
    title,
    description: args.description?.trim() || undefined,
    template,
    launchDate: args.launchDate?.trim() ? checkDate(args.launchDate.trim(), "launchDate") : undefined,
    status: "active",
    publicViewToken: crypto.randomUUID(),
    isPublicViewEnabled: false,
    createdBy: user._id,
    updatedAt: now,
  });

  // Add owner membership
  await ctx.db.insert("canvasMembers", {
    canvasId,
    userId: user._id,
    role: "owner",
  });

  // Seed initial notes
  if (args.seedNotes !== false) {
    for (const note of SEED_NOTES[template]) {
      await ctx.db.insert("notes", {
        canvasId,
        block: note.block,
        content: note.content,
        order: note.order,
        evidenceState: note.evidenceState,
        createdBy: user._id,
        updatedAt: now,
      });
    }
  }

  // Record activity
  await ctx.db.insert("activity", {
    canvasId,
    userId: user._id,
    type: "canvas_created",
    message: `created canvas "${title}"`,
    createdAt: now,
  });

  return canvasId;
}

/**
 * Creates a new canvas and sets the creator as owner.
 */
export const createCanvas = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    template: v.optional(canvasTemplateValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    return await createCanvasForUser(ctx, user, args);
  },
});

/**
 * Shared implementation listing canvases a user owns or is a member of.
 */
export async function listCanvasesForUser(ctx: QueryCtx, userId: Id<"users">) {
  const memberships = await ctx.db
    .query("canvasMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const canvasMap = new Map<Id<"canvases">, Doc<"canvases"> & { role: Role }>();

  for (const m of memberships) {
    const canvas = await ctx.db.get(m.canvasId);
    if (canvas) canvasMap.set(canvas._id, { ...canvas, role: m.role });
  }

  // Also get canvases created by user
  const created = await ctx.db
    .query("canvases")
    .withIndex("by_creator", (q) => q.eq("createdBy", userId))
    .collect();

  for (const canvas of created) {
    if (!canvasMap.has(canvas._id)) canvasMap.set(canvas._id, { ...canvas, role: "owner" });
  }

  return Array.from(canvasMap.values())
    .filter((c) => c.status !== "archived")
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Lists all canvases the current user owns or is a member of.
 */
export const listMyCanvases = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await listCanvasesForUser(ctx, user._id);
  },
});

/**
 * Gets a canvas with full details for authenticated members.
 */
export const getCanvas = query({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) return null;

    let role = null;
    if (user) {
      role = await getCanvasRole(ctx, args.canvasId, user._id);
    }

    // Non-members can only view through the public share link (/share/[token]),
    // which enforces the optional link password.
    if (!role) return null;

    // Fetch notes
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
      .collect();

    // Fetch members
    const members = await ctx.db
      .query("canvasMembers")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
      .collect();

    const memberDetails = await Promise.all(
      members.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return {
          id: m.userId,
          name: displayName(u),
          email: u?.email || "",
          imageUrl: u?.image,
          role: m.role,
        };
      })
    );

    const { publicViewPasswordHash, ...canvasFields } = canvas;

    return {
      canvas: { ...canvasFields, template: templateOf(canvas), hasPublicViewPassword: !!publicViewPasswordHash },
      notes: notes.sort((a, b) => a.order - b.order),
      members: memberDetails,
      currentUserRole: role,
      isAnonymous: !user,
    };
  },
});

const GRANT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const UNLOCK_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const UNLOCK_MAX_FAILURES_PER_VIEWER = 10; // wrong passwords per viewer (IP) per window
const UNLOCK_MAX_FAILURES_PER_CANVAS = 200; // wrong passwords across all viewers per window

type AttemptCounter = { doc: Doc<"shareUnlockAttempts"> | null; inWindow: boolean };

async function getAttemptCounter(
  ctx: MutationCtx,
  canvasId: Id<"canvases">,
  viewerKey: string | undefined,
  now: number
): Promise<AttemptCounter> {
  const doc = await ctx.db
    .query("shareUnlockAttempts")
    .withIndex("by_canvas_viewer", (q) => q.eq("canvasId", canvasId).eq("viewerKey", viewerKey))
    .first();
  return { doc, inWindow: !!doc && now - doc.windowStart < UNLOCK_WINDOW_MS };
}

async function recordFailure(
  ctx: MutationCtx,
  canvasId: Id<"canvases">,
  viewerKey: string | undefined,
  counter: AttemptCounter,
  now: number
) {
  if (!counter.doc) {
    await ctx.db.insert("shareUnlockAttempts", { canvasId, viewerKey, windowStart: now, count: 1 });
  } else if (counter.inWindow) {
    await ctx.db.patch(counter.doc._id, { count: counter.doc.count + 1 });
  } else {
    await ctx.db.patch(counter.doc._id, { windowStart: now, count: 1 });
  }
}

/**
 * Checks a viewing pass issued by unlockPublicView. Passes are invalidated whenever the
 * link password is changed or removed (publicViewPasswordSetAt changes).
 */
async function isValidGrant(ctx: QueryCtx, canvas: Doc<"canvases">, grant?: string) {
  if (!grant) return false;
  const grantHash = await sha256Hex(grant);
  const grantDoc = await ctx.db
    .query("publicViewGrants")
    .withIndex("by_grant_hash", (q) => q.eq("grantHash", grantHash))
    .unique();
  return (
    !!grantDoc &&
    grantDoc.canvasId === canvas._id &&
    grantDoc.passwordSetAt === canvas.publicViewPasswordSetAt &&
    grantDoc.expiresAt > Date.now()
  );
}

/**
 * Exchanges a public link password for a short-lived viewing pass.
 * Only callable by the Next.js /api/share/unlock route (shared secret), which supplies the
 * viewer's IP so failed attempts can be throttled per viewer as well as per canvas.
 */
export const unlockPublicView = mutation({
  args: {
    token: v.string(),
    password: v.string(),
    clientIp: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.SHARE_UNLOCK_SECRET;
    if (!expected || args.serverSecret !== expected) {
      throw new ConvexError("Forbidden");
    }

    const canvas = await ctx.db
      .query("canvases")
      .withIndex("by_public_token", (q) => q.eq("publicViewToken", args.token))
      .first();
    if (!canvas || !canvas.isPublicViewEnabled || !canvas.publicViewPasswordHash) {
      return { ok: false as const, reason: "unavailable" as const };
    }

    const now = Date.now();
    const viewerKey = await sha256Hex(`${canvas._id}:${args.clientIp}`);
    const viewer = await getAttemptCounter(ctx, canvas._id, viewerKey, now);
    const overall = await getAttemptCounter(ctx, canvas._id, undefined, now);
    if (
      (viewer.inWindow && viewer.doc!.count >= UNLOCK_MAX_FAILURES_PER_VIEWER) ||
      (overall.inWindow && overall.doc!.count >= UNLOCK_MAX_FAILURES_PER_CANVAS)
    ) {
      return { ok: false as const, reason: "rate_limited" as const };
    }

    if (!(await verifyPassword(args.password, canvas.publicViewPasswordHash))) {
      await recordFailure(ctx, canvas._id, viewerKey, viewer, now);
      await recordFailure(ctx, canvas._id, undefined, overall, now);
      return { ok: false as const, reason: "invalid" as const };
    }

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const grant = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.db.insert("publicViewGrants", {
      canvasId: canvas._id,
      grantHash: await sha256Hex(grant),
      passwordSetAt: canvas.publicViewPasswordSetAt ?? 0,
      expiresAt: now + GRANT_TTL_MS,
    });
    return { ok: true as const, grant, expiresAt: now + GRANT_TTL_MS };
  },
});

/**
 * Sets (or clears, with null) the password on the public read-only link (Owner only).
 * Changing it invalidates all existing viewing passes.
 */
export const setPublicViewPassword = mutation({
  args: {
    canvasId: v.id("canvases"),
    password: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireOwner(ctx, args.canvasId);
    if (args.password !== null && args.password.length < 4) {
      throw new ConvexError("Password must be at least 4 characters");
    }

    const now = Date.now();
    await ctx.db.patch(args.canvasId, {
      publicViewPasswordHash: args.password === null ? undefined : await hashPassword(args.password),
      publicViewPasswordSetAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activity", {
      canvasId: args.canvasId,
      userId: user._id,
      type: "public_view_changed",
      message: args.password === null ? "removed the public link password" : "set a public link password",
      createdAt: now,
    });
  },
});

/**
 * Anonymous Read-Only Query via public token.
 * Strips sensitive data, never exposes edit abilities.
 */
export const getCanvasByPublicToken = query({
  args: {
    token: v.string(),
    // Viewing pass from unlockPublicView, required when the link is password protected
    grant: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const canvas = await ctx.db
      .query("canvases")
      .withIndex("by_public_token", (q) => q.eq("publicViewToken", args.token))
      .first();

    if (!canvas || !canvas.isPublicViewEnabled) {
      return null;
    }

    if (canvas.publicViewPasswordHash && !(await isValidGrant(ctx, canvas, args.grant))) {
      return { passwordRequired: true as const };
    }

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
      .collect();

    const latestStressTest = await ctx.db
      .query("stressTests")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
      .order("desc")
      .first();

    return {
      canvas: {
        _id: canvas._id,
        title: canvas.title,
        description: canvas.description,
        template: templateOf(canvas),
        launchDate: canvas.launchDate,
        status: canvas.status,
        updatedAt: canvas.updatedAt,
      },
      notes: notes
        .map((n) => ({
          _id: n._id,
          block: n.block,
          content: n.content,
          order: n.order,
          evidenceState: n.evidenceState,
          measure: n.measure,
          passMark: n.passMark,
          reviewDate: n.reviewDate,
          latestResult: n.latestResult,
          updatedAt: n.updatedAt,
        }))
        .sort((a, b) => a.order - b.order),
      latestStressTest: latestStressTest
        ? {
            scores: latestStressTest.scores,
            overallScore: latestStressTest.overallScore,
            riskiestAssumptions: latestStressTest.riskiestAssumptions,
            createdAt: latestStressTest.createdAt,
          }
        : null,
      role: "viewer" as const,
      isAnonymous: true,
    };
  },
});

/**
 * Updates canvas title or description (Editor+).
 */
export const updateCanvasMeta = mutation({
  args: {
    canvasId: v.id("canvases"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("archived"))),
    // null clears it
    launchDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.canvasId);
    const { canvasId, ...changes } = args;
    await updateCanvasMetaForUser(ctx, user._id, canvasId, changes);
  },
});

/**
 * Shared implementation for updating a canvas's title, description, status or launch date
 * (caller must have verified editor access).
 */
export async function updateCanvasMetaForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  canvasId: Id<"canvases">,
  args: {
    title?: string;
    description?: string;
    status?: Doc<"canvases">["status"];
    launchDate?: string | null;
  }
) {
  const canvas = await ctx.db.get(canvasId);
  if (!canvas) throw new Error("Canvas not found");

  const updates: Partial<typeof canvas> = {
    updatedAt: Date.now(),
  };
  if (args.title !== undefined) updates.title = args.title;
  if (args.description !== undefined) updates.description = args.description;
  if (args.status !== undefined) updates.status = args.status;
  if (args.launchDate !== undefined) {
    updates.launchDate = args.launchDate?.trim() ? checkDate(args.launchDate.trim(), "launchDate") : undefined;
  }

  await ctx.db.patch(canvasId, updates);

  await ctx.db.insert("activity", {
    canvasId,
    userId,
    type: "canvas_updated",
    message:
      args.launchDate !== undefined
        ? updates.launchDate
          ? `set the launch date to ${updates.launchDate}`
          : "cleared the launch date"
        : `updated canvas metadata`,
    createdAt: Date.now(),
  });
}

/**
 * Toggles public view or regenerates public token (Owner only).
 */
export const setPublicView = mutation({
  args: {
    canvasId: v.id("canvases"),
    enabled: v.boolean(),
    regenerateToken: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireOwner(ctx, args.canvasId);
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");

    const updates: {
      isPublicViewEnabled: boolean;
      publicViewToken?: string;
      updatedAt: number;
    } = {
      isPublicViewEnabled: args.enabled,
      updatedAt: Date.now(),
    };

    if (args.regenerateToken || !canvas.publicViewToken) {
      updates.publicViewToken = crypto.randomUUID();
    }

    await ctx.db.patch(args.canvasId, updates);

    await ctx.db.insert("activity", {
      canvasId: args.canvasId,
      userId: user._id,
      type: "public_view_changed",
      message: args.enabled
        ? "enabled public read-only link"
        : "disabled public read-only link",
      createdAt: Date.now(),
    });

    return updates.publicViewToken || canvas.publicViewToken;
  },
});

/**
 * Deletes a canvas (Owner only).
 */
export const deleteCanvas = mutation({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.canvasId);

    // Delete notes
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", args.canvasId))
      .collect();
    for (const n of notes) {
      await ctx.db.delete(n._id);
    }

    // Delete members
    const members = await ctx.db
      .query("canvasMembers")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();
    for (const m of members) {
      await ctx.db.delete(m._id);
    }

    // Delete invites
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();
    for (const inv of invites) {
      await ctx.db.delete(inv._id);
    }

    // Delete stress tests
    const stressTests = await ctx.db
      .query("stressTests")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();
    for (const st of stressTests) {
      await ctx.db.delete(st._id);
    }

    await ctx.db.delete(args.canvasId);
  },
});
