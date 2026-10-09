/**
 * The City-tier worst-case island for the Phase 0 stress scene (FINAL_PLAN_BT.md §5).
 * Pure data, no rendering: lots, buildings at looks 5-7, the 7th-stage palisade ring, roads,
 * outskirts, docks, grey land, fires, people and boats. Same seed, same island.
 */
import { BUILDING_TYPES, CITY_COUNTS, footprintForLook, type BuildingType } from "./catalog";
import { depthKey, footprintAnchor, project, type Point } from "./iso";
import { Rng } from "./rng";

export const CITY_SIZE = 21;
export const OUTSKIRTS = 6;
export const PLAZA = { i: 9, j: 9, n: 3 };
export const GNOMON_LOT = { i: 10, j: 10 };
/** Hour-line roads: these rows and columns inside the wall (the plaza is excluded). */
export const ROAD_LINES = [4, 10, 16];

export interface Building {
  id: number;
  type: BuildingType;
  look: number; // 0-based: 4 = stone, 5 = fine, 6 = grand
  i: number;
  j: number;
  n: 1 | 2 | 3;
  anchor: Point;
  depth: number;
  grey: boolean;
  fire: boolean;
  /** A cottage merged into a terrace block (drawn with a block frame). */
  block: boolean;
}

export type WallPiece = "segI" | "segJ" | "gateI" | "gateJ" | "corner";
export interface Wall {
  piece: WallPiece;
  stage: number; // 0-based, 6 = fortified
  i: number;
  j: number;
  anchor: Point;
  depth: number;
  /** Back walls (the two far sides) go into the static ground bake. */
  back: boolean;
}

export type PropKind = "farm" | "hut" | "windmill" | "tree" | "pier" | "crates";
export interface Prop {
  kind: PropKind;
  i: number;
  j: number;
  anchor: Point;
  depth: number;
}

export interface Boat {
  id: number;
  home: Point;
  phase: number;
}

export interface City {
  seed: number;
  size: number;
  /** For every lot inside the wall: what it holds. */
  lotUse: ("empty" | "road" | "plaza" | "building" | "tent")[];
  /** Lots in grey order (sea-facing first); the first greyCount are grey. */
  greyOrder: number[];
  greyCount: number;
  /** greyLots[lotIndex(i, j)] is true for grey (debt) land. */
  greyLots: boolean[];
  buildings: Building[];
  walls: Wall[];
  props: Prop[];
  boats: Boat[];
  roads: { i: number; j: number }[];
  tent: { i: number; j: number; anchor: Point; depth: number };
  gnomon: { anchor: Point; depth: number };
}

export const lotIndex = (i: number, j: number, size = CITY_SIZE) => j * size + i;
export const inside = (i: number, j: number, size = CITY_SIZE) => i >= 0 && j >= 0 && i < size && j < size;

function isRoad(i: number, j: number): boolean {
  const inPlaza = i >= PLAZA.i && i < PLAZA.i + PLAZA.n && j >= PLAZA.j && j < PLAZA.j + PLAZA.n;
  return !inPlaza && (ROAD_LINES.includes(i) || ROAD_LINES.includes(j));
}

/** Grey order: the front shore (largest i + j, facing the open sea and the raiders) first. */
export function greyOrderFor(size: number): number[] {
  const lots: number[] = [];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) lots.push(lotIndex(i, j, size));
  const edge = (k: number) => {
    const i = k % size, j = Math.floor(k / size);
    return Math.min(size - 1 - i, size - 1 - j);
  };
  return lots.sort((a, b) => {
    const sa = (a % size) + Math.floor(a / size), sb = (b % size) + Math.floor(b / size);
    return sb - sa || edge(a) - edge(b) || a - b;
  });
}

