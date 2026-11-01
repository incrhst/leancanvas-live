import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { PauseCircleIcon, SparklesIcon, XIcon, ZapIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PLAN_REQUIRED } from "../../convex/lib/billing";
import { PLAN_REQUIRED_EVENT, announcePlanRequired, daysLeft } from "../utils/plan";

const chipClass =
  "inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium transition-colors";

/**
 * Where the canvas's live plan stands: in its trial (days left), running, or paused. Links to
 * the plan page. Shows nothing on a free canvas.
 */
export function PlanChip({ canvasId }: { canvasId: Id<"canvases"> }) {
  const info = useQuery(api.billing.forCanvas, { canvasId });
  const plan = info?.plan;
  if (!plan) return null;

  const href = `/canvas/${canvasId}/plan`;
  if (plan.status === "paused") {
    return (
      <Link href={href} className={`${chipClass} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100`}>
        <PauseCircleIcon size={12} aria-hidden="true" />
        Plan paused
      </Link>
    );
  }
  if (plan.status === "trial" && plan.trialEndsAt) {
    const days = daysLeft(plan.trialEndsAt);
    return (
      <Link href={href} className={`${chipClass} border-line bg-surface-2 text-ink hover:bg-surface`}>
        <SparklesIcon size={12} aria-hidden="true" />
        Trial · {days} day{days === 1 ? "" : "s"} left
      </Link>
    );
  }
  return (
    <Link href={href} className={`${chipClass} border-line bg-surface-2 text-ink hover:bg-surface`}>
      <ZapIcon size={12} aria-hidden="true" />
      Live plan
    </Link>
  );
}

/**
 * Opens when something needs a live plan: a caught error announced through convexErrorMessage,
 * or a mutation nobody caught.
 */
export function PlanRequiredDialog({ canvasId }: { canvasId: Id<"canvases"> }) {
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const onPlanRequired = (e: Event) => setReason((e as CustomEvent<string>).detail);
    const onUnhandled = (e: PromiseRejectionEvent) => {
      const err = e.reason as { data?: unknown; message?: string } | undefined;
      const message = typeof err?.data === "string" ? err.data : err?.message;
      if (message?.includes(PLAN_REQUIRED)) {
        e.preventDefault();
        announcePlanRequired(message);
      }
    };
    window.addEventListener(PLAN_REQUIRED_EVENT, onPlanRequired);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener(PLAN_REQUIRED_EVENT, onPlanRequired);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  if (!reason) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-required-title"
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ZapIcon className="h-5 w-5 text-accent" aria-hidden="true" />
            <h2 id="plan-required-title" className="text-base font-semibold text-ink">
              Keep the plan running
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setReason(null)}
            aria-label="Close"
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <XIcon size={16} />
          </button>
        </div>
        <p className="text-sm text-ink">{reason}</p>
        <p className="text-sm text-muted">
          The canvas stays yours to edit. Tests, check-ins, decision requests, snapshots and the review run while the
          plan does.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setReason(null)}
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink"
          >
            Not now
          </button>
          <Link
            href={`/canvas/${canvasId}/plan`}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            See the plan
          </Link>
        </div>
      </div>
    </div>
  );
}
