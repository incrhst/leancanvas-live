import React from "react";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleHelpIcon,
  EyeIcon,
  FlagIcon,
  LucideIcon,
  XCircleIcon,
} from "lucide-react";
import { EvidenceState } from "../types/canvas";
import { EVIDENCE_MEANINGS, EVIDENCE_STATES } from "../utils/evidenceStates";

export { EVIDENCE_STATES };

interface EvidenceBadgeProps {
  state: EvidenceState;
  onClick?: (e: React.MouseEvent) => void;
  interactive?: boolean;
}

/**
 * How each evidence state looks, everywhere it appears (notes, badges, legend, exports, minimap).
 * Each state has its own colour and its own icon, so states never depend on colour alone.
 * Unknown is the only dashed card (not looked at yet); contradicted is the only solid red badge.
 */
export const EVIDENCE_CONFIG: Record<
  EvidenceState,
  {
    label: string;
    desc: string;
    icon: LucideIcon;
    /** Badge */
    bg: string;
    text: string;
    border: string;
    /** Note card: background and border (all four sides; never a one-side accent) */
    card: string;
    /** Solid fill for bars and pips */
    bar: string;
  }
> = {
  unknown: {
    ...EVIDENCE_MEANINGS.unknown,
    icon: CircleDashedIcon,
    bg: "bg-stone-100",
    text: "text-stone-600",
    border: "border-stone-300 border-dashed",
    card: "bg-surface border-dashed border-stone-300",
    bar: "bg-stone-300",
  },
  assumption: {
    ...EVIDENCE_MEANINGS.assumption,
    icon: CircleHelpIcon,
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    card: "bg-amber-50/70 border-amber-300",
    bar: "bg-amber-400",
  },
  observed: {
    ...EVIDENCE_MEANINGS.observed,
    icon: EyeIcon,
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    card: "bg-blue-50/60 border-blue-300",
    bar: "bg-blue-500",
  },
  supported: {
    ...EVIDENCE_MEANINGS.supported,
    icon: CheckCircle2Icon,
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    card: "bg-emerald-50/60 border-emerald-300",
    bar: "bg-emerald-500",
  },
  contradicted: {
    ...EVIDENCE_MEANINGS.contradicted,
    icon: XCircleIcon,
    bg: "bg-rose-600",
    text: "text-white",
    border: "border-rose-700",
    card: "bg-rose-50 border-rose-400",
    bar: "bg-rose-600",
  },
  decision: {
    ...EVIDENCE_MEANINGS.decision,
    icon: FlagIcon,
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
    card: "bg-purple-50/60 border-purple-300",
    bar: "bg-purple-500",
  },
};

export function EvidenceBadge({ state, onClick, interactive = false }: EvidenceBadgeProps) {
  const config = EVIDENCE_CONFIG[state] || EVIDENCE_CONFIG.unknown;
  const Icon = config.icon;

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
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}
