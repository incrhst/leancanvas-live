import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth, sha256Hex } from "./lib/auth";

const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return prefix + base64Url(bytes);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

async function issueTokens(ctx: MutationCtx, clientId: string, userId: Id<"users">) {
  const accessToken = randomToken("lc_at_");
  const refreshToken = randomToken("lc_rt_");
  await ctx.db.insert("oauthTokens", {
    accessTokenHash: await sha256Hex(accessToken),
    refreshTokenHash: await sha256Hex(refreshToken),
    clientId,
    userId,
    accessExpiresAt: Date.now() + ACCESS_TOKEN_TTL_MS,
  });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  };
}

/**
 * RFC 7591 Dynamic Client Registration (public clients, PKCE only).
 */
export const registerClient = mutation({
  args: {
    clientName: v.optional(v.string()),
    redirectUris: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.redirectUris.length === 0 || args.redirectUris.length > 10) {
      throw new Error("redirect_uris must contain between 1 and 10 URIs");
    }
    for (const uri of args.redirectUris) {
      if (!isAllowedRedirectUri(uri)) throw new Error(`Invalid redirect_uri: ${uri}`);
    }

    const clientId = randomToken("lc_client_");
    const clientName = (args.clientName || "MCP Client").slice(0, 100);
    await ctx.db.insert("oauthClients", {
      clientId,
      clientName,
      redirectUris: args.redirectUris,
      createdAt: Date.now(),
    });
    return { clientId, clientName, redirectUris: args.redirectUris };
  },
});

/**
 * Public client metadata, used by the authorize screen to validate the request.
 */
export const getClient = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (!client) return null;
    return { clientName: client.clientName, redirectUris: client.redirectUris };
  },
});

/**
 * Called when the signed-in user approves the authorize screen. Returns a single-use code.
 */
export const createAuthorizationCode = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    codeChallengeMethod: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.codeChallengeMethod !== "S256" || !args.codeChallenge) {
      throw new Error("PKCE with code_challenge_method=S256 is required");
    }
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (!client) throw new Error("Unknown client_id");
    if (!client.redirectUris.includes(args.redirectUri)) {
      throw new Error("redirect_uri is not registered for this client");
    }

    const code = randomToken("lc_code_");
    await ctx.db.insert("oauthCodes", {
      codeHash: await sha256Hex(code),
      clientId: args.clientId,
      userId: user._id,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    });
    return code;
  },
});

const tokenResult = v.union(
  v.object({
    ok: v.literal(true),
    access_token: v.string(),
    refresh_token: v.string(),
    expires_in: v.number(),
  }),
  v.object({ ok: v.literal(false), error: v.string(), error_description: v.string() })
);

/**
 * Token endpoint: authorization_code grant with PKCE verification.
 */
export const exchangeAuthorizationCode = mutation({
  args: {
    code: v.string(),
    codeVerifier: v.string(),
    clientId: v.optional(v.string()),
    redirectUri: v.optional(v.string()),
  },
  returns: tokenResult,
  handler: async (ctx, args) => {
    const invalid = (description: string) => ({
      ok: false as const,
      error: "invalid_grant",
      error_description: description,
    });

    const codeHash = await sha256Hex(args.code);
    const codeDoc = await ctx.db
      .query("oauthCodes")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", codeHash))
      .unique();

    if (!codeDoc) return invalid("Unknown authorization code");
    if (codeDoc.usedAt) return invalid("Authorization code already used");
    if (codeDoc.expiresAt < Date.now()) return invalid("Authorization code expired");
    if (args.clientId && args.clientId !== codeDoc.clientId) return invalid("client_id mismatch");
    if (args.redirectUri && args.redirectUri !== codeDoc.redirectUri) return invalid("redirect_uri mismatch");
    if ((await pkceS256(args.codeVerifier)) !== codeDoc.codeChallenge) {
      return invalid("PKCE verification failed");
    }

    await ctx.db.patch(codeDoc._id, { usedAt: Date.now() });
    const tokens = await issueTokens(ctx, codeDoc.clientId, codeDoc.userId);
    return { ok: true as const, ...tokens };
  },
});

/**
 * Token endpoint: refresh_token grant with rotation (the old token pair is revoked).
 */
export const refreshAccessToken = mutation({
  args: {
    refreshToken: v.string(),
    clientId: v.optional(v.string()),
  },
  returns: tokenResult,
  handler: async (ctx, args) => {
    const refreshHash = await sha256Hex(args.refreshToken);
    const existing = await ctx.db
      .query("oauthTokens")
      .withIndex("by_refresh_hash", (q) => q.eq("refreshTokenHash", refreshHash))
      .unique();

    if (!existing || existing.revokedAt || (args.clientId && args.clientId !== existing.clientId)) {
      return { ok: false as const, error: "invalid_grant", error_description: "Invalid refresh token" };
    }

    await ctx.db.patch(existing._id, { revokedAt: Date.now() });
    const tokens = await issueTokens(ctx, existing.clientId, existing.userId);
    return { ok: true as const, ...tokens };
  },
});
