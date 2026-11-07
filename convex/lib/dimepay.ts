import { ConvexError } from "convex/values";
import { SignJWT } from "jose";

/**
 * DIME PAY's hosted checkout (https://docs.dimepay.net). Request bodies are
 * `{ lang, data: <JWT of the payload, HS256 with the secret key> }` with the client key in a
 * `client_key` header; responses are wrapped as `{ statusCode, body: { response } }`.
 * The field names follow the published docs and the osoobe/dimepay-laravel-sdk, which the docs
 * leave open; confirm them on the first sandbox payment.
 *
 * A plan is only ever marked paid from an order fetched back from DIME PAY here, never from what
 * a redirect or webhook says, since DIME PAY doesn't publish how webhooks are signed.
 *
 * Environment: DIMEPAY_CLIENT_KEY, DIMEPAY_SECRET_KEY, DIMEPAY_ENV ("sandbox" by default, or
 * "production"), and optionally DIMEPAY_PAID_STATUSES (comma-separated order statuses that mean
 * paid; default below).
 */

const BASE_URLS = {
  production: "https://api.dimepay.app/dapi/v1",
  sandbox: "https://sandbox.api.dimepay.app/dapi/v1",
};

// Order statuses that mean the money was taken. Anything else, including a status we haven't
// seen, leaves the plan unpaid.
const DEFAULT_PAID_STATUSES = ["COMPLETE", "COMPLETED", "PAID", "SUCCESS", "SUCCEEDED"];

export function dimepayConfig() {
  const clientKey = process.env.DIMEPAY_CLIENT_KEY;
  const secretKey = process.env.DIMEPAY_SECRET_KEY;
  if (!clientKey || !secretKey) return null;
  const env = process.env.DIMEPAY_ENV === "production" ? "production" : "sandbox";
  const paidStatuses = (process.env.DIMEPAY_PAID_STATUSES ?? DEFAULT_PAID_STATUSES.join(","))
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return { clientKey, secretKey, env, baseUrl: BASE_URLS[env], paidStatuses } as const;
}

export type DimepayConfig = NonNullable<ReturnType<typeof dimepayConfig>>;

export function requireDimepayConfig() {
  const config = dimepayConfig();
  if (!config) throw new ConvexError("Card payments aren't set up yet.");
  return config;
}

async function sign(config: DimepayConfig, payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(config.secretKey));
}

async function request(config: DimepayConfig, method: "GET" | "POST", path: string, body?: unknown) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: { client_key: config.clientKey, Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    body?: { response?: unknown; message?: unknown };
    message?: unknown;
  };
  if (!response.ok) {
    const message = json.body?.message ?? json.message ?? response.statusText;
    console.error(`DIME PAY ${method} ${path} failed (${response.status})`, JSON.stringify(json));
    throw new ConvexError(
      `The payment provider turned the request down: ${Array.isArray(message) ? message.join(", ") : String(message)}`
    );
  }
  return (json.body?.response ?? json.body ?? json) as Record<string, unknown>;
}

export type CheckoutOrder = {
  // Our id for the order, echoed back on the fetched order
  id: string;
  amount: number;
  currency: string;
  email: string;
  itemName: string;
  itemDescription: string;
  sku: string;
  redirectUrl: string;
  webhookUrl: string;
  checkoutUrl: string;
};

/** Creates DIME PAY's hosted payment page for an order and returns the URL to send the payer to. */
export async function createHostedPage(config: DimepayConfig, order: CheckoutOrder) {
  const payload = {
    id: order.id,
    total: order.amount,
    subtotal: order.amount,
    tax: 0,
    discount: 0,
    currency: order.currency,
    email: order.email,
    // Required by DIME PAY; the payer's IP isn't known to the backend
    ipAddress: "0.0.0.0",
    referenceTransactionId: order.id,
    webhookUrl: order.webhookUrl,
    redirectUrl: order.redirectUrl,
    checkoutUrl: order.checkoutUrl,
    fulfilled: false,
    items: [
      {
        id: order.sku,
        name: order.itemName,
        price: order.amount,
        quantity: 1,
        sku: order.sku,
        shortDescription: order.itemDescription,
      },
    ],
    taxes: [],
  };
  const result = await request(config, "POST", "/payments/hosted-page", {
    lang: "en",
    data: await sign(config, payload),
  });
  const url = result.orderUrl ?? result.order_url ?? result.url;
  if (typeof url !== "string") {
    console.error("DIME PAY hosted page response had no URL", JSON.stringify(result));
    throw new ConvexError("The payment provider didn't return a checkout page.");
  }
  return url;
}

/** Fetches an order from DIME PAY by the token it gave back on the redirect or webhook. */
export async function getOrder(config: DimepayConfig, token: string) {
  return await request(config, "GET", `/orders/${await sign(config, { token })}`);
}

export type PaidCheck = { paid: true } | { paid: false; why: string };

/**
 * Whether a fetched order is our order, for the expected amount, and paid. Fails closed: any
 * mismatch or unknown status is unpaid.
 */
export function checkOrderPaid(
  config: Pick<DimepayConfig, "paidStatuses">,
  order: Record<string, unknown>,
  expected: { id: string; amount: number; currency: string }
): PaidCheck {
  if (order.id !== expected.id) return { paid: false, why: `order id is ${String(order.id)}` };
  const currency = typeof order.currency === "string" ? order.currency.toUpperCase() : undefined;
  if (currency !== expected.currency.toUpperCase()) return { paid: false, why: `currency is ${String(order.currency)}` };
  if (typeof order.total !== "number" || Math.abs(order.total - expected.amount) > 0.005) {
    return { paid: false, why: `total is ${String(order.total)}` };
  }
  const status = typeof order.status === "string" ? order.status.toUpperCase() : undefined;
  if (!status || !config.paidStatuses.includes(status)) return { paid: false, why: `status is ${String(order.status)}` };
  return { paid: true };
}

/**
 * The order token in a webhook body, wherever DIME PAY puts it. Only used to know which order
 * to fetch and check.
 */
export function tokenFromWebhook(body: unknown): string | null {
  const seen = new Set<unknown>();
  const find = (value: unknown, depth: number): string | null => {
    if (!value || typeof value !== "object" || depth > 4 || seen.has(value)) return null;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ["token", "orderToken", "order_token"]) {
      if (typeof record[key] === "string" && record[key]) return record[key] as string;
    }
    for (const child of Object.values(record)) {
      const found = find(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return find(body, 0);
}
