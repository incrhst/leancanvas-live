import React from "react";
import { AnimatePresence } from "framer-motion";
import { StickyNote } from "./StickyNote";
import { AddNoteInput } from "./AddNoteInput";
import type { BlockDef, NoteItem } from "../types/canvas";

interface CanvasBlockProps {
  block: BlockDef;
  notes: NoteItem[];
  selectedId: string | null;
  riskRanks?: Record<string, number>;
  canEdit?: boolean;
  onSelect: (id: string) => void;
  onAdd?: (text: string) => void;
  onCycleEvidence?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
}

export function CanvasBlock({
  block,
  notes,
  selectedId,
  riskRanks,
  canEdit = true,
  onSelect,
  onAdd,
  onCycleEvidence,
  onDelete,
}: CanvasBlockProps) {
  const listClass =
    block.layout === "wide"
      ? "grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-3"
      : "flex flex-col gap-2";

  return (
    <section
      aria-labelledby={`block-${block.id}`}
      className={`flex min-h-[220px] flex-col border border-line lg:min-h-0 ${
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
              {notes.length}
            </span>
          </div>
          <p className="truncate text-[11px] text-muted">{block.prompt}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <div className={listClass}>
          <AnimatePresence initial={false}>
            {notes.map((note) => (
              <StickyNote
                key={note._id}
                note={note}
                selected={selectedId === note._id}
                riskRank={riskRanks?.[note._id]}
                canEdit={canEdit}
                onSelect={() => onSelect(note._id)}
                onCycleEvidence={() => onCycleEvidence && onCycleEvidence(note._id)}
                onDelete={() => onDelete && onDelete(note._id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {canEdit && onAdd && (
        <div className="p-2 border-t border-line/40 bg-surface/50">
          <AddNoteInput blockTitle={block.title} onAdd={onAdd} />
        </div>
      )}
    </section>
  );
}