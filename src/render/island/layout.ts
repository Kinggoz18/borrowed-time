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
import { coastFor, SHORE_CELLS } from "./coast";
import { landmarkFrame, placedLandmarks } from "./landmarks";
import { forestProps, lotGreens } from "./greens";
import { gateCell, logical, phys, physRadius, streetAt, streetMask } from "../../core/streets";

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
/** Where a lot stands on the ground: the lot grid is spread into city blocks with a street between them (core/streets.ts). */
export const lotFront = (i: number, j: number): { x: number; y: number } => cellFront(phys(i), phys(j));
/** The lot key under a world point, or null on a street, beyond the grid or at the gnomon. */
export function lotAt(x: number, y: number): { i: number; j: number } | null {
  const c = cellAt(x, y);
  const i = logical(c.i), j = logical(c.j);
  return i === null || j === null ? null : { i, j };
}
/** Draw order: back to front, then left to right; tall things after ground at the same cell. */
export const depth = (i: number, j: number, lift = 0): number => (i + j) * 100 + (i - j) + lift;

export const ERAS: readonly Era[] = ["colony", "village", "town", "city"];
export const eraOf = (tier: number): Era => ERAS[Math.max(0, Math.min(ERAS.length - 1, tier))];
export const radius = (tier: number): number => (TIERS[tier].grid - 1) / 2;
/**
 * The island is one fixed piece of land from the first day: its coast is cut for this radius, big
 * enough for the final City grid and its ring with a wide margin of meadow and beach. Only the
 * ring (the claimed, buildable ground) grows; the unclaimed land is open meadow and forest.
 */
export const ISLAND_R = 15;

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
  /** stone-edged shore overlays on the coast cells (needs a shore lookup, see LayoutOpts) */
  shore: Placed[];
  ring: Placed[];
  things: Placed[];
  /** world bounds of the land, for the camera clamp */
  bounds: { x: number; y: number; w: number; h: number };
  /** what the camera fits at minimum zoom: the whole island and a margin of sea */
  fitBounds: { x: number; y: number; w: number; h: number };
  /** the ring and a strip of shore: the play camera starts around this */
  playBounds: { x: number; y: number; w: number; h: number };
  /** Hesper's tent, east shore outside the ring */
  tent: { x: number; y: number };
  gate: { x: number; y: number };
  /** the landmarks the player has placed (cosmetic): where they stand and what their plaque says; `at` is the lot key or plaza tile they hold */
  landmarks: { id: string; name: string; plaque: string; at: string; i: number; j: number; x: number; y: number }[];
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

/** The ring sits one cell outside the built area (physical cells) and re-fits whenever the tier (grid) grows; its gate opens on the avenue. */
export function ringCells(r: number): { i: number; j: number; piece: RingPiece | "gate" }[] {
  const R = physRadius(r) + 1;
  const g = gateCell(r);
  const out: { i: number; j: number; piece: RingPiece | "gate" }[] = [];
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== R) continue;
      const corner = Math.abs(i) === R && Math.abs(j) === R;
      const piece: RingPiece | "gate" = corner ? "post" : i === g.i && j === g.j ? "gate" : Math.abs(j) === R ? "segA" : "segB";
      out.push({ i, j, piece });
    }
  return out;
}

export interface LayoutOpts {
  dusk?: boolean;
  /** the era whose pixel pages are loaded (the layout waits on them instead of asking for frames that are not there yet); default: the tier's era */
  era?: Era;
  /** frames that are pixel art: drawn at lot size already (the procedural stand-ins are scaled up) */
  pixel?: (frame: string) => boolean;
  /** shore overlay frame for a neighbour mask (null: nothing to draw) */
  shoreFrame?: (mask: number) => string | null;
}

