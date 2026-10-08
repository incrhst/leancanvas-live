import { action, internalMutation, internalQuery, query, ActionCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getCurrentUser, getCanvasRole } from "./lib/auth";
import { BLOCKS_BY_TEMPLATE, BlockId, CanvasTemplate, templateOf } from "./lib/canvasTemplates";
import { GTM_STRESS_TEST_SYSTEM_PROMPT, STRESS_TEST_SYSTEM_PROMPT } from "./constants/prompts";

async function canReadCanvas(ctx: QueryCtx, canvasId: Id<"canvases">) {
  const canvas = await ctx.db.get(canvasId);
  if (!canvas) return false;
  // Public viewers get the latest result through canvases.getCanvasByPublicToken instead
  const user = await getCurrentUser(ctx);
  return !!user && !!(await getCanvasRole(ctx, canvasId, user._id));
}

export const getLatestStressTest = query({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    if (!(await canReadCanvas(ctx, args.canvasId))) return null;
    return await ctx.db
      .query("stressTests")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .order("desc")
      .first();
  },
});

export const listStressTests = query({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args) => {
    if (!(await canReadCanvas(ctx, args.canvasId))) return [];
    return await ctx.db
      .query("stressTests")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .order("desc")
      .take(10);
  },
});

/**
 * Loads the canvas notes for a stress test, verifying the user is an Editor or Owner.
 */
export const getCanvasForStressTest = internalQuery({
  args: {
    canvasId: v.id("canvases"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    const role = await getCanvasRole(ctx, args.canvasId, args.userId);
    if (role !== "owner" && role !== "editor") {
      throw new Error("Forbidden: You must be an Editor or Owner to run a stress test");
    }
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_canvas_block", (q) => q.eq("canvasId", args.canvasId))
      .collect();
    return { canvas, notes: notes.sort((a, b) => a.order - b.order) };
  },
});

export const saveStressTestResult = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    scores: v.object({
      clarity: v.number(),
      desirability: v.number(),
      viability: v.number(),
      feasibility: v.number(),
      defensibility: v.number(),
      timing: v.number(),
      mission: v.number(),
    }),
    overallScore: v.number(),
    riskiestAssumptions: v.array(
      v.object({
        noteId: v.optional(v.id("notes")),
        block: v.string(),
        assumption: v.string(),
        reason: v.string(),
        suggestedExperiment: v.string(),
      })
    ),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("stressTests", {
      canvasId: args.canvasId,
      scores: args.scores,
      overallScore: args.overallScore,
      riskiestAssumptions: args.riskiestAssumptions,
      createdBy: args.userId,
      createdAt: Date.now(),
    });

    await ctx.db.insert("activity", {
      canvasId: args.canvasId,
      userId: args.userId,
      type: "stress_test_run",
      message: `ran AI stress test (overall score: ${args.overallScore}/10)`,
      createdAt: Date.now(),
    });

    return id;
  },
});

const STRESS_TEST_PROMPTS: Record<CanvasTemplate, string> = {
  lean: STRESS_TEST_SYSTEM_PROMPT,
  gtm: GTM_STRESS_TEST_SYSTEM_PROMPT,
};

/**
 * Offline heuristic used when no OpenAI key is configured or the call fails. It scores the
 * seven dimensions from which blocks have notes, so each template names its own blocks.
 */
const HEURISTIC_SIGNALS: Record<
  CanvasTemplate,
  {
    clarity: BlockId[]; // +2 each block with notes, on a base of 5
    viability: BlockId; // +2 with notes, -1 without, on a base of 5
    feasibility: BlockId; // +2 with notes, on a base of 6
    defensibility: BlockId; // +4 with notes, on a base of 3
    fallbackBlock: BlockId; // where the canvas-wide risk goes when every note is already evidenced
    fallbackRisk: { assumption: string; reason: string; suggestedExperiment: string };
  }
> = {
  lean: {
    clarity: ["problem", "uniqueValueProposition"],
    viability: "revenueStreams",
    feasibility: "solution",
    defensibility: "unfairAdvantage",
    fallbackBlock: "customerSegments",
    fallbackRisk: {
      assumption: "Customers are actively feeling this pain enough to change their existing workflow.",
      reason: "Status quo bias is the most common reason early-stage products stall.",
      suggestedExperiment:
        "Run 10 cold outreach discovery calls asking about what they did the last time this issue occurred.",
    },
  },
  gtm: {
    clarity: ["idealCustomer", "messaging"],
    viability: "pricing",
    feasibility: "launchPlan",
    defensibility: "positioning",
    fallbackBlock: "idealCustomer",
    fallbackRisk: {
      assumption: "Target buyers are already looking for a fix and will change how they buy when they hear this message.",
      reason: "If buyers are not actively looking, every channel pays to create demand the plan never priced in.",
      suggestedExperiment:
        "Run 10 discovery calls with ICP accounts about how they bought the last tool in this category, then test the message on a landing page with a small paid-traffic budget.",
    },
  },
};

