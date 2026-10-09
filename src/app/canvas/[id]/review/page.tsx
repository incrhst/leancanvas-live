"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowLeftIcon } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useAuth } from "../../../../components/ConvexClientProvider";
import { ReviewView } from "../../../../components/ReviewView";
import { getCanvasTemplate } from "../../../../utils/canvasTemplates";
import { formatCalendarDate, formatPlanDate } from "../../../../utils/testFields";

/**
 * Review mode: a read-only page for review meetings. Only tests and their results, open
 * decisions, and what changed since the last snapshot. Nothing else from the canvas.
 */
export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const canvasId = params?.id as Id<"canvases">;
  const { user, isLoading } = useAuth();
  const [since, setSince] = useState<Id<"canvasSnapshots"> | undefined>(undefined);
  const review = useQuery(api.review.get, user ? { canvasId, sinceSnapshotId: since } : "skip");

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?redirect=/canvas/${canvasId}/review`);
  }, [isLoading, user, router, canvasId]);

  if (review === undefined) {
    return <div className="flex h-screen items-center justify-center bg-canvas text-xs text-muted">Loading review…</div>;
  }
  if (review === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-sm text-muted">
        This canvas doesn't exist or you don't have access to it.
      </div>
    );
  }

  const template = getCanvasTemplate(review.template);
  const day = review.launchDate ? formatPlanDate(review.launchDate, review.today) : null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Link
          href={`/canvas/${canvasId}`}
          aria-label="Back to the canvas"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold text-ink">{review.title}</h1>
          <p className="text-xs text-muted">
            Review · {day && day.startsWith("Day") ? `${day} · ` : ""}
            {formatCalendarDate(review.today)}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <ReviewView
          review={review}
          blockTitleOf={(blockId) => template.blocks.find((b) => b.id === blockId)?.title ?? blockId}
          currentUserId={user?.id}
          onPickSnapshot={(id) => setSince(id as Id<"canvasSnapshots">)}
        />
      </main>
    </div>
  );
}
