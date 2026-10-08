import { NextRequest, NextResponse } from "next/server";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { api } from "../../../../convex/_generated/api";
import { GTM_BLOCK_IDS, LEAN_BLOCK_IDS } from "../../../../convex/lib/canvasTemplates";
import { getCanvasTemplate } from "../../../utils/canvasTemplates";

const ALL_BLOCK_IDS = [...new Set([...LEAN_BLOCK_IDS, ...GTM_BLOCK_IDS])];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

const TOOLS_MANIFEST = [
  {
    name: "list_canvases",
    description: "List the canvases (Lean or GTM) the signed-in user owns or collaborates on (returns canvasId, title, template, role and URL)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_canvas",
    description: "Create a new canvas for a startup, project, or business idea: a Lean Canvas (default) or a GTM Canvas",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the canvas (e.g. 'AI Bookkeeping for Freelancers')",
        },
        description: {
          type: "string",
          description: "Optional one-sentence summary of the business model or problem being solved",
        },
        template: {
          type: "string",
          enum: ["lean", "gtm"],
          default: "lean",
          description:
            "'lean' for a Lean Canvas (business model: problem, solution, metrics, costs), or 'gtm' for a go-to-market canvas (ideal customer, positioning, channels, sales motion, pricing, 90-day launch plan)",
        },
        seedNotes: {
          type: "boolean",
          description: "Whether to initialize with standard starter notes (default: true)",
          default: true,
        },
      },
      required: ["title"],
    },
  },
  {
    name: "get_canvas",
    description: "Fetch a canvas (Lean or GTM) with all of its blocks and sticky notes",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: {
          type: "string",
          description: "The canvasId returned by list_canvases or create_canvas",
        },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "add_note",
    description:
      `Add a new sticky note to a block of a canvas. The block must belong to the canvas's template. ` +
      `Lean blocks: ${LEAN_BLOCK_IDS.join(", ")}. GTM blocks: ${GTM_BLOCK_IDS.join(", ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        block: {
          type: "string",
          enum: ALL_BLOCK_IDS,
        },
        content: { type: "string" },
        evidenceState: {
          type: "string",
          enum: ["unknown", "assumption", "observed", "supported", "contradicted", "decision"],
          default: "assumption",
        },
      },
      required: ["canvasId", "block", "content"],
    },
  },
  {
    name: "update_evidence_state",
    description: "Update the empirical evidence state of a note",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        evidenceState: {
          type: "string",
          enum: ["unknown", "assumption", "observed", "supported", "contradicted", "decision"],
        },
      },
      required: ["noteId", "evidenceState"],
    },
  },
  {
    name: "run_stress_test",
    description:
      "Run the 7-dimension AI stress test on a canvas (Ash Maurya methodology for Lean Canvases, go-to-market criteria for GTM Canvases)",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
      },
      required: ["canvasId"],
    },
  },
];

const UNAUTHORIZED_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
  "WWW-Authenticate":
    'Bearer error="invalid_token", resource_metadata="https://lean.incrementic.com/.well-known/oauth-protected-resource"',
};

function unauthorized(id: unknown, message: string) {
  return new NextResponse(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code: -32001, message } }),
    { status: 401, headers: UNAUTHORIZED_HEADERS }
  );
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function callTool(accessToken: string, toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case "list_canvases":
      return await fetchQuery(api.mcp.listCanvases, { accessToken });
    case "get_canvas":
      return await fetchQuery(api.mcp.getCanvas, { accessToken, canvasId: str(args.canvasId) });
    case "create_canvas": {
      const result = await fetchMutation(api.mcp.createCanvas, {
        accessToken,
        title: str(args.title),
        description: str(args.description) || undefined,
        seedNotes: typeof args.seedNotes === "boolean" ? args.seedNotes : undefined,
        template: (str(args.template) || undefined) as any, // validated by Convex
      });
      const label = getCanvasTemplate(str(args.template)).label;
      return {
        success: true,
        ...result,
        message: `Created new ${label}. View and collaborate in realtime at ${result.url}`,
      };
    }
    case "add_note":
      return await fetchMutation(api.mcp.addNote, {
        accessToken,
        canvasId: str(args.canvasId),
        block: args.block as any, // validated by Convex
        content: str(args.content),
        evidenceState: (args.evidenceState as any) || undefined,
      });
    case "update_evidence_state":
      return await fetchMutation(api.mcp.updateEvidenceState, {
        accessToken,
        noteId: str(args.noteId),
        evidenceState: args.evidenceState as any, // validated by Convex
      });
    case "run_stress_test":
      return await fetchAction(api.mcp.runStressTest, { accessToken, canvasId: str(args.canvasId) });
    default:
      return undefined;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  // When Claude tests if authentication is required, returning 401 with WWW-Authenticate triggers "Sign in now" detection!
  if (!authHeader) {
    return new NextResponse(
      JSON.stringify({
        error: "unauthorized",
        message: "Authentication required to access LeanCanvas MCP tools",
      }),
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "WWW-Authenticate":
            'Bearer error="unauthorized", resource_metadata="https://lean.incrementic.com/.well-known/oauth-protected-resource"',
        },
      }
    );
  }

  // Discovery manifest including OAuth 2.1 authentication info
  return NextResponse.json(
    {
      name: "leancanvas-live",
      version: "0.1.0",
      description: "LeanCanvas Live Model Context Protocol endpoint for Claude Connectors",
      protocol: "mcp/sse",
      endpoints: {
        http: "https://lean.incrementic.com/api/mcp",
        sse: "https://lean.incrementic.com/api/mcp/sse",
      },
      authentication: {
        type: "oauth2",
        issuer: "https://lean.incrementic.com",
        authorization_endpoint: "https://lean.incrementic.com/api/oauth/authorize",
        token_endpoint: "https://lean.incrementic.com/api/oauth/token",
        scopes: ["canvases:read", "canvases:write"],
      },
      tools: TOOLS_MANIFEST,
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const accessToken = bearerToken(req);

  // When Claude probes the connector with POST initialize, it checks for 401 Unauthorized + WWW-Authenticate to detect OAuth!
  if (!authHeader) {
    return new NextResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Unauthorized: OAuth authentication required",
        },
      }),
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "WWW-Authenticate":
            'Bearer error="unauthorized", resource_metadata="https://lean.incrementic.com/.well-known/oauth-protected-resource"',
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    if (!accessToken || !(await fetchQuery(api.mcp.verifyToken, { accessToken }))) {
      return unauthorized(id, "Invalid or expired access token");
    }

    // Handle JSON-RPC / MCP protocol methods
    if (method === "initialize") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "leancanvas-live",
              version: "0.1.0",
            },
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (method === "notifications/initialized") {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }

    if (method === "tools/list") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            tools: TOOLS_MANIFEST,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};

      let resultText = "";
      let isError = false;

      try {
        const result = await callTool(accessToken, toolName, args);
        if (result === undefined) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32601,
                message: `Tool not found: ${toolName}`,
              },
            },
            { status: 404, headers: CORS_HEADERS }
          );
        }
        resultText = JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof ConvexError && err.data === "INVALID_ACCESS_TOKEN") {
          return unauthorized(id, "Invalid or expired access token");
        }
        isError = true;
        resultText =
          err instanceof ConvexError && typeof err.data === "string"
            ? err.data
            : `Error: ${err instanceof Error ? err.message : "tool call failed"}`;
      }

      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: resultText,
              },
            ],
            isError,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // Default response for unhandled ping or standard methods
    if (method === "ping") {
      return NextResponse.json({ jsonrpc: "2.0", id, result: {} }, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not supported: ${method}` },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error", data: err?.message },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
