import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "../../../../../convex/_generated/api";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function errorPage(message: string, status = 400) {
  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;color:#2B2C31"><h1 style="font-size:18px">Authorization error</h1><p style="font-size:14px">${escapeHtml(message)}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html" } }
  );
}

interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

/**
 * Validates client_id + redirect_uri against the registered client.
 * Until both are valid we must never redirect to redirect_uri.
 */
async function validateClient(params: AuthorizeParams) {
  if (!params.clientId || !params.redirectUri) {
    return { error: "Missing client_id or redirect_uri parameter" };
  }
  const client = await fetchQuery(api.oauth.getClient, { clientId: params.clientId });
  if (!client) return { error: "Unknown client_id. Please reconnect the connector." };
  if (!client.redirectUris.includes(params.redirectUri)) {
    return { error: "redirect_uri is not registered for this client" };
  }
  return { client };
}

function redirectWithParams(redirectUri: string, params: Record<string, string>) {
  const target = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target.toString(), 302);
}

async function getSignedInEmail(token: string): Promise<string | null> {
  const profile = await fetchQuery(api.users.getMyProfile, {}, { token });
  return profile ? profile.email ?? "your account" : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params: AuthorizeParams = {
    clientId: searchParams.get("client_id") || "",
    redirectUri: searchParams.get("redirect_uri") || "",
    state: searchParams.get("state") || "",
    codeChallenge: searchParams.get("code_challenge") || "",
    codeChallengeMethod: searchParams.get("code_challenge_method") || "S256",
  };

  const { client, error } = await validateClient(params);
  if (!client) return errorPage(error);

  if (searchParams.get("response_type") && searchParams.get("response_type") !== "code") {
    return redirectWithParams(params.redirectUri, { error: "unsupported_response_type", state: params.state });
  }
  if (!params.codeChallenge || params.codeChallengeMethod !== "S256") {
    return redirectWithParams(params.redirectUri, {
      error: "invalid_request",
      error_description: "PKCE (S256) is required",
      state: params.state,
    });
  }

  // The user must be signed in to LeanCanvas to grant access to their canvases.
  const token = await convexAuthNextjsToken();
  const email = token ? await getSignedInEmail(token) : null;
  if (!email) {
    const here = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(here)}`, req.url), 302);
  }

  const cancelUrl = new URL(params.redirectUri);
  cancelUrl.searchParams.set("error", "access_denied");
  if (params.state) cancelUrl.searchParams.set("state", params.state);

  const clientName = escapeHtml(client.clientName);

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
    <h1>Connect ${clientName} to LeanCanvas</h1>
    <p>
      ${clientName} is requesting permission to view your Lean and GTM canvases, add sticky notes, and run AI stress testing on your business models.
    </p>

    <div class="permissions">
      <div>✓ Read access to your active workspaces and canvases</div>
      <div>✓ Ability to create canvases, post new notes and update evidence status</div>
      <div>✓ Run 7-dimension stress test diagnostics</div>
    </div>

    <form method="POST" action="/api/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
      <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}" />
      <button type="submit" class="btn">Allow Access &amp; Connect</button>
    </form>

    <p style="margin: 16px 0 0 0; font-size: 12px;">Signed in as <strong>${escapeHtml(email)}</strong></p>

    <a href="${escapeHtml(cancelUrl.toString())}" class="cancel">
      Cancel
    </a>
  </div>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    },
  });
}

export async function POST(req: NextRequest) {
  // Reject cross-site form posts (CSRF): the approval must come from our own authorize page.
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return errorPage("Invalid request origin", 403);
  }

  const formData = await req.formData();
  const params: AuthorizeParams = {
    clientId: (formData.get("client_id") as string) || "",
    redirectUri: (formData.get("redirect_uri") as string) || "",
    state: (formData.get("state") as string) || "",
    codeChallenge: (formData.get("code_challenge") as string) || "",
    codeChallengeMethod: (formData.get("code_challenge_method") as string) || "S256",
  };

  const { client, error } = await validateClient(params);
  if (!client) return errorPage(error);

  const token = await convexAuthNextjsToken();
  if (!token) {
    return errorPage("Your session has expired. Please start the connection again from Claude.", 401);
  }

  try {
    const code = await fetchMutation(
      api.oauth.createAuthorizationCode,
      {
        clientId: params.clientId,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: params.codeChallengeMethod,
      },
      { token }
    );
    return redirectWithParams(params.redirectUri, { code, state: params.state });
  } catch (err) {
    console.error("Failed to create authorization code", err);
    return redirectWithParams(params.redirectUri, { error: "server_error", state: params.state });
  }
}
