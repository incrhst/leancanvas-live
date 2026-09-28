import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clientName = body.client_name || "Claude";
    const redirectUris = body.redirect_uris || [
      "https://claude.ai/api/mcp/oauth/callback",
      "https://desktop.claude.ai/oauth/callback",
    ];

    // Generate dynamic client credentials for Claude
    const clientId = `claude_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    return NextResponse.json(
      {
        client_id: clientId,
        client_name: clientName,
        redirect_uris: redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none", // Public client (PKCE)
        application_type: "web",
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: err?.message },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
