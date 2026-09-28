import React from "react";
import { motion } from "framer-motion";
import { EvidenceBadge } from "./EvidenceBadge";
import { NoteItem, EvidenceState } from "../types/canvas";

interface StickyNoteProps {
  note: NoteItem;
  selected?: boolean;
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
      className={`group relative rounded-lg border bg-amber-50/70 border-amber-200/80 p-2.5 transition-all duration-150 hover:shadow-sm ${
        selected ? "ring-2 ring-accent ring-offset-1 ring-offset-surface bg-amber-50" : ""
      }`}
    >
      <div
        onClick={onSelect}
        role={onSelect ? "button" : undefined}
        className="cursor-pointer"
      >
        <p className="text-[13px] leading-snug text-ink font-normal pr-4">
          {note.content}
        </p>
      </div>

      <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-amber-200/40">
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