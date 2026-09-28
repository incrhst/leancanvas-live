import React from "react";
import { LayoutGridIcon, ShieldAlertIcon } from "lucide-react";

export type CanvasView = "canvas" | "risks";

interface CanvasViewToggleProps {
  view: CanvasView;
  riskCount: number;
  onChange: (view: CanvasView) => void;
}

export function CanvasViewToggle({ view, riskCount, onChange }: CanvasViewToggleProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors";
  return (
    <div role="tablist" aria-label="Canvas view" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      <button
        type="button"
        role="tab"
        aria-selected={view === "canvas"}
        onClick={() => onChange("canvas")}
        className={`${base} ${view === "canvas" ? "bg-ink text-surface" : "text-muted hover:text-ink"}`}
      >
        <LayoutGridIcon className="h-3.5 w-3.5" />
        Canvas
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "risks"}
        onClick={() => onChange("risks")}
        className={`${base} ${view === "risks" ? "bg-rose-600 text-white" : "text-muted hover:text-rose-700"}`}
      >
        <ShieldAlertIcon className="h-3.5 w-3.5" />
        Riskiest assumptions
        {riskCount > 0 && (
          <span
            className={`rounded-full px-1.5 text-[10px] font-semibold ${
              view === "risks" ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700"
            }`}
          >
            {riskCount}
          </span>
        )}
      </button>
    </div>
  );
}

/**
 * noteId -> 1-based rank for notes flagged in a stress test's riskiest assumptions.
 */
export function riskRanksFor(
  riskiestAssumptions: { noteId?: string | null }[] | undefined
): Record<string, number> {
  const ranks: Record<string, number> = {};
  riskiestAssumptions?.forEach((r, i) => {
    if (r.noteId && !(r.noteId in ranks)) ranks[r.noteId] = i + 1;
  });
  return ranks;
}
