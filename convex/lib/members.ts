import { QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { Role } from "./auth";

/** How a person is named in the app and to agents: their name, else their email. */
export function displayName(user: Doc<"users"> | null | undefined) {
  return user?.name || user?.email || "Unknown user";
}

/**
 * Everyone with access to a canvas. Includes the creator even on older canvases that have no
 * membership row for them (getCanvasRole treats the creator as owner).
 */
export async function listCanvasMembers(ctx: QueryCtx, canvas: Doc<"canvases">) {
  const rows = await ctx.db
    .query("canvasMembers")
    .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
    .collect();
  const entries: { userId: Id<"users">; role: Role }[] = rows.map((r) => ({ userId: r.userId, role: r.role }));
  if (!entries.some((e) => e.userId === canvas.createdBy)) {
    entries.unshift({ userId: canvas.createdBy, role: "owner" });
  }

  return await Promise.all(
    entries.map(async ({ userId, role }) => {
      const user = await ctx.db.get(userId);
      return { userId, name: displayName(user), email: user?.email ?? "", role };
    })
  );
}
