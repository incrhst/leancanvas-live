import React from "react";
import { motion } from "framer-motion";
import { ShieldAlertIcon } from "lucide-react";
import { EvidenceBadge } from "./EvidenceBadge";
import { NoteItem, EvidenceState } from "../types/canvas";

interface StickyNoteProps {
  note: NoteItem;
  selected?: boolean;
  /** 1-based rank if the latest stress test flagged this note as a riskiest assumption */
  riskRank?: number;
  canEdit?: boolean;
  onSelect?: () => void;
  onCycleEvidence?: () => void;
  onDelete?: () => void;
}

const EVIDENCE_ORDER: EvidenceState[] = [
  "unknown",
  "assumption",
  "observed",
  "supported",
  "contradicted",
  "decision",
];

export function StickyNote({
  note,
  selected = false,
  riskRank,
  canEdit = true,
  onSelect,
  onCycleEvidence,
  onDelete,
}: StickyNoteProps) {
  const handleCycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit || !onCycleEvidence) return;
    onCycleEvidence();
  };

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className={`group relative rounded-lg border p-2.5 transition-all duration-150 hover:shadow-sm ${
        riskRank
          ? "bg-rose-50/80 border-rose-300 border-l-4 border-l-rose-500"
          : "bg-amber-50/70 border-amber-200/80"
      } ${selected ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
    >
      {riskRank && (
        <div
          className="mb-1.5 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-800"
          title="Flagged by the latest stress test as one of the riskiest assumptions"
        >
          <ShieldAlertIcon className="h-3 w-3" aria-hidden="true" />
          Risk #{riskRank}
        </div>
      )}
      <div
        onClick={onSelect}
        role={onSelect ? "button" : undefined}
        className="cursor-pointer"
      >
        <p className="text-[13px] leading-snug text-ink font-normal pr-4">
          {note.content}
        </p>
      </div>

      <div
        className={`mt-2.5 flex items-center justify-between pt-1 border-t ${
          riskRank ? "border-rose-200/60" : "border-amber-200/40"
        }`}
      >
        <EvidenceBadge
          state={note.evidenceState || "assumption"}
          interactive={canEdit}
          onClick={handleCycle}
        />

        {canEdit && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete note"
            className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 text-xs px-1 rounded transition-opacity"
          >
            ×
          </button>
        )}
      </div>
    </motion.article>
  );
}