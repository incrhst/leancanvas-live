import React from "react";
import { AnimatePresence } from "framer-motion";
import { StickyNote } from "./StickyNote";
import { AddNoteInput } from "./AddNoteInput";
import { noteMatchesEvidence } from "../utils/evidenceFilter";
import type { EvidenceFilter } from "../utils/evidenceFilter";
import type { BlockDef, NoteItem } from "../types/canvas";

interface CanvasBlockProps {
  block: BlockDef;
  notes: NoteItem[];
  selectedId: string | null;
  riskRanks?: Record<string, number>;
  canEdit?: boolean;
  evidenceFilter?: EvidenceFilter;
  onSelect: (id: string) => void;
  onAdd?: (text: string) => void;
  onDelete?: (noteId: string) => void;
}

export function CanvasBlock({
  block,
  notes,
  selectedId,
  riskRanks,
  canEdit = true,
  evidenceFilter,
  onSelect,
  onAdd,
  onDelete,
}: CanvasBlockProps) {
  const filtering = !!evidenceFilter && evidenceFilter.active.length > 0;
  const matching = notes.filter((n) => noteMatchesEvidence(n, evidenceFilter));
  const listed = filtering && evidenceFilter.mode === "hide" ? matching : notes;
  const holdsSelected = !!selectedId && notes.some((n) => n._id === selectedId);
  const listClass =
    block.layout === "wide"
      ? "grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-3"
      : "flex flex-col gap-2";

  return (
    <section
      aria-labelledby={`block-${block.id}`}
      className={`relative flex min-h-[220px] flex-col border lg:min-h-0 ${
        holdsSelected ? "z-[1] border-accent/60 ring-1 ring-accent/60" : "border-line"
      } ${
        block.emphasis ? "bg-surface-2" : "bg-surface"
      } ${block.area}`}
    >
      <header className="flex items-start justify-between gap-2 px-3 pb-2 pt-3 border-b border-line/60">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <h2
              id={`block-${block.id}`}
              className={`truncate whitespace-nowrap font-semibold text-ink ${
                block.emphasis ? "text-sm text-accent" : "text-[13px]"
              }`}
            >
              {block.title}
            </h2>
            <span className="text-[11px] font-medium text-muted bg-stone-100 px-1.5 py-0.5 rounded-full">
              {filtering ? `${matching.length} of ${notes.length}` : notes.length}
            </span>
          </div>
          <p className="truncate text-[11px] text-muted">{block.prompt}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <div className={listClass}>
          <AnimatePresence initial={false}>
            {listed.map((note) => (
              <StickyNote
                key={note._id}
                note={note}
                selected={selectedId === note._id}
                riskRank={riskRanks?.[note._id]}
                canEdit={canEdit}
                dimmed={filtering && !noteMatchesEvidence(note, evidenceFilter)}
                onSelect={() => onSelect(note._id)}
                onDelete={() => onDelete && onDelete(note._id)}
              />
            ))}
          </AnimatePresence>
        </div>
        {filtering && matching.length === 0 && evidenceFilter.mode === "hide" && notes.length > 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted">No notes in the selected states</p>
        )}
      </div>

      {canEdit && onAdd && (
        <div className="p-2 border-t border-line/40 bg-surface/50">
          <AddNoteInput blockTitle={block.title} onAdd={onAdd} />
        </div>
      )}
    </section>
  );
}