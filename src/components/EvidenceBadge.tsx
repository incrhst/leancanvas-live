import React from "react";
import { EvidenceState } from "../types/canvas";

interface EvidenceBadgeProps {
  state: EvidenceState;
  onClick?: (e: React.MouseEvent) => void;
  interactive?: boolean;
}

export const EVIDENCE_CONFIG: Record<
  EvidenceState,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  unknown: {
    label: "Unknown",
    bg: "bg-stone-100",
    text: "text-stone-600",
    border: "border-stone-300",
    desc: "Unexamined premise",
  },
  assumption: {
    label: "Assumption",
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    desc: "Unproven hypothesis",
  },
  observed: {
    label: "Observed",
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    desc: "Direct customer observation",
  },
  supported: {
    label: "Supported",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    desc: "Strong evidence / validation",
  },
  contradicted: {
    label: "Contradicted",
    bg: "bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-300",
    desc: "Disproven by feedback",
  },
  decision: {
    label: "Decision",
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
    desc: "Locked team commitment",
  },
};

export function EvidenceBadge({ state, onClick, interactive = false }: EvidenceBadgeProps) {
  const config = EVIDENCE_CONFIG[state] || EVIDENCE_CONFIG.unknown;

  return (
    <span
      role={interactive ? "button" : undefined}
      onClick={onClick}
      title={`${config.label}: ${config.desc}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors ${
        config.bg
      } ${config.text} ${config.border} ${
        interactive ? "cursor-pointer hover:opacity-85 select-none" : ""
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {config.label}
    </span>
  );
}
