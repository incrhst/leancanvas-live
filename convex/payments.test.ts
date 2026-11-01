/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { DAY_MS, PLAN_PRICE_USD } from "./lib/billing";
import { checkOrderPaid, tokenFromWebhook } from "./lib/dimepay";

const modules = import.meta.glob("./**/*.ts");

const paidStatuses = ["COMPLETE", "PAID"];

describe("checkOrderPaid", () => {
  const expected = { id: "leanon-1", amount: 29, currency: "USD" };
  const order = { id: "leanon-1", total: 29, currency: "USD", status: "COMPLETE" };

  test("passes our order, for the amount, when complete", () => {
    expect(checkOrderPaid({ paidStatuses }, order, expected)).toEqual({ paid: true });
    expect(checkOrderPaid({ paidStatuses }, { ...order, status: "paid", currency: "usd" }, expected)).toEqual({ paid: true });
  });

  test.each([
    ["someone else's order", { id: "other" }],
    ["a different amount", { total: 1 }],
    ["a different currency", { currency: "JMD" }],
    ["a pending order", { status: "PENDING" }],
    ["no status", { status: undefined }],
  ])("fails %s", (_label, change) => {
    expect(checkOrderPaid({ paidStatuses }, { ...order, ...change }, expected).paid).toBe(false);
  });
});

test("tokenFromWebhook finds the token wherever it is", () => {
  expect(tokenFromWebhook({ type: "payment.success", data: { order: { token: "tok-1" } } })).toBe("tok-1");
  expect(tokenFromWebhook({ order_token: "tok-2" })).toBe("tok-2");
  expect(tokenFromWebhook({ type: "payment.success" })).toBeNull();
  expect(tokenFromWebhook("not json")).toBeNull();
});

/** A canvas created by Celine, with Daren as an editor. */
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
    await ctx.db.insert("canvasMembers", { canvasId, userId: daren, role: "editor" });
    return { celine, daren, canvasId };
  });
  return { t, ...ids };
}

const planOf = (s: Awaited<ReturnType<typeof setup>>) => s.t.run(async (ctx) => (await ctx.db.get(s.canvasId))!.plan ?? null);

describe("preparePayment", () => {
  test("records a pending payment at the account's price", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.insert("billingAccounts", { userId: s.celine, trialsUsed: 1, discountPercent: 50, updatedAt: Date.now() })
    );
    const order = await s.t.mutation(internal.payments.preparePayment, { canvasId: s.canvasId, userId: s.celine });
    expect(order).toMatchObject({ amount: Math.round(PLAN_PRICE_USD / 2), currency: "USD", email: "celine@example.com" });
    const payment = await s.t.query(internal.payments.paymentByOrderId, { orderId: order.orderId });
    expect(payment?.status).toBe("pending");
  });

  test("only the canvas's creator pays", async () => {
    const s = await setup();
    await expect(
      s.t.mutation(internal.payments.preparePayment, { canvasId: s.canvasId, userId: s.daren })
    ).rejects.toThrow(/Only the person who created this canvas/);
  });

  test("a plan that runs free for good can't be paid for", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.patch(s.canvasId, { plan: { status: "active", liveSince: Date.now(), grant: "founding" } })
    );
    await expect(
      s.t.mutation(internal.payments.preparePayment, { canvasId: s.canvasId, userId: s.celine })
    ).rejects.toThrow(/already runs free/);
  });
});