export function layoutIsland(st: IslandState, opts: LayoutOpts = {}): IslandLayout {
  const era = opts.era ?? eraOf(st.tier);
  const r = radius(st.tier);
  const grey = E.greySet(st);
  const { owner, size } = E.claims(st);
  const roadOn = !!st.road;
  const streetCells: { i: number; j: number; mask: number; kind: string }[] = [];
  const ground: Placed[] = [];
  const shore: Placed[] = [];
  const things: Placed[] = [];
  const coast = coastFor(ISLAND_R);
  const isSand = (i: number, j: number): boolean => Math.max(Math.abs(i), Math.abs(j)) >= physRadius(r) + 2 && coast.sandy(i, j);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const PR = physRadius(r);
  const lms = placedLandmarks(st);
  // plazas: the four corners round the gnomon's block and any crossing a landmark was placed on; the other crossings are plain street
  const plazas = new Set(["2,2", "2,-2", "-2,2", "-2,-2", ...lms.filter((l) => l.at.startsWith("p:")).map((l) => `${l.i},${l.j}`)]);
  const greyFrame = (era: Era, kind: string, v: number, g: boolean): string => groundFrame(era, kind, v, g);
  void greyFrame;
  for (const { i, j } of coast.cells) {
    // (i, j) is a physical cell; a lot cell maps back to its logical key (core/streets.ts)
    const m = Math.max(Math.abs(i), Math.abs(j));
    const h = hash(i, j);
    const li = logical(i), lj = logical(j);
    const key = li !== null && lj !== null && m <= PR ? `${li},${lj}` : "";
    const isLot = key !== "" && key in st.lots;
    let kind = m >= PR + 2 ? (isSand(i, j) ? "sand" : "grass") : isLot ? "lot" : "grass";
    if (isLot && st.lots[key]?.type === "field") kind = "plot";
    const p = cellFront(i, j);
    // streets between the blocks: flush paved tiles once Roads are bought (a dirt track before), joined by junction masks
    let frame: string | null = null;
    const gate = gateCell(r);
    const isGateRoad = i === gate.i && j === gate.j;
    const sk0 = isGateRoad ? "street" : streetAt(i, j, r);
    const sk = sk0 === "plaza" && !plazas.has(`${i},${j}`) ? "street" : sk0;
    if (sk) {
      const mask = streetMask(i, j, r);
      const paved = roadOn && era !== "colony";
      const cand = sk === "plaza" ? `plaza/${era}` : paved ? `st/${era}/${mask}/${Math.floor(h * 2)}` : `st/track/${mask}`;
      if (opts.pixel?.(cand)) frame = cand;
      else if (paved && sk === "street") kind = "road";
      streetCells.push({ i, j, mask, kind: sk });
    }
    x0 = Math.min(x0, p.x - TW / 2); x1 = Math.max(x1, p.x + TW / 2);
    y0 = Math.min(y0, p.y - TH); y1 = Math.max(y1, p.y);
    ground.push({ frame: frame ?? groundFrame(era, kind, Math.floor(h * 3), isLot && grey.has(key)), x: p.x, y: p.y, z: depth(i, j), key: isLot ? key : undefined });
    // soft grass/sand border: the cell next to the other kind gets an overlay cut from the smoothed 3x3 neighbourhood (no 1-cell zigzag)
    if ((kind === "grass" || kind === "sand") && opts.pixel) {
      const own = kind === "sand";
      let bm = 0;
      for (let k = 0; k < SHORE_CELLS.length; k++) {
        const ni = i + SHORE_CELLS[k][0], nj = j + SHORE_CELLS[k][1];
        if (coast.isLand(ni, nj) && isSand(ni, nj) !== own) bm |= 1 << k;
      }
      const bf = bm ? `blend/${own ? "s" : "g"}/${bm}` : "";
      if (bf && opts.pixel(bf)) ground.push({ frame: bf, x: p.x, y: p.y, z: depth(i, j) + 0.5 });
    }
    const sf = opts.shoreFrame?.(coast.mask(i, j));
    if (sf) shore.push({ frame: sf, x: p.x, y: p.y - TH / 2, z: depth(i, j) });
  }
  for (const [key, b] of Object.entries(st.lots)) {
    if (!b) continue;
    const [i, j] = kij(key);
    const n = size[key] ?? 1;
    const { frameType, stage } = lookFor(era, b.type, b.n);
    const p = lotFront(i, j);
    // a 2×2 / 3×3 claim extends behind the owner lot: centre the sprite on the footprint
    const cx = p.x, cy = p.y - ((n - 1) * TH) / 2;
    // fields are a flush ground decal: do not scale them past the lot (A6)
    let frame = buildingFrame(era, frameType, stage, grey.has(key));
    // a claim of 2x2 or 3x3 draws the era's own big model (…/f2, …/f3, drawn at that size), never the 1x1 one blown up
    const big = n > 1 ? `${buildingFrame(era, frameType, stage)}/f${n}` : "";
    const native = big !== "" && !!opts.pixel?.(big);
    if (native) frame = big;
    // a block of the same building is not one colour: roof and wall variants (r1, r2) by lot, where the era has them
    if (!native && n === 1 && !grey.has(key) && b.type !== "field") {
      const roll = hash(i * 7 + 3, j * 5 + 11);
      const v = roll < 0.4 ? 0 : roll < 0.7 ? 1 : 2;
      if (v && opts.pixel?.(`${frame}/r${v}`)) frame = `${frame}/r${v}`;
    }
    // the City's tallest spires are capped so its skyline stays calm
    const cap = era === "city" && b.type === "tower" && n === 1 ? 0.86 : 1;
    const scale = (native ? 1 : b.type === "field" || opts.pixel?.(frame) ? n : n * BUILDING_SCALE) * cap;
    things.push({ frame, x: cx, y: cy + ((n - 1) * TH) / 2, z: depth(phys(i), phys(j), 10), key, scale });
  }
  const has = (f: string): boolean => !!opts.pixel?.(f);
  const tentCell = { i: PR + 2, j: -PR + 1 };
  const at = (i: number, j: number, frame: string, z: number, dx = 0, dy = 0): Placed => {
    const q = cellFront(i, j);
    return { frame, x: q.x + dx, y: q.y - TH / 2 + dy, z: depth(i, j, z) };
  };
  if (opts.pixel) {
    // open land: woods and bushes on the meadow the ring has not claimed (cleared as it grows), a bush on some empty lots
    for (const pr of forestProps(coast, PR, tentCell)) if (has(pr.frame)) things.push(at(pr.i, pr.j, pr.frame, 6, pr.dx, pr.dy));
    for (const key of Object.keys(st.lots)) {
      if (st.lots[key] !== null || owner[key] || E.lmLot(st, key)) continue;
      const [i, j] = kij(key);
      const gp = lotGreens(i, j, Math.max(Math.abs(i), Math.abs(j)) >= r - 1);
      if (gp && has(gp.frame)) things.push(at(phys(i), phys(j), gp.frame, 3, gp.dx, gp.dy));
    }
    // a lamp post at every junction once the streets are paved
    if (roadOn && (era === "town" || era === "city") && has(`sc/lamp/${era}`))
      for (const c of streetCells) if (c.kind === "street" && [1, 2, 4, 8].filter((b) => c.mask & b).length >= 3) things.push(at(c.i, c.j, `sc/lamp/${era}`, 8, -20, 8));
  }
  const landmarks: IslandLayout["landmarks"] = [];
  for (const lm of lms) {
    const frame = landmarkFrame(lm.def.id);
    if (opts.pixel && !has(frame)) continue; // its era page has not streamed in yet
    const q = cellFront(lm.i, lm.j);
    things.push({ frame, x: q.x, y: q.y, z: depth(lm.i, lm.j, lm.def.id === "dial" ? 2 : 12) });
    landmarks.push({ id: lm.def.id, name: lm.def.name, plaque: lm.def.plaque, at: lm.at, i: lm.i, j: lm.j, x: q.x, y: q.y });
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
  const tc = cellFront(tentCell.i, tentCell.j);
  things.push({ frame: "tent", x: tc.x, y: tc.y, z: depth(tentCell.i, tentCell.j, 10) });
  // Hesper waits at her tent flap with the ledger
  things.push({ frame: "p/hesper/0", x: tc.x - 30, y: tc.y + 10, z: depth(tentCell.i, tentCell.j, 11) });
  const gp0 = gateCell(r);
  const gate = cellFront(gp0.i, gp0.j);
  // the play camera frames the ring edge to edge; the minimum zoom shows the whole island and its sea
  const F = PR + 1;
  const ft = cellFront(-F, -F), fb = cellFront(F, F), fl = cellFront(-F, F), fr = cellFront(F, -F);
  const sea = 90;
  return {
    playBounds: { x: fl.x - TW / 2 + 8, y: ft.y - TH - 50, w: fr.x - fl.x + TW - 16, h: fb.y - ft.y + TH + 50 },
    fitBounds: { x: x0 - sea, y: y0 - sea, w: x1 - x0 + 2 * sea, h: y1 - y0 + 2 * sea },
    era,
    r,
    ground,
    shore,
    ring,
    things,
    bounds: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    tent: tc,
    gate,
    landmarks,
  };
}

/** Villagers drawn: a sample of the population, capped by the quality tier (FINAL_PLAN_BT.md §5). */
export const visibleFigures = (pop: number, cap: number): number => Math.max(0, Math.min(cap, Math.ceil(pop / 2)));

/**
 * Lots that should show corner ticks: every empty lot while placing (Build open or an empty
 * lot selected), otherwise only the selected lot. Never baked into the ground tile.
 */
export function lotCornerKeys(lots: Record<string, unknown> | null, selected: string | null, buildOpen = false): string[] {
  if (!lots) return [];
  const empty = Object.keys(lots).filter((k) => lots[k] == null);
  if (buildOpen || (selected && selected in lots && lots[selected] == null)) return empty;
  if (selected && selected in lots) return [selected];
  return [];
}
