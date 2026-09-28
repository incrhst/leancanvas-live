import React from "react";
import { CanvasBlock } from "./CanvasBlock";
import type { BlockDef, BlockId, NoteItem } from "../types/canvas";

export const CANVAS_BLOCKS: BlockDef[] = [
  {
    id: "problem",
    title: "1. Problem",
    prompt: "Top 3 problems · existing alternatives",
    area: "lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
  },
  {
    id: "solution",
    title: "4. Solution",
    prompt: "Top 3 features & capabilities",
    area: "lg:col-start-3 lg:col-span-2 lg:row-start-1",
    layout: "stack",
  },
  {
    id: "keyMetrics",
    title: "8. Key Metrics",
    prompt: "Key activities and indicators measured",
    area: "lg:col-start-3 lg:col-span-2 lg:row-start-2",
    layout: "stack",
  },
  {
    id: "uniqueValueProposition",
    title: "3. Unique Value Proposition",
    prompt: "Single, clear, compelling message",
    area: "lg:col-start-5 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
    emphasis: true,
  },
  {
    id: "unfairAdvantage",
    title: "9. Unfair Advantage",
    prompt: "Cannot easily be copied or bought",
    area: "lg:col-start-7 lg:col-span-2 lg:row-start-1",
    layout: "stack",
  },
  {
    id: "channels",
    title: "5. Channels",
    prompt: "Path to customers & distribution",
    area: "lg:col-start-7 lg:col-span-2 lg:row-start-2",
    layout: "stack",
  },
  {
    id: "customerSegments",
    title: "2. Customer Segments",
    prompt: "Target customers · early adopters",
    area: "lg:col-start-9 lg:col-span-2 lg:row-start-1 lg:row-span-2",
    layout: "stack",
  },
  {
    id: "costStructure",
    title: "7. Cost Structure",
    prompt: "Customer acquisition, hosting, infrastructure, people",
    area: "lg:col-start-1 lg:col-span-5 lg:row-start-3",
    layout: "wide",
  },
  {
    id: "revenueStreams",
    title: "6. Revenue Streams",
    prompt: "Revenue model, lifetime value, gross margin",
    area: "lg:col-start-6 lg:col-span-5 lg:row-start-3",
    layout: "wide",
  },
];

interface LeanCanvasBoardProps {
  notes: NoteItem[];
  selectedId: string | null;
  canEdit?: boolean;
  onSelect: (id: string) => void;
  onAdd?: (blockId: BlockId, text: string) => void;
  onCycleEvidence?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
}

export function LeanCanvasBoard({
  notes,
  selectedId,
  canEdit = true,
  onSelect,
  onAdd,
  onCycleEvidence,
  onDelete,
}: LeanCanvasBoardProps) {
  return (
    <div className="relative w-full h-full min-h-[720px]">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 lg:h-full lg:grid-cols-10 lg:grid-rows-[minmax(240px,1fr)_minmax(240px,1fr)_minmax(180px,0.8fr)]">
        {CANVAS_BLOCKS.map((block) => (
          <CanvasBlock
            key={block.id}
            block={block}
            notes={notes.filter((n) => n.block === block.id)}
            selectedId={selectedId}
            canEdit={canEdit}
            onSelect={onSelect}
            onAdd={onAdd ? (text) => onAdd(block.id, text) : undefined}
            onCycleEvidence={onCycleEvidence}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}