describe("markPaid", () => {
  async function pending(s: Awaited<ReturnType<typeof setup>>) {
    const order = await s.t.mutation(internal.payments.preparePayment, { canvasId: s.canvasId, userId: s.celine });
    return (await s.t.query(internal.payments.paymentByOrderId, { orderId: order.orderId }))!._id;
  }

  test("turns a paused plan back on for 30 days", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.patch(s.canvasId, { plan: { status: "paused", liveSince: 1, trialEndsAt: 2 } })
    );
    const before = Date.now();
    await s.t.mutation(internal.payments.markPaid, { paymentId: await pending(s), dimepayToken: "tok" });
    const plan = await planOf(s);
    expect(plan).toMatchObject({ status: "active", liveSince: 1, paymentRef: "tok" });
    expect(plan!.paidUntil! - before).toBeGreaterThanOrEqual(30 * DAY_MS);
    expect(plan!.paidUntil! - before).toBeLessThan(30 * DAY_MS + 60_000);
  });

  test("adds the month after a paid period that's still running", async () => {
    const s = await setup();
    const paidUntil = Date.now() + 10 * DAY_MS;
    await s.t.run((ctx) => ctx.db.patch(s.canvasId, { plan: { status: "active", liveSince: 1, paidUntil } }));
    await s.t.mutation(internal.payments.markPaid, { paymentId: await pending(s), dimepayToken: "tok" });
    expect((await planOf(s))!.paidUntil).toBe(paidUntil + 30 * DAY_MS);
  });

  test("the same payment twice adds one month", async () => {
    const s = await setup();
    const paymentId = await pending(s);
    await s.t.mutation(internal.payments.markPaid, { paymentId, dimepayToken: "tok" });
    const first = (await planOf(s))!.paidUntil;
    await s.t.mutation(internal.payments.markPaid, { paymentId, dimepayToken: "tok" });
    expect((await planOf(s))!.paidUntil).toBe(first);
  });
});

describe("confirmCheckout", () => {
  beforeEach(() => {
    process.env.DIMEPAY_CLIENT_KEY = "ck_test";
    process.env.DIMEPAY_SECRET_KEY = "sk_test_secret_that_is_long_enough";
  });
  afterEach(() => {
    delete process.env.DIMEPAY_CLIENT_KEY;
    delete process.env.DIMEPAY_SECRET_KEY;
    vi.unstubAllGlobals();
  });

  /** DIME PAY answering GET /orders/... with `order`, wrapped the way it wraps responses. */
  function dimepayReturns(order: Record<string, unknown>) {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ statusCode: 200, body: { response: order } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  test("activates the plan when DIME PAY says the order is complete", async () => {
    const s = await setup();
    const order = await s.t.mutation(internal.payments.preparePayment, { canvasId: s.canvasId, userId: s.celine });
    const fetchMock = dimepayReturns({ id: order.orderId, total: order.amount, currency: "USD", status: "COMPLETE" });
    const result = await s.t.action(api.payments.confirmCheckout, { token: "tok-1" });
    expect(result).toEqual({ status: "paid", canvasId: s.canvasId });
    expect((await planOf(s))?.status).toBe("active");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/sandbox\.api\.dimepay\.app\/dapi\/v1\/orders\/ey/);
    expect((init.headers as Record<string, string>).client_key).toBe("ck_test");
  });

  test("leaves the plan alone when the order isn't complete", async () => {
    const s = await setup();
    const order = await s.t.mutation(internal.payments.preparePayment, { canvasId: s.canvasId, userId: s.celine });
    dimepayReturns({ id: order.orderId, total: order.amount, currency: "USD", status: "PENDING" });
    const result = await s.t.action(api.payments.confirmCheckout, { token: "tok-1" });
    expect(result.status).toBe("not_paid");
    expect(await planOf(s)).toBeNull();
  });

  test("ignores orders that aren't ours", async () => {
    const s = await setup();
    dimepayReturns({ id: "someone-else", total: 29, currency: "USD", status: "COMPLETE" });
    const result = await s.t.action(api.payments.confirmCheckout, { token: "tok-1" });
    expect(result.status).toBe("not_paid");
  });
});

test("checkout is off until the DIME PAY keys are set", async () => {
  const s = await setup();
  expect(await s.t.query(api.payments.checkoutAvailable, {})).toBe(false);
  const asCeline = s.t.withIdentity({ subject: `${s.celine}|session` });
  await expect(asCeline.action(api.payments.startCheckout, { canvasId: s.canvasId })).rejects.toThrow(
    /aren't set up yet/
  );
});
