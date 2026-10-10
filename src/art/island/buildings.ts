/**
 * Building recipes for the Phase 1 stand-ins: Colony looks 1–2 and Village looks 1–4
 * (ART_BIBLE.md §9). Each step changes the outline with one idea. Stand-ins, not final art.
 */
import type { BType } from "../../core/rules";
import { BLUE_DOOR, BRASS_PIN, DRIFT, GNOMON, INK, INK_DIM, SAIL, STRIPE, TARR, TEAL, TEAL_DEEP, kitFor, type Era, type EraKit, type Ramp } from "./palette";
import type { Pen } from "./pen";

const GLASS = "#D8E4E0";
const BRASS: Ramp = { light: "#D8BE86", base: BRASS_PIN, shade: "#8D7449" };
const TEALR: Ramp = { light: "#7FB3B1", base: TEAL, shade: TEAL_DEEP };

/**
 * Each type's signature, drawn over every look so types read apart at phone zoom and on grey
 * land (owner feedback): brass gear = Clockworks, brass hourglass sign = Hourglass, hearth smoke
 * = homes, teal pennant = Trade Post, red pennant = Watchtower.
 */
function signature(p: Pen, type: BType, stage: number, top: number): void {
  if (type === "workshop") p.wheel(0.9, 0.55, 12, 9, BRASS, 10);
  else if (type === "bank") {
    p.post(0.86, 0.86, 2.5, 18, 1.6, DRIFT.shade);
    hourglass(p, 0.86, 0.86, 20, 6.5, BRASS.shade);
  } else if (type === "trade") p.flag(0.2, 0.25, 14 + stage * 3, 18, TEALR.base, SAIL.base);
  else if (type === "tower") p.flag(0.5, 0.5, top, 8, STRIPE.base);
}
/** Roof top (tile px) of each type's tallest look, for where the signature sits. */
const TOP: Partial<Record<BType, number[]>> = { cottage: [26, 26, 40, 40], tower: [35, 45, 64, 72] };

