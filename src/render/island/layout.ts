/**
 * What the island looks like for a given state: ground tiles, the ring, buildings and props, in
 * world units (the 64×32 tile at s = 1). Pure (no Pixi), so the ring re-fit, grey land and
 * depth order are unit-tested.
 */
import * as E from "../../core/engine";
import { kij, stageOf, TIERS, type BType } from "../../core/rules";
import type { IslandState } from "../../core/state";
import { buildingFrame, groundFrame } from "../../art/island/atlas";
import { ERA_TYPES, LOOKS_PER_ERA } from "../../art/island/buildings";
import type { Era } from "../../art/island/palette";
import type { RingPiece } from "../../art/island/scenery";

/** Buildings draw a little larger than their lot so they read on a phone (owner feedback). */
export const BUILDING_SCALE = 1.3;
export const TW = 64;
export const TH = 32;
/** Bottom (front) point of cell (i, j)'s diamond. Lots are cells; the gnomon stands on (0, 0). */
export const cellFront = (i: number, j: number): { x: number; y: number } => ({ x: (i - j) * (TW / 2), y: (i + j) * (TH / 2) + TH });
/** Cell under a world point. */
export function cellAt(x: number, y: number): { i: number; j: number } {
  const a = (y - TH / 2) / TH, b = x / TW;
  return { i: Math.round(a + b), j: Math.round(a - b) };
}
/** Draw order: back to front, then left to right; tall things after ground at the same cell. */
export const depth = (i: number, j: number, lift = 0): number => (i + j) * 100 + (i - j) + lift;

export const eraOf = (tier: number): Era => (tier === 0 ? "colony" : "village");
export const radius = (tier: number): number => (TIERS[tier].grid - 1) / 2;

export interface Placed {
  frame: string;
  x: number;
  y: number;
  z: number;
  key?: string;
  scale?: number;
}
export interface IslandLayout {
  era: Era;
  r: number;
  ground: Placed[];
  ring: Placed[];
  things: Placed[];
  /** world bounds of the land, for the camera clamp */
  bounds: { x: number; y: number; w: number; h: number };
  /** what the camera fits on screen: the ring and a strip of shore */
  fitBounds: { x: number; y: number; w: number; h: number };
  /** Hesper's tent, east shore outside the ring */
  tent: { x: number; y: number };
  gate: { x: number; y: number };
}

const hash = (i: number, j: number): number => {
  let h = Math.imul(i * 73856093 ^ j * 19349663, 0x9e3779b1);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** The look a building shows in this era: one look every 3 levels, clamped to what the era draws. */
export function lookFor(era: Era, type: BType, n: number): { frameType: BType; stage: number } {
  const types = ERA_TYPES[era];
  const frameType = types.includes(type) ? type : types[types.length - 1];
  return { frameType, stage: Math.min(stageOf(n), LOOKS_PER_ERA[era] - 1) };
}

export function ringStage(st: IslandState): number {
  return st.pal ? Math.min(3, stageOf(st.pal.n)) : -1;
}

/** The ring sits one cell outside the lots and re-fits whenever the tier (grid) grows. */
export function ringCells(r: number): { i: number; j: number; piece: RingPiece | "gate" }[] {
  const R = r + 1;
  const out: { i: number; j: number; piece: RingPiece | "gate" }[] = [];
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== R) continue;
      const corner = Math.abs(i) === R && Math.abs(j) === R;
      const piece: RingPiece | "gate" = corner ? "post" : i === R && j === 0 ? "gate" : Math.abs(j) === R ? "segA" : "segB";
      out.push({ i, j, piece });
    }
  return out;
}

export function layoutIsland(st: IslandState, opts: { dusk?: boolean } = {}): IslandLayout {
  const era = eraOf(st.tier);
  const r = radius(st.tier);
  const grey = E.greySet(st);
  const { owner, size } = E.claims(st);
  const roadOn = !!st.road;
  const ground: Placed[] = [];
  const things: Placed[] = [];
  const S = r + 3;
  for (let i = -S; i <= S; i++)
    for (let j = -S; j <= S; j++) {
      const m = Math.max(Math.abs(i), Math.abs(j));
      const h = hash(i, j);
      if (m === S && h < 0.55) continue; // a ragged shore
      const key = `${i},${j}`;
      const isLot = key in st.lots;
      let kind = m >= r + 2 ? "sand" : isLot ? "lot" : "grass";
      if (isLot && roadOn && (i === 0 || j === 0) && st.lots[key] === null && !owner[key]) kind = "road";
      if (m === r + 1 && i === r + 1 && j === 0 && roadOn) kind = "road";
      const p = cellFront(i, j);
      ground.push({ frame: groundFrame(era, kind, Math.floor(h * 3), isLot && grey.has(key)), x: p.x, y: p.y, z: depth(i, j), key: isLot ? key : undefined });
    }
  for (const [key, b] of Object.entries(st.lots)) {
    if (!b) continue;
    const [i, j] = kij(key);
    const n = size[key] ?? 1;
    const { frameType, stage } = lookFor(era, b.type, b.n);
    const p = cellFront(i, j);
    // a 2×2 / 3×3 claim extends behind the owner lot: centre the sprite on the footprint
    const cx = p.x, cy = p.y - ((n - 1) * TH) / 2;
    things.push({ frame: buildingFrame(era, frameType, stage, grey.has(key)), x: cx, y: cy + ((n - 1) * TH) / 2, z: depth(i, j, 10), key, scale: n * BUILDING_SCALE });
  }
  const g = cellFront(0, 0);
  things.push({ frame: "gnomon", x: g.x, y: g.y, z: depth(0, 0, 10), key: "0,0" });
  const ring: Placed[] = [];
  const rs = ringStage(st);
  if (rs >= 0)
    for (const c of ringCells(r)) {
      const p = cellFront(c.i, c.j);
      const frame = c.piece === "gate" ? `gate/${rs}/B/${opts.dusk ? 1 : 0}` : `ring/${rs}/${c.piece}`;
      ring.push({ frame, x: p.x, y: p.y, z: depth(c.i, c.j, 5) });
    }
  // Hesper's tent on the eastern shore (LORE.md): just outside the ring, to the right
  const tc = cellFront(r + 2, -r + 1);
  things.push({ frame: "tent", x: tc.x, y: tc.y, z: depth(r + 2, -r + 1, 10) });
  // Hesper waits at her tent flap with the ledger
  things.push({ frame: "p/hesper/0", x: tc.x - 30, y: tc.y + 10, z: depth(r + 2, -r + 1, 11) });
  const top = cellFront(-S, -S), bot = cellFront(S, S), left = cellFront(-S, S), right = cellFront(S, -S);
  const gate = cellFront(r + 1, 0);
  // fit the ring edge to edge: the island fills the phone's width (owner feedback)
  const F = r + 1;
  const ft = cellFront(-F, -F), fb = cellFront(F, F), fl = cellFront(-F, F), fr = cellFront(F, -F);
  return {
    fitBounds: { x: fl.x - TW / 2 + 8, y: ft.y - TH - 50, w: fr.x - fl.x + TW - 16, h: fb.y - ft.y + TH + 50 },
    era,
    r,
    ground,
    ring,
    things,
    bounds: { x: left.x - TW / 2, y: top.y - TH - 80, w: right.x - left.x + TW, h: bot.y - top.y + TH + 80 },
    tent: tc,
    gate,
  };
}

/** Villagers drawn: a sample of the population, capped by the quality tier (FINAL_PLAN_BT.md §5). */
export const visibleFigures = (pop: number, cap: number): number => Math.max(0, Math.min(cap, Math.ceil(pop / 2)));
