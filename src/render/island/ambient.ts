/**
 * Ambient life, all of it deliberately cheap and pixel-flat: stepped sprite swaps, a few pooled
 * sprites, no filters on Low/Medium. What each graphics tier runs is the table below; the gull
 * flight and the calm/rough sea are pure functions (unit-tested) the view just plays back.
 */
import type { Tier } from "../config";

export interface Ambient {
  /** sea tile swaps while calm (steps/s); 0 = a still sea */
  seaFps: number;
  /** gulls in the sky (they all fly one way and face it) */
  gulls: number;
  /** grass tufts and fields sway by swapping baked frames */
  sway: boolean;
  /** pooled foam crests that roll in during the raid (Low just roughens the sea tile, still) */
  crests: number;
  /** Pixi mesh sway on sails and rags */
  mesh: boolean;
  /** the slow sparkle layer on the sea */
  glint: boolean;
  /** drifting cloud shadows */
  clouds: number;
  /** grass tufts scattered on open grass (static on Low) */
  tufts: number;
}

export const AMBIENT: Record<Tier, Ambient> = {
  low: { seaFps: 0, gulls: 0, sway: false, crests: 0, mesh: false, glint: false, clouds: 0, tufts: 16 },
  mid: { seaFps: 2, gulls: 3, sway: true, crests: 12, mesh: false, glint: false, clouds: 0, tufts: 36 },
  high: { seaFps: 2, gulls: 4, sway: true, crests: 20, mesh: true, glint: true, clouds: 2, tufts: 48 },
};

export type SeaState = "calm" | "rough";
/** Rough water exists only while a raid is on screen. */
export const seaState = (raidOn: boolean): SeaState => (raidOn ? "rough" : "calm");
/** Steps per second of the sea tile swap: a gentle shimmer when calm, livelier when rough. */
export const seaStepsPerSecond = (a: Ambient, s: SeaState): number => (a.seaFps === 0 ? 0 : s === "rough" ? 5 : a.seaFps);

/** Direction every crest travels: toward the island from the south-east, where the raiders land. */
export const WAVE_DIR = { x: -0.894, y: -0.447 } as const;

export interface GullSpec {
  /** signed world units per second: the sign is the direction of flight */
  speed: number;
  y0: number;
  bob: number;
  phase: number;
}
export interface GullPose {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** true when the (left-facing) sprite must be mirrored to face its flight */
  flipX: boolean;
  frame: number;
}
/** Writes into `out` so the frame loop allocates nothing. One lap crosses `span` wide, then wraps to the far side and keeps its heading. */
export function gullPose(g: GullSpec, t: number, x0: number, span: number, out: GullPose = { x: 0, y: 0, vx: 0, vy: 0, flipX: false, frame: 0 }): GullPose {
  const lap = span + 120;
  const travel = (((g.phase * lap + Math.abs(g.speed) * t) % lap) + lap) % lap;
  const x = g.speed >= 0 ? x0 - 60 + travel : x0 + span + 60 - travel;
  const w = t * 1.1 + g.phase * 6.28;
  out.x = x;
  out.y = g.y0 + Math.sin(w) * g.bob;
  out.vx = g.speed;
  out.vy = Math.cos(w) * 1.1 * g.bob;
  out.flipX = g.speed > 0;
  out.frame = Math.floor(t * 5 + g.phase * 4) % 4;
  return out;
}
/** Gulls placed by index: every gull flies the same way (west), a little apart in height and speed. */
export function gullSpecs(n: number, top: number, band: number): GullSpec[] {
  const out: GullSpec[] = [];
  for (let k = 0; k < n; k++) out.push({ speed: -(9 + (k % 3) * 2.5), y0: top + ((k * 0.37) % 1) * band, bob: 5 + (k % 2) * 3, phase: (k * 0.31 + 0.07) % 1 });
  return out;
}

/** Small deterministic generator for crest placement (no Math.random in the frame loop). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Crest opacity over its life: stepped fade in and out so it never looks smooth. */
export const crestAlpha = (u: number, on: boolean): number => {
  const a = u < 0.15 ? 0.4 : u < 0.3 ? 0.75 : u > 0.85 ? 0.4 : u > 0.7 ? 0.75 : 1;
  return on ? a : a * 0.5;
};