function plinth(p: Pen, k: EraKit): void {
  // small irregular footing, not a full-lot slab
  const r = k.name === "village" ? k.stone : k.wood;
  p.poly([p.P(0.38, 0.40, 0), p.P(0.64, 0.36, 0), p.P(0.70, 0.60, 0), p.P(0.42, 0.66, 0), p.P(0.32, 0.52, 0)], r.base, "inner");
  p.poly([p.P(0.40, 0.42, 2.2), p.P(0.62, 0.38, 2.2), p.P(0.66, 0.58, 2.2), p.P(0.44, 0.62, 2.2)], r.light, "none");
}
function hourglass(p: Pen, a: number, b: number, z: number, size: number, frame = DRIFT.shade): void {
  const [x, y] = p.P(a, b, z);
  const w = size * p.s, h = size * 1.4 * p.s;
  p.poly([[x - w, y - h], [x + w, y - h], [x, y - h / 2], [x + w, y], [x - w, y], [x, y - h / 2]], GLASS, "inner");
  p.line2([x - w * 1.2, y - h], [x + w * 1.2, y - h], 0.8, frame);
  p.line2([x - w * 1.2, y], [x + w * 1.2, y], 0.8, frame);
}
function cropRows(p: Pen, k: EraKit, tall: number, rows = 4): void {
  for (let r = 0; r < rows; r++) {
    const b = 0.2 + (r * 0.6) / (rows - 1);
    for (let a = 0.22; a <= 0.8; a += 0.14) {
      const [x, y] = p.P(a, b, 0);
      const c = p.c;
      c.beginPath();
      c.moveTo(x - 2.8 * p.s, y);
      c.lineTo(x, y - tall * p.s);
      c.lineTo(x + 2.8 * p.s, y);
      c.closePath();
      c.fillStyle = tall > 6 ? k.crop.base : k.crop.light;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = p.line / 3;
      c.stroke();
    }
  }
}
function fence(p: Pen, k: EraKit, h: number, woven: boolean, rope = false): void {
  const pts: [number, number][] = [];
  for (let t = 0.12; t <= 0.89; t += 0.155) pts.push([t, 0.88], [0.88, t]);
  for (const [a, b] of pts) p.post(a, b, 0, h, 1.9, k.wood.base);
  const rail = rope ? SAIL.shade : k.wood.light;
  for (const z of woven ? [h * 0.35, h * 0.7] : [h * 0.6]) {
    p.line2(p.P(0.12, 0.88, z), p.P(0.88, 0.88, z), woven ? 1.0 : 0.7, rail);
    p.line2(p.P(0.88, 0.88, z), p.P(0.88, 0.12, z), woven ? 1.0 : 0.7, rail);
  }
}
function chimney(p: Pen, k: EraKit, a: number, b: number, z: number, h: number): void {
  p.box(a, b, a + 0.14, b + 0.14, z, h, k.stone);
  p.diamond(a - 0.02, b - 0.02, a + 0.16, b + 0.16, z + h, k.stone.light, "inner");
}
/** Thatch grain: a few shade strokes so roofs read as straw, not a flat fill. */
function thatch(p: Pen, a0: number, b0: number, a1: number, b1: number, z: number, alongA: boolean, n = 4): void {
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (alongA) p.line2(p.P(a0 + 0.04, b0 + (b1 - b0) * t, z + 1), p.P(a1 - 0.04, b0 + (b1 - b0) * t, z + 1), 0.28, INK_DIM);
    else p.line2(p.P(a0 + (a1 - a0) * t, b0 + 0.04, z + 1), p.P(a0 + (a1 - a0) * t, b1 - 0.04, z + 1), 0.28, INK_DIM);
  }
}
function thatchDome(p: Pen, a: number, b: number, r: number, z: number, rise: number): void {
  const c = p.c;
  const [x, y] = p.P(a, b, z);
  const rx = r * 45 * p.s, ry = rise * p.s;
  c.strokeStyle = INK_DIM;
  c.lineWidth = Math.max(0.55, p.line * 0.28);
  c.lineCap = "round";
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    c.beginPath();
    c.ellipse(x, y - ry * t * 0.12, rx * (1 - t * 0.32), ry * (1 - t * 0.38), 0, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
  }
}
function thatchCone(p: Pen, a: number, b: number, r: number, z: number, rise: number): void {
  const [x, y] = p.P(a, b, z);
  const rx = r * 45 * p.s, top = y - rise * p.s;
  for (const t of [-0.42, -0.12, 0.22, 0.48]) {
    p.line2([x + rx * t, y - 1.5 * p.s], [x + rx * t * 0.12, top + 5 * p.s], 0.28, INK_DIM);
  }
}
function moss(p: Pen, k: EraKit, spots: [number, number, number][]): void {
  for (const [a, b, z] of spots) p.diamond(a, b, a + 0.1, b + 0.08, z, k.grass.shade, "none");
}
function pavers(p: Pen, k: EraKit, spots: [number, number][]): void {
  for (const [a, b] of spots) p.diamond(a, b, a + 0.11, b + 0.09, 0.2, k.stone.base, "none");
}
function crate(p: Pen, a: number, b: number, z: number): void {
  p.box(a, b, a + 0.14, b + 0.12, z, 5, DRIFT);
}
function lantern(p: Pen, a: number, b: number, z: number): void {
  const [x, y] = p.P(a, b, z);
  p.line2([x, y - 5 * p.s], [x, y - 1 * p.s], 0.4);
  p.poly([[x - 2 * p.s, y], [x + 2 * p.s, y], [x + 2 * p.s, y + 4 * p.s], [x - 2 * p.s, y + 4 * p.s]], "#F2CE7E", "inner");
}

type Recipe = (p: Pen, k: EraKit) => void;

