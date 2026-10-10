/**
 * Tap hit-testing: nearest footprint under a world point, topmost sprite wins.
 * Pure (unit-tested); the view calls this from screen coordinates.
 */
import * as E from "../../core/engine";
import { kij } from "../../core/rules";
import type { IslandState } from "../../core/state";
import { cellAt, cellFront, depth, lotAt, lotFront, ringCells, TH, TW, type IslandLayout } from "./layout";

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

/** How tall each landmark stands above its cell, in world units: a tap on the body counts, not only on the ground under it. */
export const LANDMARK_HEIGHT: Record<string, number> = { clock: 110, wreck: 40, bargain: 40, dial: 0, lighthouse: 120, bell: 100 };

/** World coordinates → lot key, settlement glob key (`pal` / `road`), `tent`, `land:<id>`, or null. */
export function pickAt(wx: number, wy: number, st: IslandState, layout: IslandLayout): PickResult {
  const cands: Cand[] = [];
  const { owner } = E.claims(st);

  for (const p of layout.things) {
    if (!p.key) continue;
    const [i, j] = kij(p.key);
    const f = lotFront(i, j);
    // a lot's footprint is its own cell
    const dx = Math.abs(wx - f.x) / (TW / 2), dy = Math.abs(wy - (f.y - TH / 2)) / (TH / 2);
    if (dx + dy > 1.05) continue;
    const lotKey = owner[p.key] ?? p.key;
    cands.push({ id: lotKey, z: p.z, dist: Math.hypot(wx - f.x, wy - (f.y - TH / 2)) });
  }

  if (st.pal) {
    const c = cellAt(wx, wy);
    const onRing = ringCells(layout.r).some((rc) => rc.i === c.i && rc.j === c.j);
    if (onRing && inCellDiamond(wx, wy, c.i, c.j)) cands.push({ id: "pal", z: depth(c.i, c.j, 5), dist: distToCell(wx, wy, c.i, c.j) });
  }

  const lot = lotAt(wx, wy);
  if (lot) {
    const lotKey = `${lot.i},${lot.j}`;
    const f = lotFront(lot.i, lot.j);
    const dx = Math.abs(wx - f.x) / (TW / 2), dy = Math.abs(wy - (f.y - TH / 2)) / (TH / 2);
    if (lotKey in st.lots && dx + dy <= 1.05) {
      const id = owner[lotKey] ?? lotKey;
      if (!cands.some((x) => x.id === id)) cands.push({ id, z: depth(lot.i, lot.j, 0), dist: Math.hypot(wx - f.x, wy - (f.y - TH / 2)) });
    }
  }

  // landmarks: the body of the monument, or (for the flat ones) the ground it covers
  for (const lm of layout.landmarks) {
    const h = LANDMARK_HEIGHT[lm.id] ?? 60;
    const onBody = Math.abs(wx - lm.x) <= 24 && wy <= lm.y && wy >= lm.y - h;
    const onGround = h === 0 ? Math.abs(wx - lm.x) <= 64 && Math.abs(wy - (lm.y - TH / 2)) <= 32 : inCellDiamond(wx, wy, lm.i, lm.j);
    if (onBody || onGround) cands.push({ id: `land:${lm.id}`, z: depth(lm.i, lm.j, 12), dist: Math.hypot(wx - lm.x, wy - lm.y) });
  }

  if (inTentFootprint(wx, wy, layout.tent)) {
    const tc = cellAt(layout.tent.x, layout.tent.y - TH / 2);
    cands.push({ id: "tent", z: depth(tc.i, tc.j, 9), dist: Math.hypot(wx - layout.tent.x, wy - layout.tent.y) });
  }

  if (!cands.length) return null;
  cands.sort((a, b) => b.z - a.z || a.dist - b.dist);
  return cands[0].id;
}
