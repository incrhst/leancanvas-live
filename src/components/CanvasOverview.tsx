import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRightIcon, XIcon } from "lucide-react";
import { EVIDENCE_CONFIG, EvidenceBadge } from "./EvidenceBadge";
import { blockRects, type Rect } from "../utils/blockLayout";
import { noteMatchesEvidence, type EvidenceFilter } from "../utils/evidenceFilter";
import type { BlockDef, EvidenceState, NoteItem } from "../types/canvas";

interface CanvasOverviewProps {
  /** The template's blocks, from getCanvasTemplate(...).blocks */
  blocks: BlockDef[];
  /** Notes already narrowed by owner and market, as on the canvas */
  notes: NoteItem[];
  /** The evidence chips above the board: picking states lifts the blocks that hold them */
  evidenceFilter?: EvidenceFilter;
  /** Open a note on the canvas */
  onOpenNote: (noteId: string) => void;
}

// The plane the blocks sit on, in its own units; it is scaled to fit the stage.
const PLANE_W = 1000;
const PLANE_H = 600;
const GAP = 14;
// Camera angle: tilt back, then turn. Both views (and the maths below) use these.
const TILT = 56;
const TURN = -40;
const COS = Math.cos((TURN * Math.PI) / 180);
const SIN = Math.sin((TURN * Math.PI) / 180);
const TILT_COS = Math.cos((TILT * Math.PI) / 180);
const TILT_SIN = Math.sin((TILT * Math.PI) / 180);
const STAGE_H = 620;
const DIVE_ZOOM = 1.55;

const SETTLED: EvidenceState[] = ["supported", "decision"];
const spring = { type: "spring", stiffness: 170, damping: 22 } as const;

/** Where a point on the plane (relative to its centre, lifted by z) lands on screen, before the stage scale. */
function project(dx: number, dy: number, z: number) {
  const x = COS * dx - SIN * dy;
  const y = (SIN * dx + COS * dy) * TILT_COS - z * TILT_SIN;
  return { x, y };
}