const VILLAGE_LOOKS: Partial<Record<BType, Recipe[]>> = {
  field: [
    (p, k) => { cropRows(p, k, 3); },
    (p, k) => { cropRows(p, k, 4); fence(p, k, 6, true); },
    (p, k) => { cropRows(p, k, 9); fence(p, k, 6, true); },
    (p, k) => {
      cropRows(p, k, 10); fence(p, k, 6, true);
      const [x, y] = p.P(0.5, 0.45, 0); // the scarecrow: the only vertical
      p.line2([x, y], [x, y - 26 * p.s], 0.9, k.wood.shade);
      p.poly([[x - 5 * p.s, y - 10 * p.s], [x + 5 * p.s, y - 10 * p.s], [x + 4 * p.s, y - 20 * p.s], [x - 4 * p.s, y - 20 * p.s]], k.wood.base, "inner");
      p.line2([x - 9 * p.s, y - 18 * p.s], [x + 9 * p.s, y - 18 * p.s], 0.9, k.wood.shade);
      p.line2([x - 6 * p.s, y - 24 * p.s], [x + 6 * p.s, y - 24 * p.s], 0.7, k.roof.shade);
      p.poly([[x - 4.5 * p.s, y - 22 * p.s], [x + 4.5 * p.s, y - 22 * p.s], [x, y - 33 * p.s]], k.roof.base, "inner");
    },
  ],
  cottage: [
    (p, k) => {
      plinth(p, k);
      pavers(p, k, [[0.48, 0.72], [0.58, 0.66], [0.38, 0.70], [0.64, 0.56], [0.30, 0.54]]);
      p.cylinder(0.5, 0.5, 0.34, 2.5, 8, k.wall2);
      p.dome(0.5, 0.5, 0.42, 10.5, 16, k.roof);
      thatchDome(p, 0.5, 0.5, 0.42, 10.5, 16);
      moss(p, k, [[0.42, 0.38, 22], [0.58, 0.48, 18]]);
      p.leftPanel(0.45, 0.58, 0.79, 2.5, 7, k.wood.shade);
    },
    (p, k) => { plinth(p, k); p.box(0.18, 0.3, 0.86, 0.72, 2.5, 11, k.wall); p.hip(0.18, 0.3, 0.86, 0.72, 13.5, 13, k.roof); thatch(p, 0.2, 0.32, 0.84, 0.7, 20, true); chimney(p, k, 0.22, 0.34, 13.5, 18); moss(p, k, [[0.7, 0.4, 24]]); p.leftPanel(0.42, 0.52, 0.72, 2.5, 8, k.wood.shade); },
    (p, k) => {
      plinth(p, k); p.box(0.26, 0.26, 0.76, 0.76, 2.5, 8, k.wall); p.gable(0.26, 0.26, 0.76, 0.76, 10.5, 30, k.roof, false, 0.08);
      thatch(p, 0.28, 0.28, 0.74, 0.74, 22, false, 5);
      p.line2(p.P(0.30, 0.76, 10.5), p.P(0.51, 0.76, 40), 0.55, k.wood.shade);
      p.line2(p.P(0.72, 0.76, 10.5), p.P(0.51, 0.76, 40), 0.55, k.wood.shade);
      p.line2(p.P(0.32, 0.76, 18), p.P(0.70, 0.76, 18), 0.45, k.wood.base);
      const [x, y] = p.P(0.51, 0.76, 40); // crossed cruck ridge
      p.line2([x - 4 * p.s, y - 5 * p.s], [x + 4 * p.s, y + 3 * p.s], 0.8, k.wood.shade);
      p.line2([x + 4 * p.s, y - 5 * p.s], [x - 4 * p.s, y + 3 * p.s], 0.8, k.wood.shade);
      p.leftPanel(0.44, 0.58, 0.76, 2.5, 8, BLUE_DOOR.base); // the blue door (Village signature)
    },
    (p, k) => {
      plinth(p, k); p.box(0.24, 0.26, 0.8, 0.74, 2.5, 11, k.wall); p.box(0.2, 0.22, 0.84, 0.78, 13.5, 11, k.wall2);
      p.gable(0.2, 0.22, 0.84, 0.78, 24.5, 16, k.roof, true); thatch(p, 0.22, 0.24, 0.82, 0.76, 32, true); chimney(p, k, 0.66, 0.3, 24.5, 22);
      p.leftPanel(0.4, 0.52, 0.74, 2.5, 8.5, BLUE_DOOR.base); p.leftPanel(0.3, 0.4, 0.78, 17, 4, "#E9D9A8"); p.leftPanel(0.6, 0.7, 0.78, 17, 4, "#E9D9A8");
    },
  ],
  workshop: [
    (p, k) => { plinth(p, k); p.box(0.25, 0.4, 0.8, 0.62, 2.5, 6, k.wood); p.box(0.66, 0.42, 0.76, 0.52, 8.5, 3, k.stone); p.post(0.3, 0.6, 2.5, 6, 1.5, k.wood.shade); },
    (p, k) => {
      plinth(p, k); p.box(0.2, 0.3, 0.84, 0.74, 2.5, 3, k.wood);
      for (const [a, b] of [[0.22, 0.72], [0.82, 0.72], [0.82, 0.32]] as [number, number][]) p.post(a, b, 2.5, 14, 1.8, k.wood.base);
      p.poly([p.P(0.16, 0.76, 17), p.P(0.88, 0.76, 15), p.P(0.88, 0.26, 21), p.P(0.16, 0.26, 23)], k.roof.base); // open lean-to
      p.line2(p.P(0.22, 0.70, 17), p.P(0.82, 0.32, 21), 0.28, INK_DIM);
      p.line2(p.P(0.22, 0.56, 18), p.P(0.82, 0.44, 20), 0.28, INK_DIM);
    },
    (p, k) => { plinth(p, k); p.box(0.2, 0.3, 0.84, 0.74, 2.5, 12, k.wall2); p.gable(0.2, 0.3, 0.84, 0.74, 14.5, 12, k.roof, true); thatch(p, 0.22, 0.32, 0.82, 0.72, 20, true); p.wheel(0.86, 0.5, 14, 11, k.wood); },
    (p, k) => { plinth(p, k); p.box(0.18, 0.28, 0.84, 0.76, 2.5, 6, k.stone); p.box(0.2, 0.3, 0.82, 0.74, 8.5, 10, k.wall2); p.gable(0.2, 0.3, 0.82, 0.74, 18.5, 13, k.roof, true); thatch(p, 0.22, 0.32, 0.8, 0.72, 24, true); p.wheel(0.88, 0.5, 18, 16, k.wood, 14); chimney(p, k, 0.3, 0.35, 18.5, 18); },
  ],
  tower: [
    (p, k) => { plinth(p, k); for (const [a, b] of [[0.32, 0.32], [0.68, 0.32], [0.32, 0.68], [0.68, 0.68]] as [number, number][]) p.post(a, b, 2.5, 30, 2.4, k.wood.base); p.box(0.28, 0.28, 0.72, 0.72, 32.5, 3, k.wood); },
    (p, k) => { plinth(p, k); p.box(0.34, 0.34, 0.66, 0.66, 2.5, 34, k.wood); p.box(0.22, 0.22, 0.78, 0.78, 36.5, 3, k.wood); for (const [a, b] of [[0.24, 0.76], [0.76, 0.76], [0.76, 0.24]] as [number, number][]) p.post(a, b, 39.5, 6, 1.4, k.wood.light); },
    (p, k) => { plinth(p, k); p.box(0.32, 0.32, 0.68, 0.68, 2.5, 40, k.wall2); p.box(0.24, 0.24, 0.76, 0.76, 42.5, 6, k.wood); p.pyramid(0.2, 0.2, 0.8, 0.8, 48.5, 16, k.roof); thatchCone(p, 0.5, 0.5, 0.38, 48.5, 16); moss(p, k, [[0.48, 0.36, 58]]); },
    (p, k) => { plinth(p, k); p.cylinder(0.5, 0.5, 0.3, 2.5, 48, k.stone); p.cone(0.5, 0.5, 0.4, 50.5, 22, k.roof); thatchCone(p, 0.5, 0.5, 0.4, 50.5, 22); moss(p, k, [[0.44, 0.4, 62]]); p.leftPanel(0.5, 0.56, 0.66, 30, 6, INK); },
  ],
  bank: [
    (p, k) => { plinth(p, k); p.box(0.3, 0.3, 0.7, 0.7, 2.5, 9, k.wood); hourglass(p, 0.5, 0.5, 11.5, 5); },
    (p, k) => { plinth(p, k); p.box(0.26, 0.3, 0.74, 0.7, 2.5, 8, k.wood); for (const [a, b] of [[0.26, 0.7], [0.74, 0.7], [0.74, 0.3]] as [number, number][]) p.post(a, b, 10.5, 9, 1.4, k.wood.base); p.gable(0.24, 0.28, 0.76, 0.72, 19.5, 7, k.roof, true); hourglass(p, 0.5, 0.62, 10.5, 4); },
    (p, k) => { plinth(p, k); p.cylinder(0.5, 0.5, 0.32, 2.5, 14, k.wall); p.cone(0.5, 0.5, 0.42, 16.5, 14, k.roof); thatchCone(p, 0.5, 0.5, 0.42, 16.5, 14); hourglass(p, 0.5, 0.82, 4, 4); },
    (p, k) => { plinth(p, k); p.cylinder(0.5, 0.5, 0.36, 2.5, 16, k.stone); p.dome(0.5, 0.5, 0.42, 18.5, 16, k.roof); thatchDome(p, 0.5, 0.5, 0.42, 18.5, 16); hourglass(p, 0.5, 0.5, 36, 5); },
  ],
  lantern: [
    (p, k) => { plinth(p, k); p.pyramid(0.2, 0.25, 0.8, 0.75, 2.5, 26, STRIPE); lantern(p, 0.84, 0.7, 14); p.flag(0.5, 0.5, 26, 10, STRIPE.base, SAIL.base); },
    (p, k) => { plinth(p, k); for (const [a, b] of [[0.2, 0.75], [0.8, 0.75], [0.8, 0.25]] as [number, number][]) p.post(a, b, 2.5, 14, 1.6, k.wood.base); p.hip(0.2, 0.25, 0.8, 0.75, 16.5, 11, k.roof); lantern(p, 0.4, 0.8, 15); lantern(p, 0.84, 0.5, 15); p.flag(0.5, 0.5, 27, 10, STRIPE.base, SAIL.base); },
    (p, k) => { plinth(p, k); p.box(0.12, 0.3, 0.88, 0.7, 2.5, 12, k.wall2); p.gable(0.12, 0.3, 0.88, 0.7, 14.5, 12, k.roof, true); thatch(p, 0.14, 0.32, 0.86, 0.68, 20, true); lantern(p, 0.3, 0.74, 12); lantern(p, 0.7, 0.74, 12); p.flag(0.85, 0.5, 26, 10, STRIPE.base, SAIL.base); },
    (p, k) => { plinth(p, k); p.box(0.1, 0.28, 0.9, 0.72, 2.5, 14, k.wall); p.gable(0.1, 0.28, 0.9, 0.72, 16.5, 14, k.roof, true); thatch(p, 0.12, 0.30, 0.88, 0.70, 24, true); for (const a of [0.2, 0.4, 0.6, 0.8]) lantern(p, a, 0.78, 14); p.flag(0.88, 0.5, 30, 12, STRIPE.base, SAIL.base); },
  ],
  trade: [
    (p, k) => { plinth(p, k); p.box(0.25, 0.25, 0.55, 0.55, 2.5, 7, k.wood); crate(p, 0.52, 0.48, 2.5); crate(p, 0.58, 0.58, 2.5); p.box(0.3, 0.3, 0.5, 0.5, 9.5, 5, DRIFT); },
    (p, k) => {
      plinth(p, k); p.box(0.3, 0.3, 0.6, 0.6, 2.5, 7, k.wood);
      crate(p, 0.32, 0.62, 2.5); crate(p, 0.46, 0.68, 2.5);
      p.post(0.85, 0.85, 2.5, 13, 1.6, k.wood.base); p.post(0.85, 0.35, 2.5, 13, 1.6, k.wood.base);
      p.poly([p.P(0.3, 0.88, 15.5), p.P(0.88, 0.88, 15.5), p.P(0.88, 0.3, 17), p.P(0.3, 0.3, 19)], SAIL.base);
    },
    (p, k) => { plinth(p, k); p.box(0.16, 0.24, 0.84, 0.76, 2.5, 13, k.wood); p.gable(0.16, 0.24, 0.84, 0.76, 15.5, 11, k.roof, false); thatch(p, 0.18, 0.26, 0.82, 0.74, 20, false); p.leftPanel(0.4, 0.62, 0.76, 2.5, 9, k.wood.shade); },
    (p, k) => { plinth(p, k); p.box(0.16, 0.24, 0.84, 0.76, 2.5, 14, k.wall); p.gable(0.16, 0.24, 0.84, 0.76, 16.5, 12, k.roof, false); thatch(p, 0.18, 0.26, 0.82, 0.74, 22, false); p.box(0.7, 0.78, 0.86, 0.92, 2.5, 6, k.wood); p.flag(0.25, 0.3, 28, 16, SAIL.base); },
  ],
};

