import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      keys: [
        {
          kty: "RSA",
          use: "sig",
          alg: "RS256",
          kid: "leancanvas-2026-key",
          n: "u1lX8Q3...example",
          e: "AQAB",
        },
      ],
    },
    { headers: CORS_HEADERS }
  );
}
