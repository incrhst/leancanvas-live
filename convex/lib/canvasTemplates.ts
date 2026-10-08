import { ConvexError, v } from "convex/values";

/**
 * Canvas templates. Each canvas has one template, which decides its blocks and how it is
 * stress-tested. Canvases created before templates existed have no `template` and are "lean".
 */
export const canvasTemplateValidator = v.union(v.literal("lean"), v.literal("gtm"));

export type CanvasTemplate = "lean" | "gtm";

export const DEFAULT_CANVAS_TEMPLATE: CanvasTemplate = "lean";

export const LEAN_BLOCK_IDS = [
  "problem",
  "customerSegments",
  "uniqueValueProposition",
  "solution",
  "channels",
  "revenueStreams",
  "costStructure",
  "keyMetrics",
  "unfairAdvantage",
] as const;

// `channels` and `keyMetrics` mean the same thing in both templates, so they are shared.
export const GTM_BLOCK_IDS = [
  "idealCustomer",
  "painsAndAlternatives",
  "positioning",
  "messaging",
  "channels",
  "salesMotion",
  "pricing",
  "launchPlan",
  "keyMetrics",
] as const;

export type BlockId = (typeof LEAN_BLOCK_IDS)[number] | (typeof GTM_BLOCK_IDS)[number];

/** Every block id across all templates. Notes store one of these in `block`. */
export const blockValidator = v.union(
  v.literal("problem"),
  v.literal("customerSegments"),
  v.literal("uniqueValueProposition"),
  v.literal("solution"),
  v.literal("channels"),
  v.literal("revenueStreams"),
  v.literal("costStructure"),
  v.literal("keyMetrics"),
  v.literal("unfairAdvantage"),
  v.literal("idealCustomer"),
  v.literal("painsAndAlternatives"),
  v.literal("positioning"),
  v.literal("messaging"),
  v.literal("salesMotion"),
  v.literal("pricing"),
  v.literal("launchPlan")
);

export const BLOCKS_BY_TEMPLATE: Record<CanvasTemplate, readonly BlockId[]> = {
  lean: LEAN_BLOCK_IDS,
  gtm: GTM_BLOCK_IDS,
};

export const DEFAULT_TITLE_BY_TEMPLATE: Record<CanvasTemplate, string> = {
  lean: "Untitled Lean Canvas",
  gtm: "Untitled GTM Canvas",
};

export function templateOf(canvas: { template?: CanvasTemplate }): CanvasTemplate {
  return canvas.template ?? DEFAULT_CANVAS_TEMPLATE;
}

/** Throws if a block id does not belong to the canvas's template. */
export function assertBlockForTemplate(template: CanvasTemplate, block: string): void {
  if (!(BLOCKS_BY_TEMPLATE[template] as readonly string[]).includes(block)) {
    throw new ConvexError(`"${block}" is not a block on a ${template === "gtm" ? "GTM" : "Lean"} Canvas`);
  }
}
