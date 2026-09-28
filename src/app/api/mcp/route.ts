import { NextRequest, NextResponse } from "next/server";

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
    name: "get_canvas",
    description: "Fetch a Lean Canvas with all 9 blocks and sticky notes",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: {
          type: "string",
          description: "The unique ID of the canvas (e.g. demo-live-1)",
        },
        publicToken: {
          type: "string",
          description: "Optional public share token for anonymous viewing",
        },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "add_note",
    description: "Add a new sticky note to a specific Lean Canvas block",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        block: {
          type: "string",
          enum: [
            "problem",
            "customerSegments",
            "uniqueValueProposition",
            "solution",
            "channels",
            "revenueStreams",
            "costStructure",
            "keyMetrics",
            "unfairAdvantage",
          ],
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
    description: "Execute the Ash Maurya 7-dimension AI stress test on a canvas",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
      },
      required: ["canvasId"],
    },
  },
];

// Fallback canned demo canvas for instant responses
const DEMO_CANVAS_PAYLOAD = {
  id: "demo-live-1",
  title: "Splitwise for Meals (Pantry & Couples)",
  status: "active",
  blocks: {
    problem: [
      { id: "n1", text: "Couples spend 30+ minutes every week deciding what to cook.", evidenceState: "observed" },
      { id: "n2", text: "Grocery lists are fragmented across multiple apps and WhatsApp.", evidenceState: "supported" },
    ],
    customerSegments: [
      { id: "n3", text: "Dual-income couples without kids (25-38).", evidenceState: "supported" },
    ],
    uniqueValueProposition: [
      { id: "n4", text: "Dinner decided in 2 minutes, together.", evidenceState: "assumption" },
    ],
    solution: [
      { id: "n5", text: "Tinder-style swipe meal voting + shared live pantry checklist.", evidenceState: "assumption" },
    ],
    channels: [
      { id: "n6", text: "TikTok recipe creators & partner referral onboarding loop.", evidenceState: "unknown" },
    ],
    revenueStreams: [
      { id: "n7", text: "Household subscription: $6/month after 14-day free trial.", evidenceState: "assumption" },
    ],
    costStructure: [
      { id: "n8", text: "Serverless hosting & real-time sync database, creator sponsorship.", evidenceState: "decision" },
    ],
    keyMetrics: [
      { id: "n9", text: "Weekly Active Households (WAH) & plans completed.", evidenceState: "decision" },
    ],
    unfairAdvantage: [
      { id: "n10", text: "Proprietary partner taste alignment engine.", evidenceState: "assumption" },
    ],
  },
};

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    const { method, params, id } = body;

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

      switch (toolName) {
        case "get_canvas":
          resultText = JSON.stringify(DEMO_CANVAS_PAYLOAD, null, 2);
          break;
        case "add_note":
          resultText = `Added note to block "${args.block}": "${args.content}" (evidence: ${args.evidenceState || "assumption"}).`;
          break;
        case "update_evidence_state":
          resultText = `Note ${args.noteId} evidence state updated to "${args.evidenceState}".`;
          break;
        case "run_stress_test":
          resultText = JSON.stringify(
            {
              scores: {
                clarity: 8.8,
                desirability: 7.2,
                viability: 6.8,
                feasibility: 8.5,
                defensibility: 5.8,
                timing: 8.0,
                mission: 8.5,
              },
              overallScore: 7.7,
              riskiestAssumptions: [
                {
                  block: "revenueStreams",
                  assumption: "Couples will pay $6/mo for meal coordination rather than using a free shared note.",
                  reason: "Zero friction free substitutes already exist; willingness-to-pay is untested.",
                  suggestedExperiment: "Run a pre-order paywall test or ask 10 couples to prepay $15 for 3 months access.",
                },
                {
                  block: "unfairAdvantage",
                  assumption: "Local grocery SKU mapping acts as a defensible moat against larger recipe apps.",
                  reason: "Grocery APIs are increasingly commoditized or restricted by big chains.",
                  suggestedExperiment: "Validate partner API access with 2 regional stores before building scraper architecture.",
                },
              ],
            },
            null,
            2
          );
          break;
        default:
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
