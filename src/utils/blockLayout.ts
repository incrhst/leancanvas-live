import type { BlockDef } from "../types/canvas";

/** Where a block sits on the canvas grid: 10 columns by 3 rows on wide screens. */
export interface GridCell {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
}

/**
 * Reads a block's `lg:` grid classes (e.g. "lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2")
 * so other views can lay blocks out exactly as the canvas does.
 */
export function gridCell(block: BlockDef): GridCell {
  const num = (key: string, fallback: number) => {
    const m = block.area.match(new RegExp(`lg:${key}-(\\d+)`));
    return m ? Number(m[1]) : fallback;
  };
  return { col: num("col-start", 1), colSpan: num("col-span", 1), row: num("row-start", 1), rowSpan: num("row-span", 1) };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The canvas grid's row heights, relative: two equal rows, then a shorter bottom row (matches CanvasBoard). */
const ROW_WEIGHTS = [1, 1, 0.8];

/** Lays the blocks out on a plane `width` x `height`, with `gap` between cells. */
export function blockRects(blocks: BlockDef[], width: number, height: number, gap: number): Record<string, Rect> {
  const colW = (width - 9 * gap) / 10;
  const total = ROW_WEIGHTS.reduce((a, b) => a + b, 0);
  const rowH = ROW_WEIGHTS.map((w) => ((height - 2 * gap) * w) / total);
  const rowTop = rowH.map((_, i) => rowH.slice(0, i).reduce((a, b) => a + b + gap, 0));
  const rects: Record<string, Rect> = {};
  for (const block of blocks) {
    const c = gridCell(block);
    const rows = rowH.slice(c.row - 1, c.row - 1 + c.rowSpan);
    rects[block.id] = {
      x: (c.col - 1) * (colW + gap),
      y: rowTop[c.row - 1],
      w: c.colSpan * colW + (c.colSpan - 1) * gap,
      h: rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * gap,
    };
  }
  return rects;
}
