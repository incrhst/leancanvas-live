/**
 * Paying for a live plan by card, through DIME PAY's hosted checkout (lib/dimepay.ts).
 * startCheckout sends the canvas's creator to DIME PAY; DIME PAY sends them back to the plan page
 * with the order's token, and may also call the webhook. Either way, confirmOrder fetches the
 * order from DIME PAY and only marks the plan paid if that order checks out.
 */
import { action, ActionCtx, httpAction, internalMutation, internalQuery, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { DAY_MS, PAID_PERIOD_DAYS, planPriceUsd } from "./lib/billing";
import {
  checkOrderPaid,
  createHostedPage,
  dimepayConfig,
  getOrder,
  requireDimepayConfig,
  tokenFromWebhook,
} from "./lib/dimepay";
import { siteUrl } from "./lib/notify";
import { allowanceOf, getBillingAccount, setCanvasPlan } from "./lib/plans";

const CURRENCY = "USD";

/** Whether card payments are switched on (the DIME PAY keys are set). */
export const checkoutAvailable = query({
  args: {},
  handler: async () => dimepayConfig() !== null,
});

/** Checks the payer can pay for this canvas's plan and records the pending payment. */
export const preparePayment = internalMutation({
  args: { canvasId: v.id("canvases"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    const user = await ctx.db.get(args.userId);
    if (!canvas || !user) throw new ConvexError("Canvas not found");
    if (canvas.createdBy !== user._id) throw new ConvexError("Only the person who created this canvas can pay for its plan.");
    if (canvas.plan?.status === "active" && canvas.plan.grant && !canvas.plan.paidUntil) {
      throw new ConvexError("This plan already runs free, with no end date.");
    }
    if (!user.email) throw new ConvexError("Your account needs an email address to pay by card.");

    const amount = planPriceUsd(allowanceOf(await getBillingAccount(ctx, user._id)).discountPercent);
    if (amount <= 0) throw new ConvexError("This plan is free for you; ask us to turn it on.");
    const orderId = `leanon-${crypto.randomUUID()}`;
    await ctx.db.insert("planPayments", {
      canvasId: canvas._id,
      userId: user._id,
      orderId,
      amount,
      currency: CURRENCY,
      months: 1,
      status: "pending",
      createdAt: Date.now(),
    });
    return { orderId, amount, currency: CURRENCY, email: user.email, title: canvas.title };
  },
});

/** Sends the canvas's creator to DIME PAY to pay for a month of the plan. Returns the checkout URL. */
export const startCheckout = action({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args): Promise<string> => {
    const config = requireDimepayConfig();
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to pay for the plan.");
    const order = await ctx.runMutation(internal.payments.preparePayment, { canvasId: args.canvasId, userId });
    const planPage = `${siteUrl()}/canvas/${args.canvasId}/plan`;
    return await createHostedPage(config, {
      id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      email: order.email,
      itemName: "LeanOn live plan, 1 month",
      itemDescription: order.title,
      sku: "leanon-live-plan-month",
      redirectUrl: planPage,
      checkoutUrl: planPage,
      webhookUrl: `${process.env.CONVEX_SITE_URL}/dimepay/webhook`,
    });
  },
});

export const paymentByOrderId = internalQuery({
  args: { orderId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("planPayments")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .unique(),
});

/**
 * Marks a checked payment paid and runs the plan for another paid period, from the end of the
 * current one if it's still running. Paying twice for the same order changes nothing.
 */
export const markPaid = internalMutation({
  args: { paymentId: v.id("planPayments"), dimepayToken: v.string() },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "paid") return { canvasId: payment.canvasId, paidUntil: undefined };
    const canvas = await ctx.db.get(payment.canvasId);
    if (!canvas) throw new Error("Canvas not found");

    const now = Date.now();
    await ctx.db.patch(payment._id, { status: "paid", paidAt: now, dimepayToken: args.dimepayToken });
    const runningUntil = canvas.plan?.status === "active" && canvas.plan.paidUntil ? canvas.plan.paidUntil : now;
    const paidUntil = Math.max(now, runningUntil) + payment.months * PAID_PERIOD_DAYS * DAY_MS;
    await setCanvasPlan(ctx, canvas._id, {
      status: "active",
      liveSince: canvas.plan?.liveSince ?? now,
      trialEndsAt: canvas.plan?.trialEndsAt,
      paidUntil,
      paymentRef: args.dimepayToken,
    });
    await ctx.db.insert("activity", {
      canvasId: canvas._id,
      userId: payment.userId,
      type: "plan_paid",
      message: `paid for the live plan until ${new Date(paidUntil).toISOString().slice(0, 10)}`,
      createdAt: now,
    });
    return { canvasId: canvas._id, paidUntil };
  },
});

type Confirmation =
  | { status: "paid"; canvasId: Id<"canvases"> }
  | { status: "not_paid"; canvasId?: Id<"canvases">; why: string };

/** Fetches an order from DIME PAY and, if it's one of ours and paid, marks its payment paid. */
async function confirmOrder(ctx: ActionCtx, token: string): Promise<Confirmation> {
  const config = requireDimepayConfig();
  const order = await getOrder(config, token);
  const orderId = typeof order.id === "string" ? order.id : undefined;
  const payment = orderId ? await ctx.runQuery(internal.payments.paymentByOrderId, { orderId }) : null;
  if (!payment) {
    console.warn("DIME PAY order isn't one of ours", JSON.stringify({ id: order.id, status: order.status }));
    return { status: "not_paid", why: "That payment isn't for a LeanOn plan." };
  }
  if (payment.status === "paid") return { status: "paid", canvasId: payment.canvasId };

  const check = checkOrderPaid(config, order, { id: payment.orderId, amount: payment.amount, currency: payment.currency });
  if (check.paid === false) {
    console.warn(`DIME PAY order ${payment.orderId} not paid: ${check.why}`);
    return { status: "not_paid", canvasId: payment.canvasId, why: "The payment hasn't gone through." };
  }
  await ctx.runMutation(internal.payments.markPaid, { paymentId: payment._id, dimepayToken: token });
  return { status: "paid", canvasId: payment.canvasId };
}

/** Called by the plan page when DIME PAY sends the payer back with the order's token. */
export const confirmCheckout = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<Confirmation> => await confirmOrder(ctx, args.token),
});

/**
 * DIME PAY's webhook. The body only says which order to check; the order is fetched and checked
 * like a redirect. Always answers 200 so DIME PAY doesn't retry forever on orders that aren't ours.
 */
export const webhook = httpAction(async (ctx, request) => {
  const body: unknown = await request.json().catch(() => null);
  const token = tokenFromWebhook(body);
  if (!token || !dimepayConfig()) return new Response(null, { status: 200 });
  try {
    await confirmOrder(ctx, token);
  } catch (err) {
    console.error("DIME PAY webhook: couldn't confirm the order", err);
  }
  return new Response(null, { status: 200 });
});
