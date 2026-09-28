import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./lib/auth";

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

/**
 * Creates or syncs user session (useful for magic-link / local dev session)
 */
export const storeUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .first();

    const name = args.name || args.email.split("@")[0];

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        imageUrl: args.imageUrl || existing.imageUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      email: args.email.toLowerCase().trim(),
      name,
      imageUrl: args.imageUrl,
      tokenIdentifier: `email:${args.email.toLowerCase().trim()}`,
    });
  },
});