const COLONY_LOOKS: Partial<Record<BType, Recipe[]>> = {
  field: [
    (p, k) => { for (const t of [0.12, 0.88]) p.line2(p.P(0.12, t, 1), p.P(0.88, t, 1), 1.2, DRIFT.shade); cropRows(p, k, 3, 3); },
    (p, k) => { cropRows(p, k, 6, 4); fence(p, k, 6, false, true); },
  ],
  cottage: [
    (p) => { p.poly([p.P(0.36, 0.4, 0), p.P(0.62, 0.36, 0), p.P(0.66, 0.58, 0), p.P(0.4, 0.62, 0)], DRIFT.shade, "none"); p.gable(0.22, 0.25, 0.8, 0.75, 0, 18, SAIL, true, 0); p.line2(p.P(0.8, 0.5, 18), p.P(0.92, 0.5, 0), 0.4); },
    (p) => { p.box(0.22, 0.28, 0.82, 0.72, 0, 6, DRIFT); p.hip(0.18, 0.24, 0.86, 0.76, 6, 12, TARR, 0.04); p.leftPanel(0.44, 0.56, 0.72, 0, 6, SAIL.shade); },
  ],
  workshop: [
    (p) => { p.box(0.3, 0.38, 0.75, 0.64, 0, 7, DRIFT); p.box(0.36, 0.42, 0.56, 0.6, 7, 3, TARR); },
    (p) => { p.box(0.2, 0.28, 0.82, 0.74, 0, 11, DRIFT); p.gable(0.2, 0.28, 0.82, 0.74, 11, 9, SAIL, true); p.wheel(0.86, 0.52, 10, 8, DRIFT, 8); },
  ],
  tower: [
    (p) => { for (const [a, b] of [[0.36, 0.36], [0.64, 0.36], [0.36, 0.64], [0.64, 0.64]] as [number, number][]) p.post(a, b, 0, 16, 1.6, DRIFT.base); p.box(0.3, 0.3, 0.7, 0.7, 16, 2.5, DRIFT); p.post(0.5, 0.5, 18.5, 26, 1.8, DRIFT.light); p.flag(0.5, 0.5, 44, 4, SAIL.base); },
    (p) => { p.box(0.34, 0.34, 0.66, 0.66, 0, 32, DRIFT); p.cylinder(0.5, 0.5, 0.24, 32, 6, TARR); p.post(0.5, 0.5, 38, 12, 1.4, DRIFT.light); },
  ],
  bank: [
    (p) => { p.box(0.3, 0.3, 0.7, 0.7, 0, 8, DRIFT); p.line2(p.P(0.3, 0.7, 4), p.P(0.7, 0.7, 4), 0.6, TARR.base); hourglass(p, 0.5, 0.5, 8, 5); },
    (p) => { for (const [a, b] of [[0.26, 0.72], [0.74, 0.72], [0.74, 0.28]] as [number, number][]) p.post(a, b, 0, 12, 1.4, DRIFT.base); p.box(0.28, 0.32, 0.72, 0.68, 0, 6, DRIFT); p.gable(0.24, 0.28, 0.76, 0.72, 12, 8, SAIL, true); hourglass(p, 0.5, 0.6, 6, 4); },
  ],
};

