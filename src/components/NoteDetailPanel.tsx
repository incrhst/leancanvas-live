import React from "react";
import { motion } from "framer-motion";
import { Trash2Icon, XIcon, CheckCircle2Icon } from "lucide-react";
import { NoteItem, EvidenceState } from "../types/canvas";
import { EvidenceBadge, EVIDENCE_CONFIG } from "./EvidenceBadge";
import { NoteHistory } from "./NoteHistory";
import { EditableField } from "./EditableField";
import { NoteTestFields, TestFieldsPatch } from "./NoteTestFields";

interface NoteDetailPanelProps {
  note: NoteItem;
  blockTitle: string;
  canEdit: boolean;
  onClose: () => void;
  onUpdate: (content: string) => void;
  onUpdateEvidence: (state: EvidenceState) => void;
  onUpdateTest?: (patch: TestFieldsPatch) => void;
  onDelete: () => void;
  /** Set to show the note's change history (canvas members only, not the public link) */
  blockTitleOf?: (blockId: string) => string;
}

const EVIDENCE_STATES: EvidenceState[] = [
  "unknown",
  "assumption",
  "observed",
  "supported",
  "contradicted",
  "decision",
];

export function NoteDetailPanel({
  note,
  blockTitle,
  canEdit,
  onClose,
  onUpdate,
  onUpdateEvidence,
  onUpdateTest,
  onDelete,
  blockTitleOf,
}: NoteDetailPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className="flex h-full flex-col bg-surface overflow-y-auto"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{blockTitle}</p>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete note"
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <Trash2Icon size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-stone-100 hover:text-ink transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-5 flex-1">
        {/* Note Content */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted">Claim / Item Content</label>
          <EditableField
            multiline
            rows={4}
            required
            disabled={!canEdit}
            value={note.content}
            onCommit={onUpdate}
            className="!border-amber-200/80 !bg-amber-50/50 p-3"
          />
        </div>

        {/* Evidence State Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted">Evidence State</label>
            <EvidenceBadge state={note.evidenceState} />
          </div>

          {canEdit ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {EVIDENCE_STATES.map((state) => {
                const conf = EVIDENCE_CONFIG[state];
                const active = note.evidenceState === state;
                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() => onUpdateEvidence(state)}
                    className={`flex flex-col items-start p-2 rounded-lg border text-left text-xs transition-all ${
                      active
                        ? `${conf.bg} ${conf.border} ring-1 ring-accent font-semibold`
                        : "bg-surface border-line hover:bg-surface-2"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-current opacity-75" />
                      {conf.label}
                    </span>
                    <span className="text-[10px] text-muted font-normal mt-0.5 line-clamp-1">
                      {conf.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted">
              Viewing in read-only mode. Sign in with editor permissions to change evidence status.
            </p>
          )}
        </div>

        <NoteTestFields note={note} canEdit={canEdit} onUpdate={onUpdateTest} />

        {blockTitleOf && <NoteHistory noteId={note._id} blockTitleOf={blockTitleOf} />}

        {/* Validation hint */}
        <div className="rounded-xl bg-surface-2 border border-line p-3 text-xs text-muted space-y-1">
          <div className="font-semibold text-ink flex items-center gap-1">
            <CheckCircle2Icon className="w-3.5 h-3.5 text-accent" />
            Ash Maurya Validation Framework
          </div>
          <p className="text-[11px] leading-relaxed">
            Move items systematically from <strong>Assumption</strong> to <strong>Observed</strong> or <strong>Supported</strong> through customer interviews, concierge tests, and observable sales traction.
          </p>
        </div>
      </div>
    </motion.div>
  );
}