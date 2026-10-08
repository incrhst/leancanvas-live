import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { StickyNote } from "./StickyNote";
import { AddNoteInput } from "./AddNoteInput";
import type { BlockDef, BlockId, EvidenceState, NoteItem } from "../types/canvas";

interface MobileCanvasBoardProps {
  blocks: BlockDef[];
  notes: NoteItem[];
  selectedId: string | null;
  riskRanks?: Record<string, number>;
  canEdit?: boolean;
  onSelect: (id: string) => void;
  onAdd?: (blockId: BlockId, text: string) => void;
  onCycleEvidence?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
}

/** Pips shown per minimap cell before collapsing the rest into "+N". */
const MAX_PIPS = 8;
/** Horizontal travel (px) that counts as a swipe to the next or previous block. */
const SWIPE_THRESHOLD = 50;

const EVIDENCE_BAR: Record<EvidenceState, string> = {
  unknown: "bg-stone-300",
  assumption: "bg-amber-400",
  observed: "bg-blue-500",
  supported: "bg-emerald-500",
  contradicted: "bg-rose-500",
  decision: "bg-purple-500",
};

/**
 * Reads the desktop grid placement out of a block's `lg:` classes so the minimap
 * mirrors the real canvas layout for any template.
 */
function minimapPlacement(area: string): React.CSSProperties {
  const read = (key: string) => Number(area.match(new RegExp(`${key}-(\\d+)`))?.[1]) || undefined;
  const colStart = read("col-start") ?? 1;
  const rowStart = read("row-start") ?? 1;
  return {
    gridColumn: `${colStart} / span ${read("col-span") ?? 1}`,
    gridRow: `${rowStart} / span ${read("row-span") ?? 1}`,
  };
}

/**
 * Phone layout for the canvas: one block at a time, with a docked minimap of the
 * whole canvas for jumping between blocks, arrows, and swipe.
 */
