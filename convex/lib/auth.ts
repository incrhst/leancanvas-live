import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export type Role = "owner" | "editor" | "viewer";

/**
 * Gets the current authenticated user record, or null if anonymous.
 * Supports tokenIdentifier lookup from standard auth or custom session token.
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Look up user by tokenIdentifier or email
  let user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();

  if (!user && identity.email) {
    user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
  }

  return user;
}

/**
 * Ensures user is authenticated. Throws Error if not.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Authentication required. Please sign in.");
  }
  return user;
}

/**
 * Gets the role of the user on a specific canvas.
 * Returns "owner" | "editor" | "viewer" | null.
 */
export async function getCanvasRole(
  ctx: QueryCtx | MutationCtx,
  canvasId: Id<"canvases">,
  userId?: Id<"users">
): Promise<Role | null> {
  let targetUserId = userId;
  if (!targetUserId) {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    targetUserId = user._id;
  }

  // Direct membership query
  const member = await ctx.db
    .query("canvasMembers")
    .withIndex("by_canvas_user", (q) =>
      q.eq("canvasId", canvasId).eq("userId", targetUserId!)
    )
    .first();

  if (member) {
    return member.role;
  }

  // Fallback check: is the user the canvas creator or workspace owner?
  const canvas = await ctx.db.get(canvasId);
  if (canvas && canvas.createdBy === targetUserId) {
    return "owner";
  }

  return null;
}

/**
 * Ensures user has editor or owner permission on the canvas.
 */
export async function requireEditor(
  ctx: MutationCtx | QueryCtx,
  canvasId: Id<"canvases">
) {
  const user = await requireAuth(ctx);
  const role = await getCanvasRole(ctx, canvasId, user._id);
  if (role !== "owner" && role !== "editor") {
    throw new Error("Forbidden: You must be an Editor or Owner of this canvas to make changes.");
  }
  return { user, role };
}

/**
 * Ensures user is the owner of the canvas.
 */
export async function requireOwner(
  ctx: MutationCtx | QueryCtx,
  canvasId: Id<"canvases">
) {
  const user = await requireAuth(ctx);
  const role = await getCanvasRole(ctx, canvasId, user._id);
  if (role !== "owner") {
    throw new Error("Forbidden: You must be the Owner of this canvas.");
  }
  return { user, role };
}

/**
 * Validates if a user (or anonymous viewer with token) can view the canvas.
 */
export async function canViewCanvas(
  ctx: QueryCtx,
  canvasId: Id<"canvases">,
  publicToken?: string
): Promise<boolean> {
  const canvas = await ctx.db.get(canvasId);
  if (!canvas) return false;

  // Check public token access
  if (publicToken && canvas.isPublicViewEnabled && canvas.publicViewToken === publicToken) {
    return true;
  }

  // Check authenticated membership
  const user = await getCurrentUser(ctx);
  if (!user) return false;

  const role = await getCanvasRole(ctx, canvasId, user._id);
  return role !== null;
}
