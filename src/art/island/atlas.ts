/**
 * Builds the island atlas at boot from the procedural stand-ins: every frame drawn once into its
 * own canvas, shelf-packed into pages of at most 2048² (FINAL_PLAN_BT.md §5 atlas discipline).
 * One atlas per era and scale. Colony fits one 2048 page at s = 2; Village may use two (walk cycles).
 * Pure Canvas 2D: the renderer turns the pages into GPU textures.
 */
import { packShelves } from "../pack";
import { drawBuilding, drawGnomon, drawTent, ERA_TYPES, LOOKS_PER_ERA } from "./buildings";
import type { Era } from "./palette";
import { Pen } from "./pen";
import { ANIM_FRAMES, FLAG_FRAMES, JOBS, PERSON_ANIMS, PERSON_VIEWS, drawBoat, drawFlagFrame, drawFx, drawGrain, drawGate, drawGround, drawPerson, personFrame, personFrameName, drawRing, FX, greyify, GROUND_KINDS, GROUND_VARIANTS, RING_PIECES, RING_STAGES } from "./scenery";

export interface FrameDef {
  name: string;
  /** size and anchor in tile px at s = 1 */
  w: number;
  h: number;
  ax: number;
  ay: number;
  draw: (c: CanvasRenderingContext2D, s: number) => void;
  grey?: boolean;
  /** buildings on grey land keep more colour than the land itself, so types stay readable */
  greyAmount?: number;
}
export interface AtlasFrame {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** anchor as a fraction of the frame */
  ax: number;
  ay: number;
}
export interface IslandAtlas {
  era: Era;
  s: number;
  pages: HTMLCanvasElement[];
  frames: Map<string, AtlasFrame>;
  grain: HTMLCanvasElement;
}

const BW = 84, BH = 120, BAX = 42, BAY = 114;
const pen = (c: CanvasRenderingContext2D, ax: number, ay: number, s: number, seed: number) => new Pen(c, ax * s, ay * s, s, seed);
const seedOf = (name: string): number => {
  let h = 7;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
};

export const buildingFrame = (era: Era, type: string, stage: number, grey = false): string => `${grey ? "grey/" : ""}b/${era}/${type}/${stage}`;
export const groundFrame = (era: Era, kind: string, v: number, grey = false): string => `${grey ? "grey/" : ""}g/${era}/${kind}/${v}`;

