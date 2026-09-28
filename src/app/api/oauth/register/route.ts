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
  const body = await req.json().catch(() => null);
  const redirectUris: unknown = body?.redirect_uris;
  if (!Array.isArray(redirectUris) || !redirectUris.every((u) => typeof u === "string")) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris must be an array of URLs" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const client = await fetchMutation(api.oauth.registerClient, {
      clientName: typeof body?.client_name === "string" ? body.client_name : undefined,
      redirectUris,
    });

    return NextResponse.json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none", // Public client (PKCE)
        application_type: "web",
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Client registration failed", err);
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Client registration was rejected" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
