/**
 * The open land: forest, bushes and meadow props on the ground the ring has not claimed yet, and
 * small bushes on empty lots. Pure and deterministic per cell (the island never reshuffles), so
 * the same meadow is cleared as the ring grows over it.
 */
import type { Coast } from "./coast";

export interface Prop {
  i: number;
  j: number;
  frame: string;
  /** offset inside the cell in world units */
  dx: number;
  dy: number;
}

const h2 = (i: number, j: number, salt: number): number => {
  let h = Math.imul(i * 73856093 ^ j * 19349663 ^ salt * 83492791, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
/** Smooth value noise, so the woods come in patches and clearings. */
export function fnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (a: number, b: number) => h2(a, b, 77);
  return (v(xi, yi) * (1 - sx) + v(xi + 1, yi) * sx) * (1 - sy) + (v(xi, yi + 1) * (1 - sx) + v(xi + 1, yi + 1) * sx) * sy;
}
export const TREE_VARIANTS = 4;
export const BUSH_VARIANTS = 3;

/** Trees and bushes on unclaimed meadow: dense woods in patches, sparse elsewhere, a clear apron round the ring. */
export function forestProps(coast: Coast, r: number, tent: { i: number; j: number }): Prop[] {
  const out: Prop[] = [];
  for (const { i, j } of coast.cells) {
    const m = Math.max(Math.abs(i), Math.abs(j));
    if (m < r + 3) continue; // the ring and one cell of lawn outside it stay clear
    if (coast.sandy(i, j)) continue;
    if (Math.abs(i - tent.i) <= 1 && Math.abs(j - tent.j) <= 1) continue;
    if (j === 0 && i >= r + 1) continue; // the gate road
    const wood = fnoise(i / 3.2 + 3, j / 3.2 + 8);
    const roll = h2(i, j, 5);
    const pDense = wood > 0.56 ? 0.78 : wood > 0.46 ? 0.3 : 0.06;
    // thin the woods a little near the ring so the claim looks like clearing
    const clearing = m < r + 5 ? 0.6 : 1;
    const dx = Math.round((h2(i, j, 6) - 0.5) * 26), dy = Math.round((h2(i, j, 7) - 0.5) * 10);
    if (roll < pDense * clearing) out.push({ i, j, frame: `sc/tree/${Math.floor(h2(i, j, 8) * TREE_VARIANTS)}`, dx, dy });
    else if (roll < pDense * clearing + 0.07) out.push({ i, j, frame: `sc/bush/${Math.floor(h2(i, j, 9) * BUSH_VARIANTS)}`, dx, dy });
  }
  return out;
}

/** A bush or a clump of flowers on some empty lots, so open ground reads as a green pocket between the built blocks. */
export function lotGreens(i: number, j: number): Prop | null {
  const roll = h2(i, j, 21);
  if (roll > 0.34) return null;
  return { i, j, frame: `sc/bush/${Math.floor(h2(i, j, 22) * BUSH_VARIANTS)}`, dx: Math.round((h2(i, j, 23) - 0.5) * 20), dy: Math.round((h2(i, j, 24) - 0.5) * 8) };
}
