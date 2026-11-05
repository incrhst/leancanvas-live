import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireEditor, requireAuth, getCurrentUser, getCanvasRole } from "./lib/auth";
import { displayName } from "./lib/members";
import { emailUser, siteUrl } from "./lib/notify";

/**
 * Creates an invite token (magic link or email) for a canvas.
 */
export const createInvite = mutation({
  args: {
    canvasId: v.id("canvases"),
    email: v.optional(v.string()),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEditor(ctx, args.canvasId);

    const token = crypto.randomUUID();
    const days = args.expiresInDays || 14;
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;

    const inviteId = await ctx.db.insert("invites", {
      canvasId: args.canvasId,
      email: args.email?.toLowerCase().trim(),
      role: args.role,
      token,
      expiresAt,
      createdBy: user._id,
    });

    await ctx.db.insert("activity", {
      canvasId: args.canvasId,
      userId: user._id,
      type: "invite_created",
      message: args.email
        ? `invited ${args.email} as ${args.role}`
        : `generated invite link for role ${args.role}`,
      createdAt: Date.now(),
    });

    return { inviteId, token };
  },
});

/**
 * Validates an invite token and returns info prior to accepting.
 */
export const getInviteInfo = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) return null;
    if (invite.expiresAt < Date.now()) return { expired: true };
    if (invite.usedAt) return { used: true };

    const canvas = await ctx.db.get(invite.canvasId);
    if (!canvas) return null;

    const creator = await ctx.db.get(invite.createdBy);

    return {
      canvasId: canvas._id,
      canvasTitle: canvas.title,
      role: invite.role,
      inviterName: creator?.name || "A team member",
      expiresAt: invite.expiresAt,
    };
  },
});

/**
 * Accepts an invite. Must be authenticated.
 */
export const acceptInvite = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) throw new Error("Invite not found");
    if (invite.expiresAt < Date.now()) throw new Error("This invite has expired");
    if (invite.usedAt) throw new Error("This invite has already been used");

    if (invite.email && invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
      throw new Error(`This invite was sent specifically to ${invite.email}`);
    }

    // Check existing membership
    const existing = await ctx.db
      .query("canvasMembers")
      .withIndex("by_canvas_user", (q) =>
        q.eq("canvasId", invite.canvasId).eq("userId", user._id)
      )
      .first();

    // What changed for this person: joined, moved up to editor, or nothing (already a member)
    let change: "joined" | "upgraded" | null = null;
    if (existing) {
      // Upgrade role if invite has higher privilege
      if (existing.role === "viewer" && invite.role === "editor") {
        await ctx.db.patch(existing._id, { role: "editor" });
        change = "upgraded";
      }
    } else {
      await ctx.db.insert("canvasMembers", {
        canvasId: invite.canvasId,
        userId: user._id,
        role: invite.role,
      });
      change = "joined";
    }

    // Mark single-use or record acceptance
    await ctx.db.patch(invite._id, { usedAt: Date.now() });

    await ctx.db.insert("activity", {
      canvasId: invite.canvasId,
      userId: user._id,
      type: "member_joined",
      message: `joined as ${invite.role}`,
      createdAt: Date.now(),
    });

    // Tell the canvas owner someone came in on an invite (unless the owner is the one joining)
    if (change) {
      const canvas = await ctx.db.get(invite.canvasId);
      if (canvas && canvas.createdBy !== user._id) {
        const inviter = await ctx.db.get(invite.createdBy);
        const who = displayName(user);
        const whatHappened =
          change === "joined"
            ? `${who} joined "${canvas.title}" as ${invite.role === "editor" ? "an editor" : "a viewer"}.`
            : `${who} is now an editor on "${canvas.title}" (was a viewer).`;
        await emailUser(ctx, canvas.createdBy, {
          subject: `${who} joined ${canvas.title}`,
          text: [
            whatHappened,
            ...(user.email && user.email !== who ? [`Email: ${user.email}`] : []),
            `Invited by: ${invite.createdBy === canvas.createdBy ? "you" : displayName(inviter)}`,
            "",
            `Open the canvas: ${siteUrl()}/canvas/${canvas._id}`,
          ].join("\n"),
        });
      }
    }

    return invite.canvasId;
  },
});

/**
 * Lists active invites for a canvas (Editor+).
 */
export const listInvites = query({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const role = await getCanvasRole(ctx, args.canvasId, user._id);
    if (role !== "owner" && role !== "editor") return [];

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    return invites.filter((inv) => !inv.usedAt && inv.expiresAt > Date.now());
  },
});

/**
 * Revokes an invite.
 */
export const revokeInvite = mutation({
  args: {
    inviteId: v.id("invites"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");

    await requireEditor(ctx, invite.canvasId);
    await ctx.db.delete(args.inviteId);
  },
});