/** Every frame of one era's atlas. */
export function frameDefs(era: Era): FrameDef[] {
  const out: FrameDef[] = [];
  const looks = LOOKS_PER_ERA[era];
  for (const type of ERA_TYPES[era])
    for (let st = 0; st < looks; st++)
      for (const grey of [false, true]) {
        const name = buildingFrame(era, type, st, grey);
        out.push({ name, w: BW, h: BH, ax: BAX, ay: BAY, grey, greyAmount: 0.5, draw: (c, s) => drawBuilding(pen(c, BAX, BAY, s, seedOf(name)), era, type, st) });
      }
  out.push({ name: "gnomon", w: BW, h: BH, ax: BAX, ay: BAY, draw: (c, s) => drawGnomon(pen(c, BAX, BAY, s, 3)) });
  out.push({ name: "tent", w: BW, h: BH, ax: BAX, ay: BAY, draw: (c, s) => drawTent(pen(c, BAX, BAY, s, 5)) });
  for (const kind of GROUND_KINDS)
    for (let v = 0; v < GROUND_VARIANTS; v++)
      for (const grey of [false, true])
        out.push({ name: groundFrame(era, kind, v, grey), w: 64, h: 34, ax: 32, ay: 33, grey, draw: (c, s) => drawGround(pen(c, 32, 33, s, v + 1), era, kind, v) });
  for (let st = 0; st < RING_STAGES; st++) {
    for (const piece of RING_PIECES) out.push({ name: `ring/${st}/${piece}`, w: 64, h: 64, ax: 32, ay: 50, draw: (c, s) => drawRing(pen(c, 32, 50, s, st + 9), st, piece) });
    for (const along of [true, false])
      for (const shut of [false, true])
        out.push({ name: `gate/${st}/${along ? "A" : "B"}/${shut ? 1 : 0}`, w: 64, h: 64, ax: 32, ay: 50, draw: (c, s) => drawGate(pen(c, 32, 50, s, st + 19), st, along, shut) });
  }
  for (const job of JOBS)
    for (const anim of PERSON_ANIMS)
      for (const view of PERSON_VIEWS)
        for (let f = 0; f < ANIM_FRAMES[anim]; f++) {
          const pf = personFrame(job);
          out.push({ name: personFrameName(job, anim, view, f), ...pf, draw: (c, s) => drawPerson(c, pf.ax * s, pf.ay * s, s, job, f, anim, view) });
        }
  out.push({ name: "boat", w: 56, h: 50, ax: 28, ay: 44, draw: (c, s) => drawBoat(c, 28 * s, 44 * s, s, true) });
  out.push({ name: "boat/beached", w: 56, h: 50, ax: 28, ay: 44, draw: (c, s) => drawBoat(c, 28 * s, 44 * s, s, false) });
  const fxSize: Record<string, [number, number]> = { fire: [16, 24], smoke: [24, 24], glow: [64, 64], spark: [6, 12], foam: [32, 12], dust: [24, 24] };
  for (const fx of FX) {
    const [w, h] = fxSize[fx];
    out.push({ name: `fx/${fx}`, w, h, ax: w / 2, ay: h / 2, draw: (c, s) => drawFx(c, w * s, h * s, fx, s) });
  }
  for (let f = 0; f < FLAG_FRAMES; f++) {
    out.push({ name: `fx/flag/${f}`, w: 16, h: 12, ax: 1, ay: 11, draw: (c, s) => drawFlagFrame(c, 16 * s, 12 * s, s, f) });
    out.push({ name: `fx/smoke/${f}`, w: 24, h: 24, ax: 12, ay: 20, draw: (c, s) => drawFx(c, 24 * s, 24 * s, "smoke", s, f) });
  }
  return out;
}

export type CanvasFactory = (w: number, h: number) => HTMLCanvasElement;
const domCanvas: CanvasFactory = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** `keep` drops frames another atlas already supplies (the pixel-art pages replace most stand-ins). */
export function buildAtlas(era: Era, s: number, make: CanvasFactory = domCanvas, maxSize = 2048, keep: (name: string) => boolean = () => true): IslandAtlas {
  const defs = frameDefs(era).filter((d) => keep(d.name));
  const drawn = new Map<string, HTMLCanvasElement>();
  for (const f of defs) {
    const w = Math.ceil(f.w * s), h = Math.ceil(f.h * s);
    const cv = make(w, h);
    const c = cv.getContext("2d", { willReadFrequently: !!f.grey })!;
    f.draw(c, s);
    if (f.grey) greyify(c, w, h, s, f.greyAmount ?? 0.85, f.greyAmount ? 0.1 : 0.18);
    drawn.set(f.name, cv);
  }
  const packed = packShelves(defs.map((f) => ({ name: f.name, w: Math.ceil(f.w * s), h: Math.ceil(f.h * s) })), maxSize);
  const frames = new Map<string, AtlasFrame>();
  const byName = new Map(defs.map((f) => [f.name, f]));
  const pages = packed.pages.map((pg) => make(pg.w, pg.h));
  for (const it of packed.placed) {
    pages[it.page].getContext("2d")!.drawImage(drawn.get(it.name)!, it.x, it.y);
    const f = byName.get(it.name)!;
    frames.set(it.name, { page: it.page, x: it.x, y: it.y, w: it.w, h: it.h, ax: f.ax / f.w, ay: f.ay / f.h });
  }
  for (const job of JOBS) {
    const a = frames.get(personFrameName(job, "walk", "se", 0));
    const b = frames.get(personFrameName(job, "walk", "se", 1));
    if (a) frames.set(`p/${job}/0`, a);
    if (b) frames.set(`p/${job}/1`, b);
  }
  const grain = make(128, 128);
  drawGrainInto(grain);
  return { era, s, pages, frames, grain };
}
function drawGrainInto(cv: HTMLCanvasElement): void {
  drawGrain(cv.getContext("2d")!, cv.width, 1337);
}