/**
 * Shared stress test implementation (web app and MCP server).
 * Calls OpenAI if an API key is configured; otherwise uses a heuristic fallback score.
 */
export async function runStressTestForUser(
  ctx: ActionCtx,
  canvasId: Id<"canvases">,
  userId: Id<"users">
): Promise<any> {
  const canvasData = await ctx.runQuery(internal.stressTests.getCanvasForStressTest, {
    canvasId,
    userId,
  });

  const template = templateOf(canvasData.canvas);
  const notes = canvasData.notes;
  const hasNotes = (block: BlockId) => notes.some((n) => n.block === block);

  const canvasPayload = {
    title: canvasData.canvas.title,
    description: canvasData.canvas.description,
    blocks: Object.fromEntries(
      BLOCKS_BY_TEMPLATE[template].map((block) => [
        block,
        notes
          .filter((n) => n.block === block)
          .map((n) => ({ id: n._id, text: n.content, evidence: n.evidenceState })),
      ])
    ),
  };

  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  let resultJson = null;

  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: STRESS_TEST_PROMPTS[template] },
            { role: "user", content: JSON.stringify(canvasPayload) },
          ],
          temperature: 0.3,
        }),
      });
      const data = await response.json();
      resultJson = JSON.parse(data.choices[0].message.content);
    } catch (err) {
      console.error("OpenAI call failed, falling back to heuristic engine", err);
    }
  }

  // Fallback heuristic scoring if no API key or LLM error
  if (!resultJson) {
    const signals = HEURISTIC_SIGNALS[template];
    const totalNotes = notes.length;
    const evidenceCounts = notes.reduce(
      (acc, n) => {
        acc[n.evidenceState] = (acc[n.evidenceState] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const supportedRatio = (evidenceCounts.supported || 0) / Math.max(1, totalNotes);
    const assumptionRatio = (evidenceCounts.assumption || 0) / Math.max(1, totalNotes);

    const clarity = Math.min(10, Math.max(4, Math.round(5 + signals.clarity.filter(hasNotes).length * 2)));
    const desirability = Math.min(10, Math.max(3, Math.round(4 + supportedRatio * 5)));
    const viability = Math.min(10, Math.max(3, Math.round(5 + (hasNotes(signals.viability) ? 2 : -1))));
    const feasibility = Math.min(10, Math.max(4, Math.round(6 + (hasNotes(signals.feasibility) ? 2 : 0))));
    const defensibility = Math.min(10, Math.max(2, Math.round(3 + (hasNotes(signals.defensibility) ? 4 : 0))));
    const timing = 7.0;
    const mission = 7.5;

    const scores = { clarity, desirability, viability, feasibility, defensibility, timing, mission };
    const sum = Object.values(scores).reduce((a, b) => a + b, 0);
    const overallScore = Math.round((sum / 7) * 10) / 10;

    // Identify riskiest assumptions
    const riskiestAssumptions = [];
    const assumptionNotes = notes.filter((n) => n.evidenceState === "assumption" || n.evidenceState === "unknown");

    if (assumptionNotes.length > 0) {
      for (const note of assumptionNotes.slice(0, 4)) {
        riskiestAssumptions.push({
          noteId: note._id,
          block: note.block,
          assumption: note.content,
          reason: `Currently tagged as unverified ${note.evidenceState}; if customers do not experience this, the value proposition collapses.`,
          suggestedExperiment: `Interview 5 target customers matching this segment or run a concierge smoke test specifically probing this premise.`,
        });
      }
    } else {
      riskiestAssumptions.push({
        noteId: undefined,
        block: signals.fallbackBlock,
        ...signals.fallbackRisk,
      });
    }

    resultJson = { scores, overallScore, riskiestAssumptions };
  }

  const savedId = await ctx.runMutation(internal.stressTests.saveStressTestResult, {
    canvasId,
    scores: resultJson.scores,
    overallScore: resultJson.overallScore,
    riskiestAssumptions: resultJson.riskiestAssumptions,
    userId,
  });

  return { ...resultJson, _id: savedId, createdAt: Date.now() };
}

export const runStressTest = action({
  args: {
    canvasId: v.id("canvases"),
  },
  handler: async (ctx, args): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be signed in to run stress tests");
    }
    return await runStressTestForUser(ctx, args.canvasId, userId);
  },
});
