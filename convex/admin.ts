/**
 * Admin overrides for the paywall, behind the MCP server's admin tools (src/app/api/mcp/route.ts).
 * An admin is a signed-in user whose email is in the ADMIN_EMAILS environment variable
 * (comma-separated). Everyone else gets "Forbidden", and never sees the tools listed.
 */
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireTokenUser } from "./lib/auth";
import { DAY_MS, planStatusValidator } from "./lib/billing";
import { allowanceOf, ensureBillingAccount, foundingPlansInUse, getBillingAccount, setCanvasPlan } from "./lib/plans";
import { checkDate } from "./lib/testFields";

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminUser(user: Doc<"users">) {
  return !!user.email && adminEmails().includes(user.email.toLowerCase());
}

async function requireTokenAdmin(ctx: QueryCtx | MutationCtx, accessToken: string) {
  const user = await requireTokenUser(ctx, accessToken);
  if (!isAdminUser(user)) throw new ConvexError("Forbidden: admin tools are for LeanOn admins only.");
  return user;
}

async function userByEmail(ctx: QueryCtx | MutationCtx, email: string) {
  let user = null;
  for (const candidate of new Set([email.trim(), email.trim().toLowerCase()])) {
    user ??= await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", candidate))
      .first();
  }
  if (!user) throw new ConvexError(`No account with the email ${email}. They need to sign in to LeanOn once first.`);
  return user;
}

async function canvasById(ctx: QueryCtx | MutationCtx, canvasId: string) {
  const id = ctx.db.normalizeId("canvases", canvasId);
  const canvas = id && (await ctx.db.get(id));
  if (!canvas) throw new ConvexError(`Canvas not found: ${canvasId}`);
  return canvas;
}

const iso = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : undefined);

function planForAdmin(canvas: Doc<"canvases">) {
  const plan = canvas.plan;
  return {
    canvasId: canvas._id,
    title: canvas.title,
    status: plan?.status ?? "free",
    grant: plan?.grant,
    liveSince: iso(plan?.liveSince),
    trialEndsAt: iso(plan?.trialEndsAt),
    paidUntil: iso(plan?.paidUntil),
    paymentRef: plan?.paymentRef,
    note: plan?.note,
  };
}

async function accountForAdmin(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  const account = await getBillingAccount(ctx, user._id);
  const canvases = await ctx.db
    .query("canvases")
    .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
    .take(200);
  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    ...allowanceOf(account),
    foundingPlansInUse: await foundingPlansInUse(ctx, user._id),
    note: account?.note,
    canvases: canvases.map(planForAdmin),
  };
}

/** Whether the token's user is an admin; the MCP route lists the admin tools only then. */
export const isAdmin = query({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => isAdminUser(await requireTokenUser(ctx, args.accessToken)),
});

/** One account's allowances and the plan on each canvas they created. */
export const findAccount = query({
  args: { accessToken: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    await requireTokenAdmin(ctx, args.accessToken);
    return await accountForAdmin(ctx, await userByEmail(ctx, args.email));
  },
});

/**
 * Changes what an account is allowed. A value sets it, null puts back the default, leaving it out
 * keeps it. Applies to plans that go live from now on; use setCanvasPlan for a plan already live.
 */
export const updateAccount = mutation({
  args: {
    accessToken: v.string(),
    email: v.string(),
    founding: v.optional(v.union(v.boolean(), v.null())),
    trialDays: v.optional(v.union(v.number(), v.null())),
    trialsAllowed: v.optional(v.union(v.number(), v.null())),
    trialsUsed: v.optional(v.number()),
    freeLivePlans: v.optional(v.union(v.number(), v.null())),
    discountPercent: v.optional(v.union(v.number(), v.null())),
    note: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const admin = await requireTokenAdmin(ctx, args.accessToken);
    const user = await userByEmail(ctx, args.email);
    const account = await ensureBillingAccount(ctx, user._id);

    const whole = (value: number | null | undefined, label: string, max: number) => {
      if (value === undefined || value === null) return value;
      if (!Number.isInteger(value) || value < 0 || value > max) {
        throw new ConvexError(`${label} must be a whole number from 0 to ${max}`);
      }
      return value;
    };
    const patch: Partial<Doc<"billingAccounts">> = { updatedBy: admin._id, updatedAt: Date.now() };
    const fields = {
      founding: args.founding,
      trialDays: whole(args.trialDays, "trialDays", 365),
      trialsAllowed: whole(args.trialsAllowed, "trialsAllowed", 100),
      trialsUsed: whole(args.trialsUsed, "trialsUsed", 100),
      freeLivePlans: whole(args.freeLivePlans, "freeLivePlans", 100),
      discountPercent: whole(args.discountPercent, "discountPercent", 100),
      note: args.note === null ? null : args.note?.trim() || undefined,
    };
    for (const [key, value] of Object.entries(fields)) {
      // null clears the override; patching a key to undefined removes the field
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value ?? undefined;
    }
    await ctx.db.patch(account._id, patch);
    return await accountForAdmin(ctx, user);
  },
});