function stateCounts(notes: NoteItem[]) {
  const counts: Partial<Record<EvidenceState, number>> = {};
  for (const n of notes) {
    const s = n.evidenceState || "assumption";
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

/**
 * The canvas as a 2.5D map: each block is a raised tile, taller when more of its notes are supported or decided.
 * Picking evidence states in the legend lifts the blocks that hold them, in that state's colour.
 * Clicking a block flies the camera to it and lists its notes.
 */
export function CanvasOverview({ blocks, notes, evidenceFilter, onOpenNote }: CanvasOverviewProps) {
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(1000);
  const [focusId, setFocusId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStageW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!focusId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocusId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusId]);

  const rects = useMemo(() => blockRects(blocks, PLANE_W, PLANE_H, GAP), [blocks]);
  const active = evidenceFilter?.active ?? [];
  const filtering = active.length > 0;

  // Fit the tilted plane to the stage.
  const projW = Math.abs(COS) * PLANE_W + Math.abs(SIN) * PLANE_H;
  const projH = (Math.abs(SIN) * PLANE_W + Math.abs(COS) * PLANE_H) * TILT_COS + 120;
  const scale = reduce ? Math.min((stageW * 0.92) / PLANE_W, (STAGE_H * 0.85) / PLANE_H) : Math.min((stageW * 0.92) / projW, (STAGE_H * 0.92) / projH);

  const tiles = blocks.map((block) => {
    const blockNotes = notes.filter((n) => n.block === block.id);
    const counts = stateCounts(blockNotes);
    const total = blockNotes.length;
    const settled = total ? SETTLED.reduce((n, s) => n + (counts[s] ?? 0), 0) / total : 0;
    const matchCount = active.reduce((n, s) => n + (counts[s] ?? 0), 0);
    const strongest = active.reduce<EvidenceState | null>((best, s) => ((counts[s] ?? 0) > (best ? counts[best] ?? 0 : 0) ? s : best), null);
    let z = 12 + 70 * settled;
    if (filtering) z = matchCount ? 30 + 22 * Math.min(matchCount, 5) : 4;
    // The open block rises a little. Hover never moves a block, so it stays under the pointer to be clicked.
    if (focusId === block.id) z += 10;
    return { block, blockNotes, total, matchCount, strongest, z, rect: rects[block.id] as Rect };
  });

  // Camera: fly to the focused block, keeping it left of the notes panel.
  const focus = tiles.find((t) => t.block.id === focusId);
  let camera = { x: 0, y: 0, scale: 1 };
  if (focus && !reduce) {
    const p = project(focus.rect.x + focus.rect.w / 2 - PLANE_W / 2, focus.rect.y + focus.rect.h / 2 - PLANE_H / 2, focus.z);
    camera = { x: -p.x * scale * DIVE_ZOOM - stageW * 0.2, y: -p.y * scale * DIVE_ZOOM, scale: DIVE_ZOOM };
  } else if (focus) {
    camera = { x: -stageW * 0.2, y: 0, scale: 1 };
  }

  const planeTransform = reduce ? `scale(${scale})` : `scale(${scale}) rotateX(${TILT}deg) rotateZ(${TURN}deg)`;

  return (
    <div
      ref={stageRef}
      className="relative overflow-hidden rounded-xl border border-line bg-surface-2"
      style={{
        height: STAGE_H,
        backgroundImage: "radial-gradient(rgba(43,44,49,.14) 1px, transparent 1.4px)",
        backgroundSize: "24px 24px",
        perspective: reduce ? undefined : 2200,
        perspectiveOrigin: "50% 40%",
      }}
      onClick={() => setFocusId(null)}
    >
      <p className="pointer-events-none absolute left-3 top-3 z-10 max-w-sm text-[11px] leading-snug text-muted">
        Taller blocks are more settled: more of their notes are supported or decided.
        {filtering ? " Lifted blocks hold the evidence states you picked." : " Pick evidence states above to lift the blocks that hold them."}
      </p>

      {/* Camera and plane let clicks through; only the block tiles take them. */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={camera}
        transition={reduce ? { duration: 0 } : spring}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: PLANE_W,
            height: PLANE_H,
            marginLeft: -PLANE_W / 2,
            marginTop: -PLANE_H / 2 - (reduce ? 0 : 40),
            transform: planeTransform,
            transformStyle: "preserve-3d",
          }}
        >
          <div className="pointer-events-none absolute -inset-4 rounded-[28px] border border-line bg-surface shadow-[16px_16px_0_rgba(43,44,49,.08)]" />
          {tiles.map(({ block, blockNotes, total, matchCount, strongest, z, rect }) => {
            const lit = filtering && matchCount > 0;
            const faded = filtering && matchCount === 0;
            const top = lit && strongest ? EVIDENCE_CONFIG[strongest].card : "bg-surface border-line";
            const side = lit && strongest ? EVIDENCE_CONFIG[strongest].bar : "bg-stone-300";
            const zz = reduce ? 0 : z;
            return (
              <div key={block.id} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, transformStyle: "preserve-3d" }}>
                {!reduce && <div className="pointer-events-none absolute inset-0 rounded-xl bg-black/10" style={{ transform: "translate(8px, 8px)" }} />}
                {!reduce && (
                  <motion.div className={`pointer-events-none absolute inset-0 rounded-xl ${side} opacity-70`} animate={{ z: Math.max(0, zz - 8) }} transition={spring} />
                )}
                <motion.button
                  type="button"
                  aria-label={`${block.title}: ${total} note${total === 1 ? "" : "s"}${filtering ? `, ${matchCount} matching` : ""}. Open its notes.`}
                  aria-pressed={focusId === block.id}
                  className={`pointer-events-auto absolute inset-0 flex flex-col items-start gap-2 overflow-hidden rounded-xl border-2 p-3 text-left transition-[opacity,background-color] ${top} ${
                    faded ? "opacity-50" : ""
                  } ${focusId === block.id ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-accent/40"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                  animate={{ z: zz }}
                  transition={reduce ? { duration: 0 } : spring}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusId(focusId === block.id ? null : block.id);
                  }}
                >
                  <span className={`font-semibold leading-tight text-ink ${rect.w > 300 ? "text-lg" : "text-[15px]"}`}>{block.title}</span>
                  <span className="text-[11px] text-muted">
                    {total} note{total === 1 ? "" : "s"}
                    {filtering && matchCount > 0 ? ` · ${matchCount} matching` : ""}
                  </span>
                  <span className="mt-auto flex flex-wrap gap-1" aria-hidden="true">
                    {blockNotes.map((n) => {
                      const s = n.evidenceState || "assumption";
                      const hit = !filtering || active.includes(s);
                      return (
                        <span
                          key={n._id}
                          className={`h-2.5 w-2.5 rounded-sm ${EVIDENCE_CONFIG[s].bar} ${s === "unknown" ? "ring-1 ring-stone-400" : ""} ${
                            hit ? (filtering ? "scale-125" : "") : "opacity-25"
                          } transition-transform`}
                        />
                      );
                    })}
                  </span>
                </motion.button>
              </div>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence>
        {focus && (
          <motion.aside
            key={focus.block.id}
            aria-label={`${focus.block.title} notes`}
            className="absolute bottom-3 right-3 top-3 z-20 flex w-[min(380px,42%)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink">{focus.block.title}</h2>
                <p className="mt-0.5 text-xs text-muted">{focus.block.prompt}</p>
              </div>
              <button
                type="button"
                aria-label="Back to the whole canvas"
                className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
                onClick={() => setFocusId(null)}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </header>
            <ul className="flex-1 space-y-2 overflow-y-auto p-3">
              {focus.blockNotes.length === 0 && <li className="text-sm text-muted">No notes in this block yet.</li>}
              {focus.blockNotes.map((n) => {
                const s = n.evidenceState || "assumption";
                const dim = filtering && !noteMatchesEvidence(n, evidenceFilter);
                return (
                  <li key={n._id} className={`rounded-lg border p-3 ${EVIDENCE_CONFIG[s].card} ${dim ? "opacity-45" : ""}`}>
                    <EvidenceBadge state={s} />
                    <p className="mt-2 line-clamp-4 text-sm leading-snug text-ink">{n.content}</p>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                      onClick={() => onOpenNote(n._id)}
                    >
                      Open on canvas
                      <ArrowUpRightIcon className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
