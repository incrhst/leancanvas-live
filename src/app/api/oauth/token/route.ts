import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let fields: Record<string, string> = {};

  // Support both application/x-www-form-urlencoded and JSON per OAuth 2.1 specs
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    formData.forEach((value, key) => {
      if (typeof value === "string") fields[key] = value;
    });
  } else {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === "object") {
      fields = Object.fromEntries(
        Object.entries(body).filter(([, v]) => typeof v === "string")
      ) as Record<string, string>;
    }
  }

  const grantType = fields.grant_type || "";
  const clientId = fields.client_id || undefined;

  try {
    let result;
    if (grantType === "authorization_code") {
      if (!fields.code || !fields.code_verifier) {
        return NextResponse.json(
          { error: "invalid_request", error_description: "code and code_verifier are required" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      result = await fetchMutation(api.oauth.exchangeAuthorizationCode, {
        code: fields.code,
        codeVerifier: fields.code_verifier,
        clientId,
        redirectUri: fields.redirect_uri || undefined,
      });
    } else if (grantType === "refresh_token") {
      if (!fields.refresh_token) {
        return NextResponse.json(
          { error: "invalid_request", error_description: "refresh_token is required" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      result = await fetchMutation(api.oauth.refreshAccessToken, {
        refreshToken: fields.refresh_token,
        clientId,
      });
    } else {
      return NextResponse.json(
        {
          error: "unsupported_grant_type",
          error_description: "Grant type must be authorization_code or refresh_token",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, error_description: result.error_description },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        access_token: result.access_token,
        token_type: "Bearer",
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        scope: "canvases:read canvases:write",
      },
      { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Token endpoint error", err);
    return NextResponse.json(
      { error: "server_error", error_description: "Could not issue token" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
