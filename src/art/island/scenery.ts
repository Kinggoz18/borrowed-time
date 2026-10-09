/**
 * Ground, ring, people, boats and effects for the island stand-ins (ART_BIBLE.md §2, §4, §5, §9).
 * Same rules as the buildings: 2:1 iso, ink outlines, baked 3-step light from the upper left.
 */
import { BRASS_PIN, DRIFT, FOAM, INK, SAIL, STRIPE, TARR, kitFor, type Era, type EraKit, type Ramp } from "./palette";
import type { Ctx, Pen } from "./pen";

export type GroundKind = "grass" | "lot" | "sand" | "road" | "plot";
export const GROUND_KINDS: GroundKind[] = ["grass", "lot", "sand", "road", "plot"];
export const GROUND_VARIANTS = 3;

/** Small deterministic hash for scatter detail. */
const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const wob = (v: number, n: number, amt = 0.05): number => amt * (hash(v, n) - 0.5) * 2;

/** One ground tile. Ground tiles have no outer line (they tile); they sit flush, not as raised slabs. */
export function drawGround(p: Pen, era: Era, kind: GroundKind, v: number): void {
  const k = kitFor(era);
  if (kind === "plot") {
    drawPlot(p, k, v);
    return;
  }
  const base: Record<Exclude<GroundKind, "plot">, Ramp> = { grass: k.grass, lot: k.grass, sand: SAND, road: ROAD };
  const r = base[kind];
  p.diamond(0, 0, 1, 1, 0, r.base, "none");
  if (kind === "sand") {
    // a hint of form, not a bevelled slab
    p.poly([p.P(0.02, 0.02), p.P(0.98, 0.02), p.P(0.9, 0.1), p.P(0.1, 0.1)], r.light, "none");
  }
  if (kind === "lot") {
    // grass/dirt blend: worked earth patches, no stakes, no outline, no bevel
    for (let n = 0; n < 5; n++) {
      const a = 0.18 + 0.64 * hash(v * 5 + n, 3), b = 0.18 + 0.64 * hash(n + 9, v + 2);
      const s = 0.1 + 0.08 * hash(n, v);
      p.diamond(a, b, a + s, b + s * 0.85, 0, hash(n, v + 7) > 0.45 ? k.ground.base : k.ground.light, "none");
    }
  }
  const c = p.c;
  for (let n = 0; n < 7; n++) {
    const a = 0.15 + 0.7 * hash(v * 13 + n, kind.length), b = 0.15 + 0.7 * hash(n * 7 + 3, v + 11);
    const [x, y] = p.P(a, b);
    c.strokeStyle = kind === "grass" || kind === "lot" ? k.grass.shade : r.light;
    c.lineWidth = p.line / 2;
    c.lineCap = "round";
    c.beginPath();
    if (kind === "grass" || kind === "lot") {
      c.moveTo(x - 2 * p.s, y);
      c.lineTo(x - 1 * p.s, y - 3 * p.s);
      c.moveTo(x + 1 * p.s, y);
      c.lineTo(x + 2 * p.s, y - 3 * p.s);
    } else {
      c.arc(x, y, 0.8 * p.s, 0, Math.PI * 2);
    }
    c.stroke();
  }
  if (kind === "road") {
    for (let n = 0; n < 5; n++) {
      const a = 0.2 + 0.6 * hash(n + 40, v), b = 0.2 + 0.6 * hash(v + 9, n + 2);
      p.diamond(a, b, a + 0.08, b + 0.08, 0, ROAD.light, "none");
    }
  }
}

