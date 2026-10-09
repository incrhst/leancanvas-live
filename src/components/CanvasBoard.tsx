import React from "react";
import { CanvasBlock } from "./CanvasBlock";
import { MobileCanvasBoard } from "./MobileCanvasBoard";
import type { EvidenceFilter } from "../utils/evidenceFilter";
import type { BlockDef, BlockId, NoteItem } from "../types/canvas";

interface CanvasBoardProps {
  /** The template's blocks, from getCanvasTemplate(...).blocks */
  blocks: BlockDef[];
  notes: NoteItem[];
  selectedId: string | null;
  /** noteId -> 1-based rank from the latest stress test's riskiest assumptions */
  riskRanks?: Record<string, number>;
  canEdit?: boolean;
  evidenceFilter?: EvidenceFilter;
  onSelect: (id: string) => void;
  onAdd?: (blockId: BlockId, text: string) => void;
  onDelete?: (noteId: string) => void;
}

export function CanvasBoard({
  blocks,
  notes,
  selectedId,
  riskRanks,
  canEdit = true,
  evidenceFilter,
  onSelect,
  onAdd,
  onDelete,
}: CanvasBoardProps) {
  return (
    <>
    {/* Phones get one block at a time with a minimap dock; md and up get the full grid. */}
    <div className="md:hidden">
      <MobileCanvasBoard
        blocks={blocks}
        notes={notes}
        selectedId={selectedId}
        riskRanks={riskRanks}
        canEdit={canEdit}
        evidenceFilter={evidenceFilter}
        onSelect={onSelect}
        onAdd={onAdd}
        onDelete={onDelete}
      />
    </div>
    <div className="relative hidden w-full h-full min-h-[720px] md:block">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 lg:h-full lg:grid-cols-10 lg:grid-rows-[minmax(240px,1fr)_minmax(240px,1fr)_minmax(180px,0.8fr)]">
        {blocks.map((block) => (
          <CanvasBlock
            key={block.id}
            block={block}
            notes={notes.filter((n) => n.block === block.id)}
            selectedId={selectedId}
            riskRanks={riskRanks}
            canEdit={canEdit}
            evidenceFilter={evidenceFilter}
            onSelect={onSelect}
            onAdd={onAdd ? (text) => onAdd(block.id, text) : undefined}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
    </>
  );
}
