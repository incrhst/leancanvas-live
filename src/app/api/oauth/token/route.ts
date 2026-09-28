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
    let grantType = "";
    let code = "";
    let codeVerifier = "";
    let refreshToken = "";

    // Support both application/x-www-form-urlencoded and JSON per OAuth 2.1 specs
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      grantType = (formData.get("grant_type") as string) || "";
      code = (formData.get("code") as string) || "";
      codeVerifier = (formData.get("code_verifier") as string) || "";
      refreshToken = (formData.get("refresh_token") as string) || "";
    } else {
      const body = await req.json().catch(() => ({}));
      grantType = body.grant_type || "";
      code = body.code || "";
      codeVerifier = body.code_verifier || "";
      refreshToken = body.refresh_token || "";
    }

    if (grantType !== "authorization_code" && grantType !== "refresh_token") {
      return NextResponse.json(
        {
          error: "unsupported_grant_type",
          error_description: "Grant type must be authorization_code or refresh_token",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Issue standard OAuth 2.1 Bearer Token
    const accessToken = `lc_at_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
    const newRefreshToken = `lc_rt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 86400 * 30, // 30 days
        refresh_token: newRefreshToken,
        scope: "openid profile email canvases:read canvases:write",
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "server_error", error_description: err?.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
