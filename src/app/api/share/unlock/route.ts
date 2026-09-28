import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

/**
 * Viewer's IP as set by Vercel's edge (clients can't spoof these on Vercel; locally they're absent).
 */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") || forwarded || "unknown";
}

/**
 * Exchanges a public share link password for a viewing pass, rate-limited per viewer IP.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!token || !password) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const serverSecret = process.env.SHARE_UNLOCK_SECRET;
  if (!serverSecret) {
    console.error("SHARE_UNLOCK_SECRET is not configured");
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }

  try {
    const result = await fetchMutation(api.canvases.unlockPublicView, {
      token,
      password,
      clientIp: clientIp(req),
      serverSecret,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : result.reason === "rate_limited" ? 429 : 401,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Share unlock failed", err);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