export function buildCity(seed = 1, greyShare = 0.5): City {
  const rng = new Rng(seed);
  const size = CITY_SIZE;
  const lotUse: City["lotUse"] = new Array(size * size).fill("empty");
  const roads: City["roads"] = [];
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      if (i >= PLAZA.i && i < PLAZA.i + PLAZA.n && j >= PLAZA.j && j < PLAZA.j + PLAZA.n) lotUse[lotIndex(i, j)] = "plaza";
      else if (isRoad(i, j)) {
        lotUse[lotIndex(i, j)] = "road";
        roads.push({ i, j });
      }
    }
  // Hesper's tent: 2x2 near the back corner, never re-skinned.
  const tent = { i: 1, j: 1, anchor: footprintAnchor(1, 1, 2), depth: depthKey(1, 1, 2) };
  for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) lotUse[lotIndex(1 + di, 1 + dj)] = "tent";

  const free = (i: number, j: number, n: number) => {
    for (let dj = 0; dj < n; dj++)
      for (let di = 0; di < n; di++) {
        if (!inside(i + di, j + dj) || lotUse[lotIndex(i + di, j + dj)] !== "empty") return false;
      }
    return true;
  };

  const order = greyOrderFor(size);
  const greyCount = Math.round(size * size * greyShare);
  const greySet = new Set(order.slice(0, greyCount));

  // Unique buildings first (they want 3x3), then the many: watchtowers, clockworks, fields, cottages.
  const queue: BuildingType[] = [];
  for (const t of BUILDING_TYPES) if (CITY_COUNTS[t] === 1) queue.push(t);
  for (const t of ["watchtower", "clockworks", "field", "cottage"] as const) for (let k = 0; k < CITY_COUNTS[t]; k++) queue.push(t);

  const candidates: { i: number; j: number }[] = [];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) candidates.push({ i, j });

  const buildings: Building[] = [];
  for (const type of queue) {
    const wanted = CITY_COUNTS[type] === 1 ? 6 : rng.pick([4, 5, 5, 6]);
    let placed = false;
    // Try the wanted look, then smaller footprints ("otherwise they just grow taller": keep look 5).
    for (let look = wanted; look >= 4 && !placed; look = look === 6 ? 5 : look - 1) {
      const n = footprintForLook(look);
      const spots = rng.shuffle(candidates.filter((c) => free(c.i, c.j, n)));
      if (spots.length === 0) continue;
      const s = spots[0];
      for (let dj = 0; dj < n; dj++) for (let di = 0; di < n; di++) lotUse[lotIndex(s.i + di, s.j + dj)] = "building";
      buildings.push({
        id: buildings.length,
        type,
        look,
        i: s.i,
        j: s.j,
        n,
        anchor: footprintAnchor(s.i, s.j, n),
        depth: depthKey(s.i, s.j, n),
        grey: greySet.has(lotIndex(s.i + n - 1, s.j + n - 1)),
        fire: false,
        block: false,
      });
      placed = true;
    }
    if (!placed) {
      // A tall 1x1 at the stone look on any free lot.
      const spots = candidates.filter((c) => free(c.i, c.j, 1));
      if (spots.length === 0) break;
      const s = rng.pick(spots);
      lotUse[lotIndex(s.i, s.j)] = "building";
      // Cottages that can't spread merge into a terrace block (plan §2); others keep the tall 1x1 look.
      const cottage = type === "cottage";
      buildings.push({ id: buildings.length, type, look: cottage ? 4 : 3, i: s.i, j: s.j, n: 1, anchor: footprintAnchor(s.i, s.j, 1), depth: depthKey(s.i, s.j, 1), grey: greySet.has(lotIndex(s.i, s.j)), fire: false, block: cottage });
    }
  }
  // Fill the remaining empty lots with cottages merged into terrace blocks (Town up, plan §2).
  for (const c of candidates) {
    if (!free(c.i, c.j, 1)) continue;
    lotUse[lotIndex(c.i, c.j)] = "building";
    buildings.push({ id: buildings.length, type: "cottage", look: rng.pick([3, 4]), i: c.i, j: c.j, n: 1, anchor: footprintAnchor(c.i, c.j, 1), depth: depthKey(c.i, c.j, 1), grey: greySet.has(lotIndex(c.i, c.j)), fire: false, block: true });
  }
  // Fire on 6 buildings, front (grey) side first: the raid's work.
  const burnable = buildings.filter((b) => b.grey && b.n <= 2).sort((a, b) => b.depth - a.depth);
  for (let k = 0; k < 6 && k < burnable.length; k++) burnable[Math.floor((k * burnable.length) / 6)].fire = true;

  // Palisade ring, 7th stage, around the 21x21 perimeter. Gates where roads meet the wall.
  const walls: Wall[] = [];
  const stage = 6;
  for (let k = 0; k < size; k++) {
    const gate = ROAD_LINES.includes(k);
    // Back sides: j = -1 (runs along i) and i = -1 (runs along j). Front sides: j = size, i = size.
    walls.push({ piece: gate ? "gateI" : "segI", stage, i: k, j: -1, anchor: footprintAnchor(k, -1, 1), depth: depthKey(k, -1, 1, 1), back: true });
    walls.push({ piece: gate ? "gateJ" : "segJ", stage, i: -1, j: k, anchor: footprintAnchor(-1, k, 1), depth: depthKey(-1, k, 1, 1), back: true });
    walls.push({ piece: gate ? "gateI" : "segI", stage, i: k, j: size, anchor: footprintAnchor(k, size, 1), depth: depthKey(k, size, 1, 1), back: false });
    walls.push({ piece: gate ? "gateJ" : "segJ", stage, i: size, j: k, anchor: footprintAnchor(size, k, 1), depth: depthKey(size, k, 1, 1), back: false });
  }
  for (const [ci, cj, back] of [[-1, -1, true], [size, -1, true], [-1, size, true], [size, size, false]] as const)
    walls.push({ piece: "corner", stage, i: ci, j: cj, anchor: footprintAnchor(ci, cj, 1), depth: depthKey(ci, cj, 1, 1), back });

  // Drawn outskirts beyond the wall: avenues, a tree belt, farms, huts, windmills; docks and piers at the front.
  const props: Prop[] = [];
  const lo = -1 - OUTSKIRTS, hi = size + OUTSKIRTS;
  for (let j = lo; j <= hi; j++)
    for (let i = lo; i <= hi; i++) {
      if (i >= -1 && j >= -1 && i <= size && j <= size) continue;
      const ring = Math.max(-1 - i, -1 - j, i - size, j - size); // 1..OUTSKIRTS
      const avenue = ROAD_LINES.includes(i) || ROAD_LINES.includes(j);
      if (avenue) continue;
      const front = i > size || j > size;
      let kind: PropKind | null;
      if (front && ring >= OUTSKIRTS - 1) kind = (i + j) % 4 === 0 ? "pier" : null;
      else if (ring >= OUTSKIRTS - 1) kind = "tree";
      else if (ring <= 2) kind = rng.next() < 0.55 ? "farm" : rng.next() < 0.5 ? "hut" : "crates";
      else kind = rng.next() < 0.12 ? "windmill" : rng.next() < 0.6 ? "farm" : "tree";
      if (kind) props.push({ kind, i, j, anchor: footprintAnchor(i, j, 1), depth: depthKey(i, j, 1) });
    }

  const boats: Boat[] = [];
  for (let k = 0; k < 6; k++) {
    const p = project(size + OUTSKIRTS + 2.5, 3 + k * 3.2);
    boats.push({ id: k, home: { x: p.x, y: p.y }, phase: rng.range(0, Math.PI * 2) });
  }

  const g = project(GNOMON_LOT.i + 0.5, GNOMON_LOT.j + 0.5);
  return {
    seed,
    size,
    lotUse,
    greyOrder: order,
    greyCount,
    greyLots: Array.from({ length: size * size }, (_, k) => greySet.has(k)),
    buildings,
    walls,
    props,
    boats,
    roads,
    tent,
    gnomon: { anchor: g, depth: depthKey(GNOMON_LOT.i, GNOMON_LOT.j, 1, 2) },
  };
}

export function isGreyLot(city: City, i: number, j: number): boolean {
  if (!inside(i, j, city.size)) return false;
  return city.greyLots[lotIndex(i, j, city.size)];
}

/** World bounds of everything drawn (island + outskirts + sea margin). */
export function worldBounds(size = CITY_SIZE, margin = OUTSKIRTS + 3): { x: number; y: number; w: number; h: number } {
  const left = project(-margin - 1, size + margin);
  const right = project(size + margin, -margin - 1);
  const top = project(-margin - 1, -margin - 1);
  const bottom = project(size + margin, size + margin);
  return { x: left.x, y: top.y - 448, w: right.x - left.x, h: bottom.y - top.y + 448 };
}
