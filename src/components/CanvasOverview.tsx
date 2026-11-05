import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRightIcon, ChevronDownIcon, ChevronUpIcon, MinusIcon, PlusIcon, RotateCcwIcon, RotateCwIcon, XIcon } from "lucide-react";
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
// Camera angle: tilt back, then turn. The view starts here and can be dragged anywhere in the tilt range.
const START_TILT = 56;
const START_TURN = -40;
const MIN_TILT = 0; // looking straight down
const MAX_TILT = 82; // just above the board's edge; never underneath it
const STAGE_H = 620;
const DIVE_ZOOM = 1.55;
// Dragging: how far the pointer moves before a press stops being a click, and how fast the view follows it.
const DRAG_SLOP = 4;
const DEG_PER_PX = 0.35;
const TURN_STEP = 15;
const TILT_STEP = 10;
// Zooming: the range, how fast Cmd + scroll and pinching change it, and how far each button goes.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const SCROLL_ZOOM_RATE = 0.002;
const PINCH_ZOOM_RATE = 0.01;
const LINE_PX = 16; // a mouse wheel can report lines rather than pixels
const MAX_CTRL_DELTA = 20; // Ctrl + mouse wheel jumps 100 at a time; a pinch moves a few pixels
const ZOOM_STEP = 1.25;
const ZOOM_SETTLE_MS = 150;
// Walls stop short of the corners, so they sit inside the tile's rounded top.
const WALL_INSET = 3;
// The board rests a little above the stage's centre.
const BOARD_LIFT = 40;

const SETTLED: EvidenceState[] = ["supported", "decision"];
const spring = { type: "spring", stiffness: 170, damping: 22 } as const;

type View = { turn: number; tilt: number };
/** The viewer's own zoom on top of the fit to the stage, and how far it has moved the board, in stage pixels. */
type Lens = { zoom: number; x: number; y: number };

const START_LENS: Lens = { zoom: 1, x: 0, y: 0 };

/**
 * Zoom by `factor`, keeping the point at (cx, cy) from the board's resting centre where it is on screen.
 * The board can only move as far as zooming has made it overflow, so zooming back out always recentres it.
 */
function zoomLens(lens: Lens, factor: number, cx: number, cy: number, stageW: number): Lens {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, lens.zoom * factor));
  const applied = zoom / lens.zoom;
  const overflow = Math.max(0, zoom - 1) / 2;
  const limit = (value: number, size: number) => Math.min(size * overflow, Math.max(-size * overflow, value));
  return {
    zoom,
    x: limit(cx - (cx - lens.x) * applied, stageW),
    y: limit(cy - (cy - lens.y) * applied, STAGE_H),
  };
}

const radians = (deg: number) => (deg * Math.PI) / 180;
const clampTilt = (tilt: number) => Math.min(MAX_TILT, Math.max(MIN_TILT, tilt));

/** Where a point on the plane (relative to its centre, lifted by z) lands on screen, before the stage scale. */
function project(dx: number, dy: number, z: number, { turn, tilt }: View) {
  const cos = Math.cos(radians(turn));
  const sin = Math.sin(radians(turn));
  const x = cos * dx - sin * dy;
  const y = (sin * dx + cos * dy) * Math.cos(radians(tilt)) - z * Math.sin(radians(tilt));
  return { x, y };
}