export function MobileCanvasBoard({
  blocks,
  notes,
  selectedId,
  riskRanks,
  canEdit = true,
  onSelect,
  onAdd,
  onCycleEvidence,
  onDelete,
}: MobileCanvasBoardProps) {
  // Navigate in reading order (the number in each block's title), not grid order.
  const ordered = useMemo(
    () =>
      blocks
        .map((block, i) => ({
          block,
          num: parseInt(block.title, 10) || i + 1,
          name: block.title.replace(/^\d+\.\s*/, ""),
          placement: minimapPlacement(block.area),
        }))
        .sort((a, b) => a.num - b.num),
    [blocks]
  );
  const notesByBlock = useMemo(() => {
    const map = new Map<BlockId, NoteItem[]>();
    for (const note of notes) {
      const list = map.get(note.block) ?? [];
      list.push(note);
      map.set(note.block, list);
    }
    return map;
  }, [notes]);

  const [index, setIndex] = useState(0);
  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const count = ordered.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const pick = (i: number) => {
    setIndex(i);
    setPeekIndex(null);
  };

  // Follow a note selected elsewhere (e.g. opened from the risks view) to its block.
  const selectedBlock = notes.find((n) => n._id === selectedId)?.block;
  useEffect(() => {
    if (!selectedBlock) return;
    const i = ordered.findIndex((o) => o.block.id === selectedBlock);
    if (i >= 0) setIndex(i);
  }, [selectedBlock, ordered]);

  if (count === 0) return null;

  const current = ordered[Math.min(index, count - 1)];
  const currentNotes = notesByBlock.get(current.block.id) ?? [];
  const prev = ordered[(index - 1 + count) % count];
  const next = ordered[(index + 1) % count];

  const peek = peekIndex !== null && peekIndex !== index ? ordered[peekIndex] : null;
  const peekNotes = peek ? notesByBlock.get(peek.block.id) ?? [] : [];
  const peekTally = peekNotes.reduce<Partial<Record<EvidenceState, number>>>((acc, n) => {
    acc[n.evidenceState] = (acc[n.evidenceState] ?? 0) + 1;
    return acc;
  }, {});

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("textarea, input")) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? 1 : -1);
  };

  return (
    // Fill the viewport below the top bar and view toggle so the dock rests at the bottom even when a block is short.
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col">
      <div aria-hidden="true" className="flex gap-1">
        {ordered.map((o, i) => (
          <span
            key={o.block.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i === index ? "bg-accent" : i < index ? "bg-subtle/60" : "bg-line"
            }`}
          />
        ))}
      </div>

      <section
        aria-labelledby={`mobile-block-${current.block.id}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeStart.current = null)}
        className="flex-1 touch-pan-y pb-4"
      >
        <header className="px-1 pb-3 pt-4">
          <p className="font-mono text-xs font-medium uppercase tracking-wide text-muted">
            Block {current.num} of {count}
          </p>
          <h2
            id={`mobile-block-${current.block.id}`}
            className="mt-0.5 font-display text-2xl font-bold leading-tight tracking-tight text-ink"
          >
            {current.name}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{current.block.prompt}</p>
        </header>

        {/* Keyed by block so switching blocks swaps the list instead of animating old notes out. */}
        <div key={current.block.id} className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {currentNotes.map((note) => (
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
          {currentNotes.length === 0 && (
            <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
              No notes in this block yet.
            </p>
          )}
          {canEdit && onAdd && (
            <div className="rounded-lg border border-line bg-surface p-1.5">
              <AddNoteInput
                key={current.block.id}
                blockTitle={current.block.title}
                onAdd={(text) => onAdd(current.block.id, text)}
              />
            </div>
          )}
        </div>
      </section>

      <nav
        aria-label="Canvas blocks"
        className="sticky bottom-0 z-20 -mx-3 -mb-3 rounded-t-2xl border-t border-line bg-surface px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_24px_rgba(43,44,49,0.08)]"
      >
        {peek && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-x-3 bottom-full mb-2 flex flex-col gap-1 rounded-xl bg-ink px-3.5 py-3 text-white shadow-xl"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-white/70">Jump to</span>
              <span className="text-xs text-white/70">
                {peekNotes.length} {peekNotes.length === 1 ? "note" : "notes"}
              </span>
            </div>
            <span className="font-display text-base font-semibold">
              {peek.num} · {peek.name}
            </span>
            <span className="truncate text-[13px] text-white/85">
              {peekNotes[0] ? `“${peekNotes[0].content}”` : "No notes yet"}
            </span>
            {peekNotes.length > 0 && (
              <div className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-full">
                {(Object.keys(peekTally) as EvidenceState[]).map((state) => (
                  <span key={state} className={EVIDENCE_BAR[state]} style={{ flexGrow: peekTally[state] }} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
          <span className="min-w-0 flex-1 truncate">‹ {prev.name}</span>
          <span className="shrink-0 font-mono text-[11px] text-ink">swipe or tap the map</span>
          <span className="min-w-0 flex-1 truncate text-right">{next.name} ›</span>
        </div>

        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous block"
            className="grid w-11 shrink-0 place-items-center rounded-xl border border-line bg-canvas text-ink active:bg-surface-2"
          >
            <ChevronLeftIcon size={20} aria-hidden="true" />
          </button>

          <div className="grid h-[138px] min-w-0 flex-1 grid-cols-10 grid-rows-3 gap-[3px]">
            {ordered.map((o, i) => {
              const blockNotes = notesByBlock.get(o.block.id) ?? [];
              const active = i === index;
              const peeking = i === peekIndex && !active;
              const extra = blockNotes.length - MAX_PIPS;
              return (
                <button
                  key={o.block.id}
                  type="button"
                  style={o.placement}
                  onClick={() => pick(i)}
                  onPointerEnter={(e) => e.pointerType !== "touch" && setPeekIndex(i)}
                  onPointerLeave={() => setPeekIndex(null)}
                  onFocus={() => setPeekIndex(i)}
                  onBlur={() => setPeekIndex(null)}
                  aria-label={`${o.num}. ${o.name}, ${blockNotes.length} ${blockNotes.length === 1 ? "note" : "notes"}`}
                  aria-current={active ? "true" : undefined}
                  className={`relative flex min-w-0 flex-col items-start justify-between gap-0.5 rounded-lg border px-1.5 pb-1.5 pt-1 transition-[background-color,color,transform] duration-150 ${
                    active
                      ? "border-accent bg-accent text-white shadow-[0_4px_12px_rgba(234,81,72,0.35)]"
                      : peeking
                      ? "z-10 scale-[1.04] border-line bg-surface text-ink outline outline-2 outline-offset-1 outline-ink"
                      : "border-line bg-surface-2 text-ink"
                  }`}
                >
                  <span className="font-mono text-[13px] font-medium leading-none">{o.num}</span>
                  <span aria-hidden="true" className="flex max-w-full flex-wrap items-center gap-[3px]">
                    {blockNotes.slice(0, MAX_PIPS).map((note) => {
                      const red = note.evidenceState === "contradicted";
                      return (
                        <span
                          key={note._id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            active
                              ? red
                                ? "bg-white ring-[1.5px] ring-ink"
                                : "bg-white/60"
                              : red
                              ? "bg-rose-600"
                              : "bg-subtle"
                          }`}
                        />
                      );
                    })}
                    {extra > 0 && (
                      <span className={`text-[9px] font-semibold leading-none ${active ? "text-white" : "text-muted"}`}>
                        +{extra}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next block"
            className="grid w-11 shrink-0 place-items-center rounded-xl border border-line bg-canvas text-ink active:bg-surface-2"
          >
            <ChevronRightIcon size={20} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
}
