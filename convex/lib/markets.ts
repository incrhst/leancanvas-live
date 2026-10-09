import { ConvexError } from "convex/values";
import { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Market tags (e.g. "Jamaica", "Market 2") say where a note holds, so a result seen in one market
 * doesn't read as true everywhere. A note with no tags applies to every market.
 */
const MAX_TAGS = 5;
const MAX_LENGTH = 30;

/**
 * Cleans a note's tags: trims, drops blanks and duplicates, and reuses the spelling already on the
 * canvas ("jamaica" becomes "Jamaica"). Returns undefined for no tags, which clears the field.
 */
export async function normalizeMarkets(
  ctx: QueryCtx,
  canvasId: Id<"canvases">,
  tags: string[] | null | undefined
): Promise<string[] | undefined> {
  if (!tags) return undefined;
  const existing = new Map<string, string>();
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvasId))
    .collect();
  for (const note of notes) {
    for (const tag of note.markets ?? []) existing.set(tag.toLowerCase(), tag);
  }

  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    if (tag.length > MAX_LENGTH) throw new ConvexError(`Market tags must be ${MAX_LENGTH} characters or fewer: "${tag}"`);
    const canonical = existing.get(tag.toLowerCase()) ?? tag;
    if (!result.some((t) => t.toLowerCase() === canonical.toLowerCase())) result.push(canonical);
  }
  if (result.length > MAX_TAGS) throw new ConvexError(`A note can have at most ${MAX_TAGS} market tags`);
  return result.length > 0 ? result : undefined;
}

/** For history and comparisons: "Jamaica, Market 2". */
export function marketsLabel(markets: string[] | undefined) {
  return markets && markets.length > 0 ? markets.join(", ") : undefined;
}
