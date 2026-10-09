/**
 * Tap hit-testing: nearest footprint under a world point, topmost sprite wins.
 * Pure (unit-tested); the view calls this from screen coordinates.
 */
import * as E from "../../core/engine";
import { kij } from "../../core/rules";
import type { IslandState } from "../../core/state";
import { cellAt, cellFront, depth, ringCells, TH, TW, type IslandLayout } from "./layout";

export type PickResult = string | "tent" | null;

function inCellDiamond(wx: number, wy: number, i: number, j: number): boolean {
  const f = cellFront(i, j);
  const dx = Math.abs(wx - f.x) / (TW / 2);
  const dy = Math.abs(wy - (f.y - TH / 2)) / (TH / 2);
  return dx + dy <= 1.05;
}

function distToCell(wx: number, wy: number, i: number, j: number): number {
  const f = cellFront(i, j);
  return Math.hypot(wx - f.x, wy - (f.y - TH / 2));
}

/** Hesper's tent only: a single tile footprint at the flap, not the wide shore hit box. */
function inTentFootprint(wx: number, wy: number, t: { x: number; y: number }): boolean {
  const tc = cellAt(t.x, t.y - TH / 2);
  return cellAt(wx, wy).i === tc.i && cellAt(wx, wy).j === tc.j && inCellDiamond(wx, wy, tc.i, tc.j);
}

interface Cand {
  id: PickResult;
  z: number;
  dist: number;
}

/** World coordinates → lot key, settlement glob key (`pal` / `road`), `tent`, or null. */
export function pickAt(wx: number, wy: number, st: IslandState, layout: IslandLayout): PickResult {
  const cands: Cand[] = [];
  const { owner } = E.claims(st);

  for (const p of layout.things) {
    if (!p.key) continue;
    const [i, j] = kij(p.key);
    if (!inCellDiamond(wx, wy, i, j)) continue;
    const lotKey = owner[p.key] ?? p.key;
    cands.push({ id: lotKey, z: p.z, dist: distToCell(wx, wy, i, j) });
  }

  if (st.pal) {
    const c = cellAt(wx, wy);
    const onRing = ringCells(layout.r).some((rc) => rc.i === c.i && rc.j === c.j);
    if (onRing && inCellDiamond(wx, wy, c.i, c.j)) cands.push({ id: "pal", z: depth(c.i, c.j, 5), dist: distToCell(wx, wy, c.i, c.j) });
  }

  const cell = cellAt(wx, wy);
  const lotKey = `${cell.i},${cell.j}`;
  if (lotKey in st.lots && inCellDiamond(wx, wy, cell.i, cell.j)) {
    const id = owner[lotKey] ?? lotKey;
    if (!cands.some((x) => x.id === id)) cands.push({ id, z: depth(cell.i, cell.j, 0), dist: distToCell(wx, wy, cell.i, cell.j) });
  }

  if (inTentFootprint(wx, wy, layout.tent)) cands.push({ id: "tent", z: depth(layout.r + 2, -layout.r + 1, 9), dist: Math.hypot(wx - layout.tent.x, wy - layout.tent.y) });

  if (!cands.length) return null;
  cands.sort((a, b) => b.z - a.z || a.dist - b.dist);
  return cands[0].id;
}
