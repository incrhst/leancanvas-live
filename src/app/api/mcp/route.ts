import { NextRequest, NextResponse } from "next/server";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { api } from "../../../../convex/_generated/api";
import { GTM_BLOCK_IDS, LEAN_BLOCK_IDS } from "../../../../convex/lib/canvasTemplates";
import { getCanvasTemplate } from "../../../utils/canvasTemplates";
import { EVIDENCE_GLOSSARY, EVIDENCE_STATES } from "../../../utils/evidenceStates";

const ALL_BLOCK_IDS = [...new Set([...LEAN_BLOCK_IDS, ...GTM_BLOCK_IDS])];
const EVIDENCE_STATE_PROPERTY = {
  type: "string",
  enum: EVIDENCE_STATES,
  description: `How well the note is evidenced: ${EVIDENCE_GLOSSARY}`,
};

// Optional test fields, shared by add_note and update_note. On update_note, null clears a field.
const TEST_FIELD_PROPERTIES = {
  measure: {
    type: ["string", "null"],
    description: "What we watch to test this note, e.g. 'Cost per budget-tool start, by post'",
  },
  passMark: {
    type: ["string", "null"],
    description: "What counts as success, e.g. 'Below $2 per start'",
  },
  reviewDate: {
    type: ["string", "null"],
    description: "When the result is checked, as YYYY-MM-DD",
  },
  reviewDay: {
    type: "integer",
    description:
      "Alternative to reviewDate: the day of the plan, counted from the canvas's launchDate (day 0), e.g. 30. Needs a launchDate.",
  },
  latestResult: {
    type: ["object", "null"],
    description: "The most recent result. Replaces the previous one, which stays in the note's history.",
    properties: {
      text: { type: "string", description: "What was seen, in a line or two" },
      date: { type: "string", description: "YYYY-MM-DD; defaults to today (UTC)" },
      verdict: {
        type: "string",
        enum: ["pass", "fail", "inconclusive"],
        description: "How the result compares with the pass mark",
      },
    },
    required: ["text"],
  },
};

const LAUNCH_DATE_PROPERTY = {
  type: "string",
  description:
    "Day 0 of the plan, as YYYY-MM-DD. Review dates then also read as days of the plan (reviewDay), e.g. day 30.",
};

const OWNER_PROPERTY = {
  type: ["string", "null"],
  description:
    "The one person responsible for the note: a userId from list_canvas_members (viewers can own notes too). null clears it.",
};

const MARKETS_PROPERTY = {
  type: ["array", "null"],
  items: { type: "string" },
  description:
    "Markets where the note holds, e.g. ['Jamaica']. Leave a note untagged when it applies everywhere, so a result from one market doesn't read as true in all of them. Up to 5; [] or null clears.",
};

