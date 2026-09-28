import React from "react";
import { StressTestResult } from "../types/canvas";
import { SparklesIcon, ShieldAlertIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";

interface StressTestPanelProps {
  result: StressTestResult | null;
  isRunning: boolean;
  canRun: boolean;
  onRunTest: () => void;
  onClose?: () => void;
}

const SCORE_LABELS: Record<string, { label: string; desc: string }> = {
  clarity: { label: "Clarity", desc: "Sharpness of problem & UVP" },
  desirability: { label: "Desirability", desc: "Customer urgency & demand" },
  viability: { label: "Viability", desc: "Unit economics & margin" },
  feasibility: { label: "Feasibility", desc: "Ease of technical delivery" },
  defensibility: { label: "Defensibility", desc: "True unfair advantage" },
  timing: { label: "Timing", desc: "Market catalysts & why now" },
  mission: { label: "Mission", desc: "Strategic coherence" },
};

export function StressTestPanel({
  result,
  isRunning,
  canRun,
  onRunTest,
  onClose,
}: StressTestPanelProps) {
  return (
    <div className="flex h-full flex-col bg-surface overflow-y-auto p-4 space-y-5 text-ink">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-sm">Stress Test & Risk Engine</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-sm p-1 rounded hover:bg-stone-100"
          >
            ✕
          </button>
        )}
      </div>

      {canRun && (
        <button
          type="button"
          disabled={isRunning}
          onClick={onRunTest}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-accent text-white font-medium rounded-lg shadow-sm hover:bg-accent/90 disabled:opacity-50 transition-colors text-sm"
        >
          {isRunning ? (
            <>
              <Loader2Icon className="w-4 h-4 animate-spin" />
              Running Ash Maurya Stress Test...
            </>
          ) : (
            <>
              <SparklesIcon className="w-4 h-4" />
              Run 7-Dimension Stress Test
            </>
          )}
        </button>
      )}

      {!result && !isRunning && (
        <div className="rounded-lg border border-dashed border-line p-6 text-center text-muted text-xs">
          No stress test has been run for this canvas yet. Click the button above to evaluate clarity, defensibility, and riskiest assumptions.
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Overall score card */}
          <div className="rounded-xl bg-surface-2 border border-line p-4 text-center">
            <div className="text-xs uppercase font-semibold tracking-wider text-muted mb-1">
              Overall Resilience Score
            </div>
            <div className="text-3xl font-bold text-ink">
              {result.overallScore} <span className="text-sm font-normal text-muted">/ 10</span>
            </div>
            <div className="w-full bg-stone-200 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  result.overallScore >= 7
                    ? "bg-emerald-500"
                    : result.overallScore >= 5
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${result.overallScore * 10}%` }}
              />
            </div>
          </div>

          {/* 7 Dimensions list */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              7 Stress Dimensions
            </h3>
            <div className="space-y-2">
              {Object.entries(result.scores).map(([key, val]) => {
                const meta = SCORE_LABELS[key] || { label: key, desc: "" };
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-ink">{meta.label}</span>
                      <span className="text-muted">{val} / 10</span>
                    </div>
                    <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-accent h-full rounded-full"
                        style={{ width: `${val * 10}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Riskiest Assumptions */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900">
              <ShieldAlertIcon className="w-4 h-4 text-amber-600" />
              Riskiest Assumptions ({result.riskiestAssumptions.length})
            </div>

            <div className="space-y-2.5">
              {result.riskiestAssumptions.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-950 uppercase tracking-tight text-[11px]">
                      {item.block}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-medium">
                      Risk #{idx + 1}
                    </span>
                  </div>
                  <p className="text-ink font-medium leading-snug">{item.assumption}</p>
                  <p className="text-muted leading-relaxed text-[11px]">
                    <strong className="text-ink">Why lethal:</strong> {item.reason}
                  </p>
                  <div className="mt-2 rounded bg-white/80 p-2 border border-amber-200/50">
                    <div className="flex items-start gap-1.5 text-emerald-800">
                      <CheckCircle2Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
                      <span className="text-[11px] leading-snug">
                        <strong>Experiment:</strong> {item.suggestedExperiment}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