/** Field soil as a ground decal: height 0, no outline, no shadow, edge feathered into grass. */
function drawPlot(p: Pen, k: EraKit, v: number): void {
  p.diamond(0, 0, 1, 1, 0, k.grass.base, "none");
  const soil = [
    p.P(0.10 + wob(v, 1), 0.12 + wob(v, 2), 0),
    p.P(0.50 + wob(v, 3, 0.04), 0.05 + wob(v, 4, 0.03), 0),
    p.P(0.90 + wob(v, 5), 0.11 + wob(v, 6), 0),
    p.P(0.95 + wob(v, 7, 0.03), 0.50 + wob(v, 8), 0),
    p.P(0.88 + wob(v, 9), 0.90 + wob(v, 10), 0),
    p.P(0.50 + wob(v, 11, 0.04), 0.96 + wob(v, 12, 0.03), 0),
    p.P(0.10 + wob(v, 13), 0.88 + wob(v, 14), 0),
    p.P(0.05 + wob(v, 15, 0.03), 0.50 + wob(v, 16), 0),
  ];
  p.poly(soil, k.ground.base, "none");
  const inner = [
    p.P(0.22 + wob(v, 21, 0.03), 0.24 + wob(v, 22, 0.03), 0),
    p.P(0.78 + wob(v, 23, 0.03), 0.22 + wob(v, 24, 0.03), 0),
    p.P(0.80 + wob(v, 25, 0.03), 0.78 + wob(v, 26, 0.03), 0),
    p.P(0.22 + wob(v, 27, 0.03), 0.80 + wob(v, 28, 0.03), 0),
  ];
  p.poly(inner, k.ground.shade, "none");
  const c = p.c;
  c.strokeStyle = k.ground.light;
  c.lineWidth = Math.max(0.6, p.line / 3);
  c.lineCap = "round";
  for (let n = 0; n < 5; n++) {
    const b = 0.22 + n * 0.14 + wob(v, 30 + n, 0.02);
    c.beginPath();
    const [x0, y0] = p.P(0.2, b, 0);
    const [x1, y1] = p.P(0.8, b, 0);
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  // grass tufts along the soil edge so the plot feathers into the neighbouring tiles
  c.strokeStyle = k.grass.shade;
  c.lineWidth = p.line / 2;
  for (let n = 0; n < 8; n++) {
    const t = n / 8;
    const a = 0.08 + 0.84 * ((t + hash(v, n + 40)) % 1);
    const b = n % 2 ? 0.08 + 0.06 * hash(n, v) : 0.86 + 0.08 * hash(v, n);
    const [x, y] = p.P(n % 2 ? a : n < 4 ? 0.1 : 0.88, n % 2 ? b : a, 0);
    c.beginPath();
    c.moveTo(x - 1.5 * p.s, y);
    c.lineTo(x, y - 2.5 * p.s);
    c.moveTo(x + 1.5 * p.s, y);
    c.lineTo(x + 0.4 * p.s, y - 2.2 * p.s);
    c.stroke();
  }
}
const SAND: Ramp = { light: "#E8DCB8", base: "#D9C9A0", shade: "#B9A87F" };
const ROAD: Ramp = { light: "#C9B58E", base: "#AE9A74", shade: "#8A7859" };

/** The ring: what the colony builds to keep the night out. 0 stakes, 1 woven, 2 log wall, 3 log + walk. */
export type RingPiece = "segA" | "segB" | "post";
export const RING_PIECES: RingPiece[] = ["segA", "segB", "post"];
export const RING_STAGES = 4;
export function drawRing(p: Pen, stage: number, piece: RingPiece): void {
  const wood = DRIFT;
  const h = [9, 11, 15, 17][stage];
  if (piece === "post") {
    p.post(0.5, 0.5, 0, h + 4, 2.6, wood.base);
    p.poly([p.P(0.5, 0.5, h + 4), p.P(0.56, 0.44, h + 8), p.P(0.6, 0.5, h + 4)], wood.light, "inner");
    return;
  }
  const along = piece === "segA";
  const at = (u: number, z: number) => (along ? p.P(u, 0.5, z) : p.P(0.5, u, z));
  if (stage === 0) {
    // sharpened stakes, gaps between
    for (let u = 0.08; u < 1; u += 0.21) {
      const [x, y] = at(u, 0);
      p.poly([[x - 2 * p.s, y], [x + 2 * p.s, y], [x + 2 * p.s, y - h * p.s], [x, y - (h + 4) * p.s], [x - 2 * p.s, y - h * p.s]], u < 0.5 ? wood.light : wood.base);
    }
    p.line2(at(0, 5), at(1, 5), 0.6);
    return;
  }
  // a continuous face: woven hurdle, then logs; the face toward the viewer gets the base step
  const face: Ramp = stage === 1 ? { light: "#B49D6D", base: "#97805A", shade: "#6E5D41" } : wood;
  p.poly([at(0, 0), at(1, 0), at(1, h), at(0, h)], face.base);
  p.poly([at(0, h), at(1, h), at(1, h + 2.5), at(0, h + 2.5)], face.light, "inner");
  if (stage === 1) for (let z = 3; z < h; z += 3) p.line2(at(0.03, z), at(0.97, z), 0.35, face.shade);
  else {
    for (let u = 0.1; u < 1; u += 0.16) {
      p.line2(at(u, 0.5), at(u, h - 0.5), 0.45, face.shade);
      const [x, y] = at(u, h + 2.5);
      p.poly([[x - 2 * p.s, y], [x, y - 3 * p.s], [x + 2 * p.s, y]], face.light, "inner");
    }
  }
  if (stage === 3) {
    // the wall-walk: a plank ledge on brackets behind the points
    p.poly([at(0, h - 4), at(1, h - 4), at(1, h - 2), at(0, h - 2)], wood.shade, "inner");
  }
}

/** Gate: two posts and a lintel, with a door that shuts at dusk. */
export function drawGate(p: Pen, stage: number, along: boolean, shut: boolean): void {
  const h = [12, 14, 18, 21][stage];
  const at = (u: number, z: number) => (along ? p.P(u, 0.5, z) : p.P(0.5, u, z));
  if (shut) p.poly([at(0.18, 0), at(0.82, 0), at(0.82, h - 3), at(0.18, h - 3)], DRIFT.shade);
  p.poly([at(0.05, 0), at(0.18, 0), at(0.18, h), at(0.05, h)], DRIFT.base);
  p.poly([at(0.82, 0), at(0.95, 0), at(0.95, h), at(0.82, h)], DRIFT.base);
  p.poly([at(0.02, h), at(0.98, h), at(0.98, h + 3), at(0.02, h + 3)], DRIFT.light);
}

/** Jobs and their tunic colours (no colour-only meaning: jobs also carry a tool silhouette). */
export type Job = "field" | "clockworks" | "trade" | "watch" | "raider" | "hesper";
export const JOBS: Job[] = ["field", "clockworks", "trade", "watch", "raider", "hesper"];
/** Costume by job (ART_BIBLE.md §10): field moss, Clockworks oak, watch driftwood, trade ochre. */
const TUNIC: Record<Job, Ramp> = {
  field: { light: "#9DAA6E", base: "#7E8F55", shade: "#5C6B3D" },
  clockworks: { light: "#987554", base: "#72583F", shade: "#4F3C2C" },
  trade: { light: "#DDB879", base: "#BD9D68", shade: "#8F754F" },
  watch: DRIFT,
  raider: TARR,
  hesper: { light: "#5A4E48", base: "#3F3633", shade: "#2B2422" }, // her long dark coat
};
const SKIN = "#E2B98F";
const LATE_SKIN = "#7B7366"; // the Late are tar-grey silhouettes (ART_BIBLE.md §10)

/** Figure height in world px: villagers 0.4 of a tile, Hesper 0.55 (ART_BIBLE.md §10). */
export const PERSON_H = 26;
export const HESPER_H = 35;
/** Atlas frame for a figure (world units), anchored at the feet. */
export const personFrame = (job: Job) => (job === "hesper" ? { w: 26, h: 42, ax: 13, ay: 40 } : { w: 28, h: 34, ax: 14, ay: 32 });

/**
 * A paper puppet (ART_BIBLE.md §10): six flat parts (legs in one piece, torso, head, two arms,
 * prop), ink outlines, brass split pins at the neck, shoulders and hip, two ink dots for a face.
 * Frame 0/1 are the two baked poses (legs ±12°, the working arm ±25°).
 */
export function drawPerson(c: Ctx, ax: number, ay: number, s: number, job: Job, frame: number): void {
  const L = Math.max(1.2, 0.9 * s);
  const t = TUNIC[job];
  const late = job === "raider";
  const hes = job === "hesper";
  const skin = late ? LATE_SKIN : SKIN;
  const sw = frame ? 1 : -1;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.strokeStyle = INK;
  c.lineWidth = L;
  const shape = (pts: number[][], fill: string): void => {
    c.beginPath();
    pts.forEach(([x, y], k) => (k ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  const pin = (x: number, y: number): void => {
    c.beginPath();
    c.arc(x * s, y * s, 1.05 * s, 0, Math.PI * 2);
    c.fillStyle = BRASS_PIN;
    c.fill();
    c.lineWidth = Math.max(0.8, 0.45 * s);
    c.stroke();
    c.lineWidth = L;
  };
  const at = (x: number, y: number, ang: number, draw: () => void): void => {
    c.save();
    c.translate(ax + x * s, ay + y * s);
    c.rotate(ang);
    draw();
    c.restore();
  };
  // proportions (world px above the feet)
  const hipY = -9;
  const neckY = hes ? -26 : -18;
  const headR = hes ? 3.4 : 3.8;
  const tw = hes ? 3.2 : 4; // half torso width at the shoulders
  const armLen = hes ? 10 : 8.5;
  const shoulderY = neckY + 1.6;
  const back = { x: -tw + 0.6, y: shoulderY };
  const front = { x: tw - 0.6, y: shoulderY };
  const swingBack = (sw * 18 * Math.PI) / 180;
  const work = hes ? (-30 * Math.PI) / 180 : ((sw * 25 - 15) * Math.PI) / 180;

  const arm = (fill: string): void => shape([[-1.3, 0], [1.3, 0], [1.1, armLen], [-1.1, armLen]], fill);
  // back arm (behind the body, in shade)
  at(back.x, back.y, swingBack, () => arm(late ? TARR.shade : t.shade));
  // legs: one piece on the hip pin
  at(0, hipY, hes ? 0 : (sw * 12 * Math.PI) / 180, () => {
    const lw = hes ? 2.6 : 3.4;
    shape([[-lw, 0], [lw, 0], [lw + 0.4, -hipY], [0.6, -hipY], [0, 3], [-0.6, -hipY], [-lw - 0.4, -hipY]], late ? TARR.shade : hes ? "#2B2422" : DRIFT.shade);
  });
  // torso (Hesper: a long coat down to the ankles)
  if (hes) {
    shape([[ax / s - tw, ay / s + neckY], [ax / s + tw, ay / s + neckY], [ax / s + tw + 2.2, ay / s - 3], [ax / s - tw - 2.2, ay / s - 3]], t.base);
    shape([[ax / s + 0.6, ay / s + neckY + 0.6], [ax / s + tw - 0.4, ay / s + neckY + 0.6], [ax / s + tw + 1.6, ay / s - 3.6], [ax / s + 0.6, ay / s - 3.6]], t.shade);
    // terracotta striped sash, shoulder to hip
    at(0, 0, 0, () => {
      c.save();
      c.beginPath();
      c.moveTo(-tw * s, (neckY + 1) * s);
      c.lineTo((-tw + 2.4) * s, (neckY + 0.2) * s);
      c.lineTo((tw + 1.8) * s, (hipY - 2) * s);
      c.lineTo((tw - 0.6) * s, (hipY - 0.6) * s);
      c.closePath();
      c.fillStyle = STRIPE.base;
      c.fill();
      c.clip();
      c.strokeStyle = SAIL.light;
      c.lineWidth = 0.7 * s;
      for (let k = -2; k < 8; k++) {
        c.beginPath();
        c.moveTo((-tw - 2 + k * 2.2) * s, (neckY - 2) * s);
        c.lineTo((-tw + 2 + k * 2.2) * s, (hipY + 2) * s);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = INK;
      c.lineWidth = L * 0.8;
      c.beginPath();
      c.moveTo(-tw * s, (neckY + 1) * s);
      c.lineTo((-tw + 2.4) * s, (neckY + 0.2) * s);
      c.lineTo((tw + 1.8) * s, (hipY - 2) * s);
      c.lineTo((tw - 0.6) * s, (hipY - 0.6) * s);
      c.closePath();
      c.stroke();
      c.lineWidth = L;
    });
  } else {
    shape([[ax / s - tw, ay / s + neckY], [ax / s + tw, ay / s + neckY], [ax / s + tw - 0.6, ay / s + hipY + 0.5], [ax / s - tw + 0.6, ay / s + hipY + 0.5]], t.base);
    shape([[ax / s + 0.8, ay / s + neckY + 0.7], [ax / s + tw - 0.6, ay / s + neckY + 0.7], [ax / s + tw - 1.1, ay / s + hipY], [ax / s + 0.8, ay / s + hipY]], t.shade);
    if (late) {
      // a ragged hem: the Late wear what their island had when it stopped
      shape([[ax / s - tw + 0.6, ay / s + hipY], [ax / s - tw - 0.4, ay / s + hipY + 3], [ax / s - 1, ay / s + hipY + 1.5], [ax / s + 1, ay / s + hipY + 3.2], [ax / s + tw + 0.4, ay / s + hipY + 1], [ax / s + tw - 0.6, ay / s + hipY]], TARR.base);
    }
  }
  // head: two ink dots, no mouth
  at(0, neckY - headR + 0.6, sw * 0.05, () => {
    c.beginPath();
    c.arc(0, 0, headR * s, 0, Math.PI * 2);
    c.fillStyle = skin;
    c.fill();
    c.stroke();
    if (late) {
      // a hood
      shape([[-headR - 0.5, 1], [-headR + 0.2, -headR + 0.4], [0, -headR - 1.2], [headR - 0.2, -headR + 0.4], [headR + 0.5, 1], [headR - 1.2, -0.4], [-headR + 1.2, -0.4]], TARR.base);
    }
    c.fillStyle = late ? PAPER_DOT : INK;
    for (const dx of [0.4, 2]) {
      c.beginPath();
      c.arc(dx * s, 0.3 * s, 0.55 * s, 0, Math.PI * 2);
      c.fill();
    }
  });
  // front arm + prop on the shoulder pin
  at(front.x, front.y, work, () => {
    arm(late ? TARR.base : t.light);
    c.translate(0, armLen * s);
    c.rotate(-work * 0.8); // props stay roughly upright in the hand
    prop(c, s, job, L);
  });
  pin(ax / s + 0, ay / s + neckY);
  pin(ax / s + front.x, ay / s + front.y);
  pin(ax / s + back.x, ay / s + back.y);
  pin(ax / s + 0, ay / s + hipY);
}
const PAPER_DOT = "#E8DCC4";

/** The prop in the front hand (origin at the hand). */
function prop(c: Ctx, s: number, job: Job, L: number): void {
  c.strokeStyle = INK;
  c.lineWidth = L;
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    c.beginPath();
    c.rect(x * s, y * s, w * s, h * s);
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  if (job === "field") {
    // a hoe
    c.beginPath();
    c.moveTo(0, -9 * s);
    c.lineTo(0, 7 * s);
    c.stroke();
    box(-0.5, 5.5, 3.6, 1.8, GNOMON_GREY);
  } else if (job === "watch") {
    // a spear
    c.beginPath();
    c.moveTo(0, -16 * s);
    c.lineTo(0, 5 * s);
    c.stroke();
    c.beginPath();
    c.moveTo(-1.3 * s, -15 * s);
    c.lineTo(0, -19 * s);
    c.lineTo(1.3 * s, -15 * s);
    c.closePath();
    c.fillStyle = GNOMON_GREY;
    c.fill();
    c.stroke();
  } else if (job === "clockworks") {
    // a brass cog
    c.beginPath();
    for (let k = 0; k < 16; k++) {
      const r = (k % 2 ? 2.2 : 3) * s, a = (k / 16) * Math.PI * 2;
      c.lineTo(Math.cos(a) * r, 1.5 * s + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = BRASS_PIN;
    c.fill();
    c.stroke();
  } else if (job === "trade") box(-2.5, -0.5, 5, 4, SAIL.shade); // a sack of goods
  else if (job === "raider") {
    // an oar from some other age
    c.beginPath();
    c.moveTo(0, -12 * s);
    c.lineTo(0, 6 * s);
    c.stroke();
    box(-1.2, 4, 2.4, 5, DRIFT.base);
  } else if (job === "hesper") {
    // the ledger: oak boards, paper edge
    box(-3.4, -1.5, 6.8, 4.6, "#72583F");
    c.fillStyle = SAIL.light;
    c.fillRect(-3 * s, 2.2 * s, 6 * s, 0.7 * s);
  }
}
const GNOMON_GREY = "#A39A8A";

/** A raider longboat, side view in iso (bow to the right), anchor at the waterline centre. */
export function drawBoat(c: Ctx, ax: number, ay: number, s: number, sail: boolean): void {
  const L = s >= 2 ? 3 : 2;
  c.lineJoin = "round";
  c.strokeStyle = INK;
  c.lineWidth = L;
  c.beginPath();
  c.moveTo(ax - 22 * s, ay - 8 * s);
  c.lineTo(ax + 24 * s, ay - 9 * s);
  c.quadraticCurveTo(ax + 18 * s, ay + 2 * s, ax + 8 * s, ay + 3 * s);
  c.lineTo(ax - 12 * s, ay + 3 * s);
  c.quadraticCurveTo(ax - 20 * s, ay, ax - 22 * s, ay - 8 * s);
  c.closePath();
  c.fillStyle = TARR.base;
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(ax - 20 * s, ay - 6 * s);
  c.lineTo(ax + 21 * s, ay - 7 * s);
  c.lineWidth = L / 2;
  c.strokeStyle = TARR.light;
  c.stroke();
  if (!sail) return;
  c.strokeStyle = INK;
  c.lineWidth = L;
  c.beginPath();
  c.moveTo(ax, ay - 8 * s);
  c.lineTo(ax, ay - 40 * s);
  c.stroke();
  c.beginPath();
  c.moveTo(ax - 13 * s, ay - 37 * s);
  c.quadraticCurveTo(ax - 2 * s, ay - 30 * s, ax - 13 * s, ay - 14 * s);
  c.lineTo(ax + 13 * s, ay - 14 * s);
  c.quadraticCurveTo(ax + 2 * s, ay - 30 * s, ax + 13 * s, ay - 37 * s);
  c.closePath();
  c.fillStyle = SAIL.shade;
  c.fill();
  c.stroke();
  c.fillStyle = TARR.light;
  c.fillRect(ax - 11 * s, ay - 28 * s, 22 * s, 4 * s);
}

/** Effects: flat painted shapes, no gradients except the soft glows (§7). */
export type Fx = "fire" | "smoke" | "glow" | "spark" | "foam" | "dust";
export const FX: Fx[] = ["fire", "smoke", "glow", "spark", "foam", "dust"];
export function drawFx(c: Ctx, w: number, h: number, fx: Fx, s: number): void {
  const cx = w / 2, cy = h / 2;
  c.lineJoin = "round";
  if (fx === "fire") {
    c.beginPath();
    c.moveTo(cx, 2 * s);
    c.bezierCurveTo(cx + 9 * s, h * 0.45, cx + 8 * s, h - 3 * s, cx, h - 2 * s);
    c.bezierCurveTo(cx - 8 * s, h - 3 * s, cx - 9 * s, h * 0.45, cx, 2 * s);
    c.fillStyle = "#E07B39";
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = s >= 2 ? 2 : 1.5;
    c.stroke();
    c.beginPath();
    c.moveTo(cx, h * 0.4);
    c.bezierCurveTo(cx + 4 * s, h * 0.65, cx + 3 * s, h - 4 * s, cx, h - 4 * s);
    c.bezierCurveTo(cx - 3 * s, h - 4 * s, cx - 4 * s, h * 0.65, cx, h * 0.4);
    c.fillStyle = "#F2C14E";
    c.fill();
  } else if (fx === "smoke" || fx === "dust") {
    c.fillStyle = fx === "smoke" ? "#ECE6DA" : "#D9C9A0";
    c.strokeStyle = "rgba(61,52,40,0.5)";
    c.lineWidth = s;
    for (const [dx, dy, r] of [[-0.18, 0.08, 0.3], [0.16, 0.1, 0.28], [0, -0.12, 0.32]] as const) {
      c.beginPath();
      c.arc(cx + dx * w, cy + dy * h, r * w, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  } else if (fx === "glow") {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    g.addColorStop(0, "rgba(255,214,140,0.9)");
    g.addColorStop(0.4, "rgba(255,190,110,0.35)");
    g.addColorStop(1, "rgba(255,170,90,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else if (fx === "spark") {
    c.fillStyle = "#F2C14E";
    c.beginPath();
    c.moveTo(cx, 0);
    c.lineTo(cx + w * 0.15, cy);
    c.lineTo(cx, h);
    c.lineTo(cx - w * 0.15, cy);
    c.closePath();
    c.fill();
  } else if (fx === "foam") {
    c.strokeStyle = FOAM;
    c.lineWidth = 2 * s;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(4 * s, cy);
    c.quadraticCurveTo(cx / 2, cy - 4 * s, cx, cy);
    c.quadraticCurveTo(cx * 1.5, cy + 4 * s, w - 4 * s, cy);
    c.stroke();
  }
}

/**
 * Grey land, baked (ART_BIBLE.md D4): desaturate 85%, cool shift, then a 45° ink hatch at 18%
 * clipped to the sprite's own pixels. Never the only signal: the HUD also shows icon and word.
 */
export function greyify(c: Ctx, w: number, h: number, s: number, amount = 0.85, hatch = 0.18): void {
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = Math.round(r + (y - r) * amount) - 6 * amount;
    d[i + 1] = Math.round(g + (y - g) * amount) - amount;
    d[i + 2] = Math.round(b + (y - b) * amount) + 8 * amount;
  }
  c.putImageData(img, 0, 0);
  c.save();
  c.globalCompositeOperation = "source-atop";
  c.strokeStyle = `rgba(61,52,40,${hatch})`;
  c.lineWidth = Math.max(1, s);
  const gap = 5 * s;
  c.beginPath();
  for (let x = -h; x < w; x += gap) {
    c.moveTo(x, h);
    c.lineTo(x + h, 0);
  }
  c.stroke();
  c.restore();
}

/** Static paper grain, tiled over everything at low alpha (§2). */
export function drawGrain(c: Ctx, size: number, seed: number): void {
  const img = c.createImageData(size, size);
  let x = seed | 1;
  for (let i = 0; i < img.data.length; i += 4) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const v = 128 + (((x >>> 0) % 64) - 32);
    img.data[i] = v;
    img.data[i + 1] = v - 4;
    img.data[i + 2] = v - 12;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}