/** Fallback for types without an era column yet (Town+ unlocks): a plain hall with a sign. */
function generic(p: Pen, k: EraKit, stage: number): void {
  plinth(p, k);
  p.box(0.2, 0.25, 0.8, 0.75, 2.5, 10 + stage * 2, k.wall);
  p.gable(0.2, 0.25, 0.8, 0.75, 12.5 + stage * 2, 10, k.roof, stage % 2 === 0);
}

/** Looks reached per era (level cap / 3, ART_BIBLE.md §8): Colony 2, Village 4, Town 6, City 7. */
export const LOOKS_PER_ERA: Record<Era, number> = { colony: 2, village: 4, town: 6, city: 7 };
export const ERA_TYPES: Record<Era, BType[]> = {
  colony: ["field", "cottage", "workshop", "tower", "bank"],
  village: ["field", "cottage", "workshop", "tower", "bank", "lantern", "trade"],
  town: ["field", "cottage", "workshop", "tower", "bank", "lantern", "trade", "mirror", "academy", "hospital"],
  city: ["field", "cottage", "workshop", "tower", "bank", "lantern", "trade", "mirror", "academy", "hospital", "exchange", "harbour", "observatory"],
};

/** Draws one building look. `stage` is clamped to the looks this era reaches. */
export function drawBuilding(p: Pen, era: Era, type: BType, stage: number): void {
  const k = kitFor(era);
  const book = era === "colony" ? COLONY_LOOKS : VILLAGE_LOOKS;
  const list = book[type] ?? (era === "colony" ? VILLAGE_LOOKS[type] : undefined);
  const s = Math.min(stage, (list?.length ?? 1) - 1);
  if (type !== "field") p.shadow(0.2, 0.2, 0.85, 0.85, 20);
  if (list) list[s](p, era === "colony" && !COLONY_LOOKS[type] ? kitFor("village") : k);
  else generic(p, k, s);
  const top = TOP[type]?.[s] ?? (era === "colony" && type === "cottage" ? 18 : 20);
  signature(p, type, s, era === "colony" && type === "tower" ? [44, 50][s] : top);
}

