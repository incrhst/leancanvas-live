import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id") || "claude";
  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state") || "";
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";

  // If redirect_uri is missing, show an informative error
  if (!redirectUri) {
    return new NextResponse("Missing redirect_uri parameter", { status: 400 });
  }

  // Render a clean, branded Incrementic authorization approval screen for Claude
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Claude — LeanCanvas Live by Incrementic</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: #FAFAFA;
      color: #2B2C31;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E6E6E8;
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #FDF2F2;
      color: #EA5148;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 20px;
    }
    h1 {
      font-family: 'Sora', sans-serif;
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #2B2C31;
    }
    p {
      font-size: 13px;
      color: #4C4E56;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .permissions {
      text-align: left;
      background: #FAFAFA;
      border: 1px solid #E6E6E8;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .permissions div {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      color: #2B2C31;
    }
    .permissions div:last-child {
      margin-bottom: 0;
    }
    .btn {
      display: block;
      width: 100%;
      background: #EA5148;
      color: #FFFFFF;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 0;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn:hover {
      background: #D93D34;
    }
    .cancel {
      display: inline-block;
      margin-top: 14px;
      font-size: 12px;
      color: #747680;
      text-decoration: none;
    }
    .cancel:hover {
      color: #2B2C31;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span>●</span> OAUTH 2.1 PKCE
    </div>
    <h1>Connect Claude to LeanCanvas</h1>
    <p>
      Claude is requesting permission to view your Lean Canvases, add sticky notes, and run AI stress testing on your business models.
    </p>

    <div class="permissions">
      <div>✓ Read access to your active workspaces and canvases</div>
      <div>✓ Ability to post new notes and update evidence status</div>
      <div>✓ Run Ash Maurya 7-dimension stress test diagnostics</div>
    </div>

    <!-- Generate authorization code and redirect back to Claude -->
    <form method="POST" action="/api/oauth/authorize">
      <input type="hidden" name="redirect_uri" value="${encodeURIComponent(redirectUri)}" />
      <input type="hidden" name="state" value="${encodeURIComponent(state)}" />
      <input type="hidden" name="code_challenge" value="${codeChallenge || ''}" />
      <input type="hidden" name="client_id" value="${clientId}" />
      <button type="submit" class="btn">Allow Access &amp; Connect</button>
    </form>

    <a href="${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}" class="cancel">
      Cancel
    </a>
  </div>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

export async function POST(req: NextRequest) {
  // Process authorization form submission
  const formData = await req.formData();
  const rawRedirectUri = formData.get("redirect_uri") as string;
  const rawState = formData.get("state") as string;
  const codeChallenge = formData.get("code_challenge") as string;

  const redirectUri = decodeURIComponent(rawRedirectUri);
  const state = decodeURIComponent(rawState || "");

  // Generate an authorization code
  const authCode = `auth_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;

  // Redirect back to Claude redirect_uri with code and state
  const targetUrl = new URL(redirectUri);
  targetUrl.searchParams.set("code", authCode);
  if (state) {
    targetUrl.searchParams.set("state", state);
  }

  return NextResponse.redirect(targetUrl.toString(), 302);
}