/** Accounts marked as founding members, with their allowances. */
export const listFoundingMembers = query({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    await requireTokenAdmin(ctx, args.accessToken);
    const accounts = await ctx.db
      .query("billingAccounts")
      .withIndex("by_founding", (q) => q.eq("founding", true))
      .take(200);
    const members = [];
    for (const account of accounts) {
      const user = await ctx.db.get(account.userId);
      if (!user) continue;
      members.push({
        userId: user._id,
        name: user.name,
        email: user.email,
        ...allowanceOf(account),
        foundingPlansInUse: await foundingPlansInUse(ctx, user._id),
        note: account.note,
      });
    }
    return members;
  },
});

/** Canvases with a live plan, optionally only one status, e.g. the trials. */
export const listPlans = query({
  args: { accessToken: v.string(), status: v.optional(planStatusValidator) },
  handler: async (ctx, args) => {
    await requireTokenAdmin(ctx, args.accessToken);
    const statuses = args.status ? [args.status] : (["trial", "active", "paused"] as const);
    const plans = [];
    for (const status of statuses) {
      const canvases = await ctx.db
        .query("canvases")
        .withIndex("by_plan_status", (q) => q.eq("plan.status", status))
        .take(200);
      for (const canvas of canvases) {
        const creator = await ctx.db.get(canvas.createdBy);
        plans.push({ ...planForAdmin(canvas), creator: creator?.email ?? creator?.name });
      }
    }
    return plans;
  },
});

/**
 * Overrides one canvas's plan:
 * - extend_trial: adds `days` to the trial (from its end, or from now if it has ended)
 * - activate: runs it free as an admin grant, until `until` (YYYY-MM-DD) or for `days`, else with no end date
 * - pause: stops it now
 * - reset: makes it a free canvas again (it goes live again the next time a test, decision or snapshot is added)
 */
export const setCanvasPlanOverride = mutation({
  args: {
    accessToken: v.string(),
    canvasId: v.string(),
    action: v.union(v.literal("extend_trial"), v.literal("activate"), v.literal("pause"), v.literal("reset")),
    days: v.optional(v.number()),
    until: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTokenAdmin(ctx, args.accessToken);
    const canvas = await canvasById(ctx, args.canvasId);
    const now = Date.now();
    const note = args.note?.trim() || canvas.plan?.note;
    const liveSince = canvas.plan?.liveSince ?? now;
    if (args.days !== undefined && (!Number.isInteger(args.days) || args.days < 1 || args.days > 3650)) {
      throw new ConvexError("days must be a whole number from 1 to 3650");
    }

    switch (args.action) {
      case "extend_trial": {
        if (!args.days) throw new ConvexError("extend_trial needs days, e.g. 30");
        const from = Math.max(now, canvas.plan?.trialEndsAt ?? now);
        await setCanvasPlan(ctx, canvas._id, { status: "trial", liveSince, trialEndsAt: from + args.days * DAY_MS, note });
        break;
      }
      case "activate": {
        const paidUntil = args.until
          ? Date.parse(`${checkDate(args.until.trim(), "until")}T23:59:59Z`)
          : args.days
            ? now + args.days * DAY_MS
            : undefined;
        if (paidUntil !== undefined && paidUntil <= now) throw new ConvexError("until must be in the future");
        await setCanvasPlan(ctx, canvas._id, {
          status: "active",
          liveSince,
          trialEndsAt: canvas.plan?.trialEndsAt,
          paidUntil,
          grant: "admin",
          note,
        });
        break;
      }
      case "pause":
        if (!canvas.plan) throw new ConvexError("This canvas isn't a live plan, so there's nothing to pause");
        await setCanvasPlan(ctx, canvas._id, { ...canvas.plan, status: "paused", note });
        break;
      case "reset":
        await setCanvasPlan(ctx, canvas._id, undefined);
        break;
    }
    return planForAdmin((await ctx.db.get(canvas._id))!);
  },
});