const REASON_PROPERTY = {
  type: "string",
  description: "Optional one line on why, kept in the note's history",
};

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
        launchDate: LAUNCH_DATE_PROPERTY,
      },
      required: ["title"],
    },
  },
  {
    name: "update_canvas",
    description: "Change a canvas's title, description or launch date. Pass only what changes.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        launchDate: {
          type: ["string", "null"],
          description: `${LAUNCH_DATE_PROPERTY.description} null clears it.`,
        },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "get_canvas",
    description:
      "Fetch a canvas (Lean or GTM) with all of its blocks and sticky notes, including each note's evidence state and, where set, its test (measure, passMark, reviewDate, latestResult). Each note shows its owner and market tags if it has them; pass ownerUserId to see one person's notes, or market to see what holds in one market. If the canvas has a launchDate, it also returns currentDay and each note's reviewDay (days since launch).",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: {
          type: "string",
          description: "The canvasId returned by list_canvases or create_canvas",
        },
        ownerUserId: {
          type: "string",
          description: "Only return notes owned by this userId, or 'unassigned' for notes with no owner",
        },
        market: {
          type: "string",
          description: "Only return notes that hold in this market: tagged with it, or untagged (which means every market)",
        },
      },
      required: ["canvasId"],
    },
  },
  {
    name: "list_canvas_members",
    description:
      "List everyone with access to a canvas (userId, name, email, role). Use a userId as a note's owner in add_note or update_note, or to filter get_canvas.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
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
        evidenceState: { ...EVIDENCE_STATE_PROPERTY, default: "assumption" },
        ownerUserId: OWNER_PROPERTY,
        markets: MARKETS_PROPERTY,
        ...TEST_FIELD_PROPERTIES,
        reason: REASON_PROPERTY,
      },
      required: ["canvasId", "block", "content"],
    },
  },
  {
    name: "update_note",
    description:
      "Reword a note, move it to another block of the same canvas, change its evidence state or owner, or set its test " +
      "(measure, passMark, reviewDate, latestResult). Pass only what changes; null clears a test field. " +
      "Use this instead of adding a second note when refining one. Every change is kept in the note's history.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "The noteId from get_canvas" },
        content: { type: "string", description: "New text for the note" },
        block: {
          type: "string",
          enum: ALL_BLOCK_IDS,
          description: "Move the note to this block (it goes to the end). Must belong to the canvas's template.",
        },
        evidenceState: EVIDENCE_STATE_PROPERTY,
        ownerUserId: OWNER_PROPERTY,
        markets: MARKETS_PROPERTY,
        ...TEST_FIELD_PROPERTIES,
        reason: REASON_PROPERTY,
        link: { type: "string", description: "Optional link backing the change, kept in the note's history" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "delete_note",
    description: "Remove a note from its canvas. Its history, including its last text, stays readable through get_note_history.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        reason: REASON_PROPERTY,
      },
      required: ["noteId"],
    },
  },
  {
    name: "get_note_history",
    description:
      "List every change to a note, newest first: who made it, when, whether it came from the app or an agent, what changed from and to, and the reason if one was given. Works for deleted notes too.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "request_decision",
    description:
      "Ask one canvas member to decide on a note. They're emailed a link and can answer from their phone, even with view-only access. A note can have one open request at a time.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        question: { type: "string", description: "The yes/no question to decide, in one line" },
        deciderUserId: { type: "string", description: "Who decides: a userId from list_canvas_members" },
        dueDate: { type: "string", description: "When it's needed by, as YYYY-MM-DD" },
        dueDay: {
          type: "integer",
          description: "Alternative to dueDate: the day of the plan, counted from the canvas's launchDate",
        },
      },
      required: ["noteId", "question", "deciderUserId"],
    },
  },
  {
    name: "answer_decision",
    description:
      "Answer a decision request addressed to you. approve or reject makes the note a decision; change sends it back to whoever asked, with your comment, and leaves the note as it is. Works with view-only access.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        answer: { type: "string", enum: ["approve", "reject", "change"] },
        comment: { type: "string", description: "Optional for approve and reject; required for change" },
      },
      required: ["noteId", "answer"],
    },
  },
  {
    name: "withdraw_decision",
    description: "Cancel an open decision request on a note.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        reason: REASON_PROPERTY,
      },
      required: ["noteId"],
    },
  },
  {
    name: "list_decisions",
    description:
      "With a canvasId: every note on that canvas with a decision request, open or answered, soonest due first. Without: the open decisions waiting on you across all your canvases.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
      },
    },
  },
  {
    name: "create_snapshot",
    description:
      "Freeze a canvas as it is now under a label, e.g. 'Day 30', so it can be compared with later. Take one before each review.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        label: { type: "string", description: "Short name, e.g. 'Day 0' or 'Day 30 review'" },
      },
      required: ["canvasId", "label"],
    },
  },
  {
    name: "list_snapshots",
    description: "List a canvas's snapshots, newest first, with their snapshotId, label, date and day of the plan.",
    inputSchema: {
      type: "object",
      properties: { canvasId: { type: "string" } },
      required: ["canvasId"],
    },
  },
  {
    name: "compare_snapshots",
    description:
      "Compare two snapshots, or a snapshot and the canvas now: which notes were added, removed, or changed (text, block, evidence state, test fields, owner, decision status), field by field.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        from: { type: "string", description: "The earlier snapshotId" },
        to: { type: "string", description: "The later snapshotId, or 'current' for the canvas now (default)" },
      },
      required: ["canvasId", "from"],
    },
  },
  {
    name: "update_evidence_state",
    description: "Update the empirical evidence state of a note",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        evidenceState: EVIDENCE_STATE_PROPERTY,
        reason: REASON_PROPERTY,
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
  {
    name: "export_canvas",
    description:
      "Get a link that downloads a canvas, or its riskiest assumptions, as a PDF or PNG. The file is rendered in the browser, so the user opens the link while signed in to LeanCanvas and the download starts once the canvas loads. The riskiest assumptions need a stress test first.",
    inputSchema: {
      type: "object",
      properties: {
        canvasId: { type: "string" },
        view: {
          type: "string",
          enum: ["canvas", "riskiest_assumptions"],
          default: "canvas",
          description:
            "'canvas' for the full board, or 'riskiest_assumptions' for the ranked risks from the latest stress test",
        },
        format: {
          type: "string",
          enum: ["pdf", "png"],
          default: "pdf",
        },
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

function optStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** A string sets a field, null clears it, anything else leaves it alone. */
function nullableStr(value: unknown): string | null | undefined {
  return value === null ? null : optStr(value);
}

/** An array of strings sets the tags, null clears them, anything else leaves them alone. */
function marketsArg(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
}

function testFieldArgs(args: Record<string, unknown>) {
  const result = args.latestResult as Record<string, unknown> | null | undefined;
  return {
    measure: nullableStr(args.measure),
    passMark: nullableStr(args.passMark),
    reviewDate: nullableStr(args.reviewDate),
    reviewDay: typeof args.reviewDay === "number" ? args.reviewDay : undefined,
    latestResult:
      result === null
        ? null
        : result && typeof result === "object"
          ? {
              text: str(result.text),
              date: optStr(result.date),
              verdict: optStr(result.verdict) as any, // validated by Convex
            }
          : undefined,
  };
}

async function callTool(accessToken: string, toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case "list_canvases":
      return await fetchQuery(api.mcp.listCanvases, { accessToken });
    case "get_canvas":
      return await fetchQuery(api.mcp.getCanvas, {
        accessToken,
        canvasId: str(args.canvasId),
        ownerUserId: optStr(args.ownerUserId),
        market: optStr(args.market),
      });
    case "list_canvas_members":
      return await fetchQuery(api.mcp.listMembers, { accessToken, canvasId: str(args.canvasId) });
    case "create_canvas": {
      const result = await fetchMutation(api.mcp.createCanvas, {
        accessToken,
        title: str(args.title),
        description: str(args.description) || undefined,
        seedNotes: typeof args.seedNotes === "boolean" ? args.seedNotes : undefined,
        template: (str(args.template) || undefined) as any, // validated by Convex
        launchDate: optStr(args.launchDate),
      });
      const label = getCanvasTemplate(str(args.template)).label;
      return {
        success: true,
        ...result,
        message: `Created new ${label}. View and collaborate in realtime at ${result.url}`,
      };
    }
    case "update_canvas":
      return await fetchMutation(api.mcp.updateCanvas, {
        accessToken,
        canvasId: str(args.canvasId),
        title: optStr(args.title),
        description: optStr(args.description),
        launchDate: nullableStr(args.launchDate),
      });
    case "add_note":
      return await fetchMutation(api.mcp.addNote, {
        accessToken,
        canvasId: str(args.canvasId),
        block: args.block as any, // validated by Convex
        content: str(args.content),
        evidenceState: (args.evidenceState as any) || undefined,
        reason: optStr(args.reason),
        ownerUserId: nullableStr(args.ownerUserId),
        markets: marketsArg(args.markets),
        ...testFieldArgs(args),
      });
    case "update_note":
      return await fetchMutation(api.mcp.updateNote, {
        accessToken,
        noteId: str(args.noteId),
        content: optStr(args.content),
        block: optStr(args.block) as any, // validated by Convex
        evidenceState: optStr(args.evidenceState) as any, // validated by Convex
        reason: optStr(args.reason),
        link: optStr(args.link),
        ownerUserId: nullableStr(args.ownerUserId),
        markets: marketsArg(args.markets),
        ...testFieldArgs(args),
      });
    case "delete_note":
      return await fetchMutation(api.mcp.deleteNote, {
        accessToken,
        noteId: str(args.noteId),
        reason: optStr(args.reason),
      });
    case "get_note_history":
      return await fetchQuery(api.mcp.getNoteHistory, { accessToken, noteId: str(args.noteId) });
    case "request_decision":
      return await fetchMutation(api.mcp.requestDecision, {
        accessToken,
        noteId: str(args.noteId),
        question: str(args.question),
        deciderUserId: str(args.deciderUserId),
        dueDate: optStr(args.dueDate),
        dueDay: typeof args.dueDay === "number" ? args.dueDay : undefined,
      });
    case "answer_decision":
      return await fetchMutation(api.mcp.answerDecision, {
        accessToken,
        noteId: str(args.noteId),
        answer: args.answer as any, // validated by Convex
        comment: optStr(args.comment),
      });
    case "withdraw_decision":
      return await fetchMutation(api.mcp.withdrawDecision, {
        accessToken,
        noteId: str(args.noteId),
        reason: optStr(args.reason),
      });
    case "list_decisions":
      return await fetchQuery(api.mcp.listDecisions, { accessToken, canvasId: optStr(args.canvasId) });
    case "create_snapshot":
      return await fetchMutation(api.mcp.createSnapshot, {
        accessToken,
        canvasId: str(args.canvasId),
        label: str(args.label),
      });
    case "list_snapshots":
      return await fetchQuery(api.mcp.listCanvasSnapshots, { accessToken, canvasId: str(args.canvasId) });
    case "compare_snapshots":
      return await fetchQuery(api.mcp.compareCanvasSnapshots, {
        accessToken,
        canvasId: str(args.canvasId),
        from: str(args.from),
        to: optStr(args.to),
      });
    case "update_evidence_state":
      return await fetchMutation(api.mcp.updateEvidenceState, {
        accessToken,
        noteId: str(args.noteId),
        evidenceState: args.evidenceState as any, // validated by Convex
        reason: optStr(args.reason),
      });
    case "run_stress_test":
      return await fetchAction(api.mcp.runStressTest, { accessToken, canvasId: str(args.canvasId) });
    case "export_canvas":
      return await fetchQuery(api.mcp.exportCanvas, {
        accessToken,
        canvasId: str(args.canvasId),
        view: (str(args.view) || "canvas") as any, // validated by Convex
        format: (str(args.format) || "pdf") as any, // validated by Convex
      });
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
