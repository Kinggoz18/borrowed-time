/** Exact 2:1 dimetric projection (ART_BIBLE.md §7). World units = high-tier atlas pixels. */
export const TILE_W = 128;
export const TILE_H = 64;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

export interface Point {
  x: number;
  y: number;
}

/** World position of lot-grid corner (i, j). Lot (i, j) spans corners (i, j) to (i + 1, j + 1). */
export function project(i: number, j: number): Point {
  return { x: (i - j) * HALF_W, y: (i + j) * HALF_H };
}

/** Inverse of project. */
export function unproject(x: number, y: number): { i: number; j: number } {
  return { i: (y / HALF_H + x / HALF_W) / 2, j: (y / HALF_H - x / HALF_W) / 2 };
}

/** Anchor of an n x n footprint at (i, j): its bottom diamond point. */
export function footprintAnchor(i: number, j: number, n: number): Point {
  return project(i + n, j + n);
}

/** Depth key: front-most lot's i + j, then height. Larger draws later. */
export function depthKey(i: number, j: number, n: number, height = 0): number {
  return (i + n - 1 + (j + n - 1)) * 1000 + height;
}