/** The gnomon: older than every era, never re-skinned. */
export function drawGnomon(p: Pen): void {
  p.diamond(0.05, 0.05, 0.95, 0.95, 0, GNOMON.light, "outer");
  p.box(0.2, 0.2, 0.8, 0.8, 0, 3, GNOMON);
  const [x, y] = p.P(0.5, 0.5, 3);
  p.poly([[x - 3 * p.s, y], [x + 3 * p.s, y], [x + 1 * p.s, y - 46 * p.s], [x - 1 * p.s, y - 46 * p.s]], GNOMON.base);
  p.poly([[x + 0.5 * p.s, y - 1], [x + 3 * p.s, y], [x + 1 * p.s, y - 46 * p.s]], GNOMON.shade, "none");
}

/** Hesper's striped tent with the hourglass sign: never re-skinned (D6). */
export function drawTent(p: Pen): void {
  p.shadow(0.15, 0.15, 0.85, 0.85, 26);
  p.poly([p.P(0.36, 0.4, 0), p.P(0.64, 0.36, 0), p.P(0.7, 0.6, 0), p.P(0.4, 0.66, 0), p.P(0.32, 0.52, 0)], DRIFT.shade, "none");
  const c = p.c;
  const [x, y] = p.P(0.5, 0.5, 0);
  const rx = 0.36 * 45 * p.s, top = y - 40 * p.s;
  for (let k = 0; k < 6; k++) {
    const a0 = -1 + (k / 6) * 2, a1 = -1 + ((k + 1) / 6) * 2;
    c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x + rx * a0, y + Math.sqrt(Math.max(0, 1 - a0 * a0)) * rx * 0.45);
    c.lineTo(x + rx * a1, y + Math.sqrt(Math.max(0, 1 - a1 * a1)) * rx * 0.45);
    c.closePath();
    c.fillStyle = k % 2 ? SAIL.base : STRIPE.base;
    if (k >= 4) c.fillStyle = k % 2 ? SAIL.shade : STRIPE.shade;
    c.fill();
  }
  p.cone(0.5, 0.5, 0.36, 0, 40, { light: "rgba(0,0,0,0)", base: "rgba(0,0,0,0)", shade: "rgba(0,0,0,0)" });
  p.poly([p.P(0.48, 0.86, 0), p.P(0.62, 0.86, 0), p.P(0.55, 0.86, 14)], TARR.base, "inner");
  p.flag(0.5, 0.5, 40, 10, STRIPE.base);
  // the hand-painted hourglass sign on a post
  p.post(0.95, 0.75, 0, 16, 1.4, DRIFT.base);
  hourglass(p, 0.95, 0.75, 17, 4.5, INK);
}