/** The four sides of a raised tile, so it stays a solid block from any angle. */
function TileWalls({ w, h, z, colour }: { w: number; h: number; z: number; colour: string }) {
  const along = [
    { top: 0, brightness: 1 },
    { top: h, brightness: 0.82 },
  ];
  const across = [
    { left: 0, brightness: 0.92 },
    { left: w, brightness: 0.92 },
  ];
  return (
    <>
      {along.map(({ top, brightness }) => (
        <div key={top} className="absolute" style={{ left: WALL_INSET, top, width: w - WALL_INSET * 2, transformOrigin: "0 0", transform: "rotateX(90deg)" }}>
          <motion.div className={colour} style={{ filter: `brightness(${brightness})` }} initial={{ height: 0 }} animate={{ height: z }} transition={spring} />
        </div>
      ))}
      {across.map(({ left, brightness }) => (
        <div key={left} className="absolute" style={{ left, top: WALL_INSET, height: h - WALL_INSET * 2, transformOrigin: "0 0", transform: "rotateY(-90deg)" }}>
          <motion.div className={`h-full ${colour}`} style={{ filter: `brightness(${brightness})` }} initial={{ width: 0 }} animate={{ width: z }} transition={spring} />
        </div>
      ))}
    </>
  );
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
 * Clicking a block flies the camera to it and lists its notes. Dragging anywhere on the stage rotates the board; Cmd or Ctrl + scroll, or a pinch, zooms it.
 */
export function CanvasOverview({ blocks, notes, evidenceFilter, onOpenNote }: CanvasOverviewProps) {
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(1000);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ turn: START_TURN, tilt: START_TILT });
  const [dragging, setDragging] = useState(false);
  const [lens, setLens] = useState<Lens>(START_LENS);
  const [wheeling, setWheeling] = useState(false);
  const dragStart = useRef<(View & { x: number; y: number }) | null>(null);
  // A press that became a drag must not also count as a click on whatever is under it.
  const didDrag = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    didDrag.current = false;
    if (reduce || e.button !== 0 || (e.target as HTMLElement).closest("[data-no-orbit]")) return;
    dragStart.current = { x: e.clientX, y: e.clientY, ...view };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || !e.buttons) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!didDrag.current) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return;
      didDrag.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // The near edge of the board follows the pointer.
    setView({ turn: start.turn - dx * DEG_PER_PX, tilt: clampTilt(start.tilt - dy * DEG_PER_PX) });
  };

  const endDrag = () => {
    dragStart.current = null;
    setDragging(false);
  };

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStageW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // React's onWheel can't stop the browser zooming the page, so this listens directly.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || reduce) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      // A plain scroll moves the page, and the notes panel scrolls as usual. Trackpad pinches arrive with ctrlKey set.
      if (!(e.metaKey || e.ctrlKey) || (e.target as HTMLElement).closest("[data-no-orbit]")) return;
      e.preventDefault();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const pixels = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * LINE_PX : e.deltaY;
      const factor = e.ctrlKey
        ? Math.exp(-Math.max(-MAX_CTRL_DELTA, Math.min(MAX_CTRL_DELTA, pixels)) * PINCH_ZOOM_RATE)
        : Math.exp(-pixels * SCROLL_ZOOM_RATE);
      const box = el.getBoundingClientRect();
      const cx = e.clientX - box.left - box.width / 2;
      const cy = e.clientY - box.top - box.height / 2 + BOARD_LIFT;
      setLens((current) => (focusId ? zoomLens(current, factor, current.x, current.y, box.width) : zoomLens(current, factor, cx, cy, box.width)));
      // Follow the fingers exactly; the glide is for the buttons.
      setWheeling(true);
      clearTimeout(settle);
      settle = setTimeout(() => setWheeling(false), ZOOM_SETTLE_MS);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(settle);
    };
  }, [reduce, focusId]);

  useEffect(() => {
    if (!focusId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocusId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusId]);

  const rects = useMemo(() => blockRects(blocks, PLANE_W, PLANE_H, GAP), [blocks]);
  const active = evidenceFilter?.active ?? [];
  const filtering = active.length > 0;

  // Fit the tilted plane to the stage, at whatever angle it is turned to.
  const cos = Math.abs(Math.cos(radians(view.turn)));
  const sin = Math.abs(Math.sin(radians(view.turn)));
  const projW = cos * PLANE_W + sin * PLANE_H;
  const projH = (sin * PLANE_W + cos * PLANE_H) * Math.cos(radians(view.tilt)) + 120;
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
    const p = project(focus.rect.x + focus.rect.w / 2 - PLANE_W / 2, focus.rect.y + focus.rect.h / 2 - PLANE_H / 2, focus.z, view);
    // Frame the block so it fits beside the panel, which depends on its angle and how far the viewer has zoomed.
    // The margin allows for perspective, which draws the board's near edge larger than this flat width.
    const shown = scale * lens.zoom;
    const tileW = (cos * focus.rect.w + sin * focus.rect.h) * shown;
    const zoom = Math.min(DIVE_ZOOM, (stageW * 0.42) / tileW);
    camera = { x: -(p.x * shown + lens.x) * zoom - stageW * 0.2, y: -(p.y * shown + lens.y) * zoom, scale: zoom };
  } else if (focus) {
    camera = { x: -stageW * 0.2, y: 0, scale: 1 };
  }

  const planeTransform = reduce ? `scale(${scale})` : `translate(${lens.x}px, ${lens.y}px) scale(${scale * lens.zoom}) rotateX(${view.tilt}deg) rotateZ(${view.turn}deg)`;
  const moved = view.tilt !== START_TILT || (view.turn - START_TURN) % 360 !== 0 || lens.zoom !== 1;
  // Back to the starting angle the short way, rather than unwinding every turn the drag added.
  const resetView = () => {
    setView({ turn: START_TURN + 360 * Math.round((view.turn - START_TURN) / 360), tilt: START_TILT });
    setLens(START_LENS);
  };
  const zoomBy = (factor: number) => setLens((current) => zoomLens(current, factor, 0, 0, stageW));
  const orbitButton = "rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div
      ref={stageRef}
      className={`relative select-none overflow-hidden rounded-xl border border-line bg-surface-2 ${reduce ? "" : `touch-pan-y ${dragging ? "cursor-grabbing" : "cursor-grab"}`}`}
      style={{
        height: STAGE_H,
        backgroundImage: "radial-gradient(rgba(43,44,49,.14) 1px, transparent 1.4px)",
        backgroundSize: "24px 24px",
        perspective: reduce ? undefined : 2200,
        perspectiveOrigin: "50% 40%",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => {
        endDrag();
        didDrag.current = false;
      }}
      onClickCapture={(e) => {
        if (!didDrag.current) return;
        didDrag.current = false;
        e.stopPropagation();
      }}
      onClick={() => setFocusId(null)}
    >
      <p className="pointer-events-none absolute left-3 top-3 z-10 max-w-sm text-[11px] leading-snug text-muted">
        Taller blocks are more settled: more of their notes are supported or decided.
        {filtering ? " Lifted blocks hold the evidence states you picked." : " Pick evidence states above to lift the blocks that hold them."}
        {!reduce && " Drag to rotate, ⌘ or Ctrl + scroll to zoom."}
      </p>

      {!reduce && (
        <div
          data-no-orbit
          role="group"
          aria-label="Rotate and zoom the board"
          className="absolute bottom-3 left-3 z-10 flex cursor-default items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" aria-label="Turn left" title="Turn left" className={orbitButton} onClick={() => setView({ ...view, turn: view.turn - TURN_STEP })}>
            <RotateCcwIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Turn right" title="Turn right" className={orbitButton} onClick={() => setView({ ...view, turn: view.turn + TURN_STEP })}>
            <RotateCwIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="View from higher"
            title="View from higher"
            className={orbitButton}
            onClick={() => setView({ ...view, tilt: clampTilt(view.tilt - TILT_STEP) })}
          >
            <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="View from lower"
            title="View from lower"
            className={orbitButton}
            onClick={() => setView({ ...view, tilt: clampTilt(view.tilt + TILT_STEP) })}
          >
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Zoom out" title="Zoom out" className={orbitButton} onClick={() => zoomBy(1 / ZOOM_STEP)}>
            <MinusIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Zoom in" title="Zoom in" className={orbitButton} onClick={() => zoomBy(ZOOM_STEP)}>
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          {moved && (
            <button type="button" className={`${orbitButton} text-xs font-medium`} onClick={resetView}>
              Reset
            </button>
          )}
        </div>
      )}

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
            marginTop: -PLANE_H / 2 - (reduce ? 0 : BOARD_LIFT),
            transform: planeTransform,
            transformStyle: "preserve-3d",
            // Follows the pointer and fingers exactly; the buttons and Reset glide.
            transition: reduce || dragging || wheeling ? "none" : "transform 450ms cubic-bezier(.2,.8,.2,1)",
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
                {!reduce && <div className="pointer-events-none absolute inset-0 rounded-lg bg-black/10" style={{ transform: "translate(8px, 8px)" }} />}
                {!reduce && <TileWalls w={rect.w} h={rect.h} z={zz} colour={side} />}
                <motion.button
                  type="button"
                  aria-label={`${block.title}: ${total} note${total === 1 ? "" : "s"}${filtering ? `, ${matchCount} matching` : ""}. Open its notes.`}
                  aria-pressed={focusId === block.id}
                  className={`pointer-events-auto absolute inset-0 flex flex-col items-start gap-2 overflow-hidden rounded-lg border-2 p-3 text-left transition-[opacity,background-color] ${top} ${
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
            data-no-orbit
            aria-label={`${focus.block.title} notes`}
            className="absolute bottom-3 right-3 top-3 z-20 flex w-[min(380px,42%)] cursor-default select-text flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
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
