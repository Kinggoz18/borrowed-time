/**
 * Ground, ring, people, boats and effects for the island stand-ins (ART_BIBLE.md §2, §4, §5, §9).
 * Same rules as the buildings: 2:1 iso, ink outlines, baked 3-step light from the upper left.
 */
import { BRASS_PIN, DRIFT, FOAM, HESPER, INK, SAIL, STRIPE, TARR, TEAL, TEAL_DEEP, kitFor, type Era, type Ramp } from "./palette";
import type { Ctx, Pen } from "./pen";

export type GroundKind = "grass" | "lot" | "sand" | "road";
export const GROUND_KINDS: GroundKind[] = ["grass", "lot", "sand", "road"];
export const GROUND_VARIANTS = 3;

/** Small deterministic hash for scatter detail. */
const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** One ground tile. Ground tiles have no outer line (they tile); detail strokes use the inner weight. */
export function drawGround(p: Pen, era: Era, kind: GroundKind, v: number): void {
  const k = kitFor(era);
  const base: Record<GroundKind, Ramp> = { grass: k.grass, lot: k.ground, sand: SAND, road: ROAD };
  const r = base[kind];
  p.diamond(0, 0, 1, 1, 0, r.base, "none");
  // the edge toward the light is a step lighter, the front edges a step darker: a soft bevel
  p.poly([p.P(0, 0), p.P(1, 0), p.P(0.94, 0.06), p.P(0.06, 0.06)], r.light, "none");
  p.poly([p.P(1, 1), p.P(1, 0), p.P(0.94, 0.06), p.P(0.94, 0.94)], r.shade, "none");
  const c = p.c;
  for (let n = 0; n < 7; n++) {
    const a = 0.15 + 0.7 * hash(v * 13 + n, kind.length), b = 0.15 + 0.7 * hash(n * 7 + 3, v + 11);
    const [x, y] = p.P(a, b);
    c.strokeStyle = kind === "grass" ? r.shade : r.light;
    c.lineWidth = p.line / 2;
    c.lineCap = "round";
    c.beginPath();
    if (kind === "grass") {
      c.moveTo(x - 2 * p.s, y);
      c.lineTo(x - 1 * p.s, y - 3 * p.s);
      c.moveTo(x + 1 * p.s, y);
      c.lineTo(x + 2 * p.s, y - 3 * p.s);
    } else if (kind === "lot") {
      // furrows of worked earth along the a axis
      const [x2, y2] = p.P(a + 0.12, b);
      c.moveTo(x, y);
      c.lineTo(x2, y2);
    } else {
      c.arc(x, y, 0.8 * p.s, 0, Math.PI * 2);
    }
    c.stroke();
  }
  if (kind === "lot") {
    // the stake-and-string border that says "this is a building lot"
    p.poly([p.P(0.08, 0.08), p.P(0.92, 0.08), p.P(0.92, 0.92), p.P(0.08, 0.92)], null, "inner");
    for (const [a, b] of [[0.08, 0.08], [0.92, 0.08], [0.92, 0.92], [0.08, 0.92]] as const) p.post(a, b, 0, 4, 0.8, DRIFT.base);
  }
  if (kind === "road") {
    for (let n = 0; n < 5; n++) {
      const a = 0.2 + 0.6 * hash(n + 40, v), b = 0.2 + 0.6 * hash(v + 9, n + 2);
      p.diamond(a, b, a + 0.08, b + 0.08, 0, ROAD.light, "inner");
    }
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
const TUNIC: Record<Job, Ramp> = {
  field: { light: "#D9BF7C", base: "#BD9D68", shade: "#8F754F" },
  clockworks: { light: "#D8BE86", base: BRASS_PIN, shade: "#8D7449" },
  trade: { light: "#7FB3B1", base: TEAL, shade: TEAL_DEEP },
  watch: { light: "#B8806A", base: "#97604B", shade: "#6B4334" },
  raider: TARR,
  hesper: STRIPE,
};
/**
 * A villager figure, about 18 px tall at s = 1: anchor is the feet. Frame 0/1 are the two steps
 * of the walk. Readable silhouette first: head, tunic, a tool for the job.
 */
export function drawPerson(c: Ctx, ax: number, ay: number, s: number, job: Job, frame: number): void {
  const L = s >= 2 ? 2 : 1.5;
  const t = TUNIC[job];
  c.lineJoin = "round";
  c.lineCap = "round";
  c.strokeStyle = INK;
  const step = frame ? 1.6 : -1.6;
  // legs
  c.lineWidth = 2.2 * s;
  c.beginPath();
  c.moveTo(ax - 1.5 * s, ay - 6 * s);
  c.lineTo(ax - 1.5 * s + step * s, ay);
  c.moveTo(ax + 1.5 * s, ay - 6 * s);
  c.lineTo(ax + 1.5 * s - step * s, ay);
  c.stroke();
  // body: tunic or cloak
  const cloak = job === "raider" || job === "hesper";
  c.beginPath();
  c.moveTo(ax - (cloak ? 5 : 4) * s, ay - (cloak ? 2 : 5) * s);
  c.lineTo(ax - 3 * s, ay - 13 * s);
  c.lineTo(ax + 3 * s, ay - 13 * s);
  c.lineTo(ax + (cloak ? 5 : 4) * s, ay - (cloak ? 2 : 5) * s);
  c.closePath();
  c.fillStyle = t.base;
  c.fill();
  c.lineWidth = L;
  c.stroke();
  c.beginPath();
  c.moveTo(ax + 0.5 * s, ay - 12.5 * s);
  c.lineTo(ax + 3 * s, ay - 12.5 * s);
  c.lineTo(ax + (cloak ? 4.5 : 3.6) * s, ay - (cloak ? 2.5 : 5.5) * s);
  c.lineTo(ax + 0.5 * s, ay - (cloak ? 2.5 : 5.5) * s);
  c.closePath();
  c.fillStyle = t.shade;
  c.fill();
  // head (hood for raiders)
  c.beginPath();
  c.arc(ax, ay - 15.5 * s, 2.6 * s, 0, Math.PI * 2);
  c.fillStyle = job === "raider" ? TARR.base : "#E2B98F";
  c.fill();
  c.lineWidth = L;
  c.stroke();
  if (job === "hesper") {
    c.beginPath();
    c.moveTo(ax - 4 * s, ay - 16 * s);
    c.lineTo(ax + 4 * s, ay - 16 * s);
    c.lineTo(ax, ay - 22 * s);
    c.closePath();
    c.fillStyle = HESPER;
    c.fill();
    c.stroke();
  }
  // the tool
  c.lineWidth = 1.4 * s;
  c.beginPath();
  if (job === "field") {
    c.moveTo(ax + 4 * s, ay - 2 * s);
    c.lineTo(ax + 5 * s, ay - 16 * s);
    c.lineTo(ax + 8 * s, ay - 15 * s);
  } else if (job === "watch") {
    c.moveTo(ax + 4.5 * s, ay);
    c.lineTo(ax + 4.5 * s, ay - 20 * s);
  } else if (job === "raider") {
    c.moveTo(ax + 3 * s, ay - 8 * s);
    c.lineTo(ax + 8 * s, ay - 14 * s);
  } else if (job === "clockworks") {
    c.arc(ax + 5 * s, ay - 8 * s, 1.8 * s, 0, Math.PI * 2);
  } else if (job === "trade") {
    c.rect(ax + 3 * s, ay - 9 * s, 4 * s, 4 * s);
  }
  c.stroke();
}

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
