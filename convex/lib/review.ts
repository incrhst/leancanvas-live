import { ConvexError } from "convex/values";
import { QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { listCanvasMembers } from "./members";
import { compareSnapshots, listSnapshots } from "./snapshots";
import { todayUtc } from "./testFields";

/**
 * Everything a review meeting needs and nothing else: notes with tests and how their latest result
 * compares with the pass mark, open decisions, and what changed since a snapshot (the latest by
 * default). Shared by the review page and the MCP get_review tool.
 */
export type TestOutcome = "missed" | "met" | "unclear" | "no_result";

const OUTCOME_ORDER: TestOutcome[] = ["missed", "no_result", "unclear", "met"];

function outcomeOf(note: Doc<"notes">): TestOutcome {
  const verdict = note.latestResult?.verdict;
  if (!note.latestResult) return "no_result";
  if (verdict === "fail") return "missed";
  if (verdict === "pass") return "met";
  return "unclear";
}

export async function buildReview(
  ctx: QueryCtx,
  canvas: Doc<"canvases">,
  sinceSnapshotId?: Id<"canvasSnapshots">
) {
  const today = todayUtc();
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_canvas_block", (q) => q.eq("canvasId", canvas._id))
    .collect();
  const members = await listCanvasMembers(ctx, canvas);
  const nameOf = (id: Id<"users"> | undefined) =>
    id ? (members.find((m) => m.userId === id)?.name ?? "Former member") : undefined;

  const tests = notes
    .filter((n) => n.measure || n.passMark || n.reviewDate || n.latestResult)
    .map((n) => ({
      noteId: n._id,
      block: n.block,
      text: n.content,
      evidenceState: n.evidenceState,
      markets: n.markets,
      owner: nameOf(n.ownerId),
      measure: n.measure,
      passMark: n.passMark,
      reviewDate: n.reviewDate,
      latestResult: n.latestResult,
      outcome: outcomeOf(n),
      reviewOverdue:
        !!n.reviewDate && n.reviewDate < today && (!n.latestResult || n.latestResult.date < n.reviewDate),
    }))
    .sort(
      (a, b) =>
        OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(b.outcome) ||
        (a.reviewDate ?? "9999").localeCompare(b.reviewDate ?? "9999")
    );

  const openDecisions = notes
    .filter((n) => n.decision?.status === "open")
    .map((n) => ({
      noteId: n._id,
      block: n.block,
      text: n.content,
      question: n.decision!.question,
      deciderId: n.decision!.deciderId,
      decider: nameOf(n.decision!.deciderId)!,
      requestedBy: nameOf(n.decision!.requestedBy)!,
      dueDate: n.decision!.dueDate,
      overdue: n.decision!.dueDate < today,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const snapshots = await listSnapshots(ctx, canvas);
  const since = sinceSnapshotId
    ? snapshots.find((s) => s.snapshotId === sinceSnapshotId)
    : snapshots[0];
  if (sinceSnapshotId && !since) throw new ConvexError("Snapshot not found on this canvas");
  const changes = since ? await compareSnapshots(ctx, canvas, since.snapshotId, "current") : null;

  return {
    canvasId: canvas._id,
    title: canvas.title,
    template: canvas.template ?? "lean",
    launchDate: canvas.launchDate,
    today,
    tests,
    openDecisions,
    since: since ? { snapshotId: since.snapshotId, label: since.label, takenAt: since.takenAt } : null,
    snapshots: snapshots.map((s) => ({ snapshotId: s.snapshotId, label: s.label, takenAt: s.takenAt })),
    changes,
  };
}
