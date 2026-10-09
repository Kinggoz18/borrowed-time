/**
 * Procedural STAND-IN art (Canvas 2D). Not final art: flat 3-step baked shading (light from the
 * upper left), ink outlines, final frame sizes. Real art replaces every frame with the same names.
 */
import type { BuildingType, Era } from "../sim/catalog";
import { footprintForLook } from "../sim/catalog";
import { CITY, DRIFT, DRIFT_SHADE, FOAM, GNOMON, GNOMON_SHADE, HESPER, INK, SAIL, TAR, TEAL, TEAL_DEEP, TOWN, BRASS_PIN, type EraPalette, type Ramp } from "./palette";

type Ctx = CanvasRenderingContext2D;

/** Drawing context for one iso frame: anchor (bottom diamond point), footprint n, scale s. */
export interface Iso {
  ctx: Ctx;
  ax: number;
  ay: number;
  n: number;
  s: number;
  line: number;
}

/** Screen point for lot-local (a, b) in tiles, (n, n) = the anchor, at height h (high-tier px). */
export function P(g: Iso, a: number, b: number, h = 0): [number, number] {
  return [g.ax + (a - b) * 64 * g.s, g.ay + (a + b - 2 * g.n) * 32 * g.s - h * g.s];
}

function poly(g: Iso, pts: [number, number][], fill: string, stroke = true): void {
  const c = g.ctx;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = INK;
    c.lineWidth = g.line;
    c.lineJoin = "round";
    c.stroke();
  }
}

export function box(g: Iso, a0: number, b0: number, a1: number, b1: number, z0: number, h: number, ramp: Ramp): void {
  const z1 = z0 + h;
  poly(g, [P(g, a0, b1, z0), P(g, a1, b1, z0), P(g, a1, b1, z1), P(g, a0, b1, z1)], ramp.base); // left face (lit side)
  poly(g, [P(g, a1, b1, z0), P(g, a1, b0, z0), P(g, a1, b0, z1), P(g, a1, b1, z1)], ramp.shade); // right face
  poly(g, [P(g, a0, b0, z1), P(g, a1, b0, z1), P(g, a1, b1, z1), P(g, a0, b1, z1)], ramp.light); // top
}

/** Windows on the two visible faces; they glow at night via separate sprites. */
function windows(g: Iso, a0: number, b0: number, a1: number, b1: number, z0: number, h: number, glass: string, rows: number): void {
  const c = g.ctx;
  c.fillStyle = glass;
  c.strokeStyle = INK;
  c.lineWidth = Math.max(1, g.line / 2);
  const cols = Math.max(1, Math.round((a1 - a0) * 3));
  for (let r = 0; r < rows; r++) {
    const z = z0 + (h * (r + 0.35)) / rows;
    const wh = Math.min(14, (h / rows) * 0.45);
    for (let k = 0; k < cols; k++) {
      const a = a0 + ((a1 - a0) * (k + 0.5)) / cols;
      const p = [P(g, a - 0.06, b1, z), P(g, a + 0.06, b1, z), P(g, a + 0.06, b1, z + wh), P(g, a - 0.06, b1, z + wh)];
      poly(g, p, glass, false);
      const q = [P(g, a1, b1 - (a - a0) - 0.06 + 0.12, z), P(g, a1, b1 - (a - a0) - 0.06, z), P(g, a1, b1 - (a - a0) - 0.06, z + wh), P(g, a1, b1 - (a - a0) + 0.06, z + wh)];
      if (b1 - (a - a0) > b0 + 0.1) poly(g, q, glass, false);
    }
  }
}

export function gable(g: Iso, a0: number, b0: number, a1: number, b1: number, z: number, rise: number, ramp: Ramp, alongA: boolean): void {
  if (alongA) {
    const bm = (b0 + b1) / 2;
    poly(g, [P(g, a0, b1, z), P(g, a1, b1, z), P(g, a1, bm, z + rise), P(g, a0, bm, z + rise)], ramp.light);
    poly(g, [P(g, a1, b1, z), P(g, a1, b0, z), P(g, a1, bm, z + rise)], ramp.shade);
  } else {
    const am = (a0 + a1) / 2;
    poly(g, [P(g, a0, b1, z), P(g, a1, b1, z), P(g, am, b1, z + rise)], ramp.base);
    poly(g, [P(g, a1, b1, z), P(g, a1, b0, z), P(g, am, b0, z + rise), P(g, am, b1, z + rise)], ramp.shade);
  }
}

export function pyramid(g: Iso, a0: number, b0: number, a1: number, b1: number, z: number, rise: number, ramp: Ramp): void {
  const apex = P(g, (a0 + a1) / 2, (b0 + b1) / 2, z + rise);
  poly(g, [P(g, a0, b1, z), P(g, a1, b1, z), apex], ramp.light);
  poly(g, [P(g, a1, b1, z), P(g, a1, b0, z), apex], ramp.shade);
}

export function dome(g: Iso, a: number, b: number, r: number, z: number, ramp: Ramp): void {
  const [x, y] = P(g, a, b, z);
  const c = g.ctx;
  const rx = r * 64 * g.s * 1.2, ry = rx * 0.9;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, Math.PI, 0);
  c.closePath();
  c.fillStyle = ramp.base;
  c.fill();
  c.beginPath();
  c.ellipse(x + rx * 0.25, y, rx * 0.75, ry, 0, Math.PI * 1.5, 0);
  c.lineTo(x + rx * 0.25, y);
  c.fillStyle = ramp.shade;
  c.fill();
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, Math.PI, 0);
  c.closePath();
  c.strokeStyle = INK;
  c.lineWidth = g.line;
  c.stroke();
}

export function cylinder(g: Iso, a: number, b: number, r: number, z0: number, h: number, ramp: Ramp): void {
  const c = g.ctx;
  const [x, y0] = P(g, a, b, z0);
  const [, y1] = P(g, a, b, z0 + h);
  const rx = r * 64 * g.s * 1.2, ry = rx * 0.5;
  c.beginPath();
  c.moveTo(x - rx, y1);
  c.lineTo(x - rx, y0);
  c.ellipse(x, y0, rx, ry, 0, Math.PI, 0, true);
  c.lineTo(x + rx, y1);
  c.closePath();
  c.fillStyle = ramp.base;
  c.fill();
  c.fillStyle = ramp.shade;
  c.fillRect(x + rx * 0.3, y1, rx * 0.7, y0 - y1 + ry * 0.7);
  c.strokeStyle = INK;
  c.lineWidth = g.line;
  c.stroke();
  c.beginPath();
  c.ellipse(x, y1, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = ramp.light;
  c.fill();
  c.stroke();
}

function cone(g: Iso, a: number, b: number, r: number, z: number, rise: number, ramp: Ramp): void {
  const c = g.ctx;
  const [x, y] = P(g, a, b, z);
  const rx = r * 64 * g.s * 1.2;
  c.beginPath();
  c.moveTo(x - rx, y);
  c.lineTo(x, y - rise * g.s);
  c.lineTo(x + rx, y);
  c.ellipse(x, y, rx, rx * 0.5, 0, 0, Math.PI);
  c.closePath();
  c.fillStyle = ramp.base;
  c.fill();
  c.beginPath();
  c.moveTo(x, y - rise * g.s);
  c.lineTo(x + rx, y);
  c.lineTo(x + rx * 0.2, y + rx * 0.45);
  c.closePath();
  c.fillStyle = ramp.shade;
  c.fill();
  c.beginPath();
  c.moveTo(x - rx, y);
  c.lineTo(x, y - rise * g.s);
  c.lineTo(x + rx, y);
  c.ellipse(x, y, rx, rx * 0.5, 0, 0, Math.PI);
  c.strokeStyle = INK;
  c.lineWidth = g.line;
  c.stroke();
}

function pennant(g: Iso, a: number, b: number, z: number, color: string): void {
  const c = g.ctx;
  const [x, y] = P(g, a, b, z);
  c.strokeStyle = INK;
  c.lineWidth = g.line * 0.6;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - 30 * g.s);
  c.stroke();
  poly(g, [[x, y - 30 * g.s], [x + 18 * g.s, y - 25 * g.s], [x, y - 20 * g.s]], color);
}

function gear(g: Iso, a: number, b: number, z: number, r: number, ramp: Ramp): void {
  const c = g.ctx;
  const [x, y] = P(g, a, b, z);
  const R = r * g.s;
  c.beginPath();
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2;
    const rr = k % 2 ? R : R * 1.25;
    c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8);
  }
  c.closePath();
  c.fillStyle = ramp.base;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = g.line * 0.7;
  c.stroke();
}

/** Lot plinth (era-uniform, so the grid reads). */
function plinth(g: Iso, ramp: Ramp): void {
  const n = g.n;
  box(g, 0.04, 0.04, n - 0.04, n - 0.04, 0, 4, ramp);
}

export function palette(era: Era): EraPalette {
  return era === "town" ? TOWN : CITY;
}

/**
 * One building look. Each look changes the outline (more mass, a new roof, a landmark prop);
 * looks 5-6 are 2x2 and look 7 is 3x3 (ART_BIBLE.md §8).
 */
export function drawBuilding(g: Iso, era: Era, type: BuildingType | "block", look: number, seed: number): void {
  const pal = palette(era);
  const n = footprintForLook(look);
  g.n = n;
  const lift = (look + 1) * 14 + (era === "city" ? 10 : 0);
  plinth(g, pal.road);
  const i0 = 0.14, i1 = n - 0.14;
  const tall = type === "block" ? 2 : 1;
  const z = 4;
  switch (type) {
    case "field": {
      poly(g, [P(g, i0, i0, z), P(g, i1, i0, z), P(g, i1, i1, z), P(g, i0, i1, z)], pal.ground.base);
      const c = g.ctx;
      c.strokeStyle = pal.accent.shade;
      c.lineWidth = g.line * 0.6;
      for (let k = 1; k < n * 5; k++) {
        const a = i0 + ((i1 - i0) * k) / (n * 5);
        const p = P(g, a, i0, z), q = P(g, a, i1, z);
        c.beginPath();
        c.moveTo(p[0], p[1]);
        c.lineTo(q[0], q[1]);
        c.stroke();
      }
      if (look >= 1) box(g, i0, i0, i0 + 0.45, i0 + 0.45, z, 26 + look * 4, pal.wall2);
      if (look >= 4) {
        box(g, i0, i0, i0 + 0.9, i0 + 0.7, z, 40, pal.wall);
        gable(g, i0, i0, i0 + 0.9, i0 + 0.7, z + 40, 30, pal.roof, true);
      }
      if (look >= 6) {
        cylinder(g, n - 0.9, 0.6, 0.35, z, 120, pal.wall2);
        const [x, y] = P(g, n - 0.9, 0.6, z + 120);
        g.ctx.strokeStyle = INK;
        g.ctx.lineWidth = g.line;
        for (let k = 0; k < 4; k++) {
          const ang = k * (Math.PI / 2) + 0.4;
          g.ctx.beginPath();
          g.ctx.moveTo(x, y);
          g.ctx.lineTo(x + Math.cos(ang) * 60 * g.s, y + Math.sin(ang) * 60 * g.s);
          g.ctx.stroke();
        }
      }
      return;
    }
    case "watchtower": {
      const w = n === 1 ? 0.32 : 0.5;
      const cA = n / 2, h = n === 1 ? 40 + look * 12 : 70 + look * 22;
      box(g, cA - w, cA - w, cA + w, cA + w, z, h, pal.wall2);
      windows(g, cA - w, cA - w, cA + w, cA + w, z, h, pal.glass, 2 + Math.floor(look / 2));
      if (look >= 5) {
        box(g, i0, i0, i0 + 0.7, i0 + 0.7, z, 60, pal.wall);
        box(g, i1 - 0.7, i1 - 0.7, i1, i1, z, 50, pal.wall);
      }
      if (look % 2 === 0) pyramid(g, cA - w - 0.06, cA - w - 0.06, cA + w + 0.06, cA + w + 0.06, z + h, 40 + look * 6, pal.roof);
      else cone(g, cA, cA, w + 0.1, z + h, 50 + look * 6, pal.roof2);
      return;
    }
    case "hourglass":
    case "observatory":
    case "academy": {
      const c = n / 2;
      box(g, i0, i0, i1, i1, z, 30 + look * 6, pal.wall);
      windows(g, i0, i0, i1, i1, z, 30 + look * 6, pal.glass, 1 + (look > 4 ? 1 : 0));
      const top = z + 30 + look * 6;
      if (type === "academy") {
        cylinder(g, c, c, n * 0.3, top, 20 + look * 4, pal.wall2);
        dome(g, c, c, n * 0.3, top + 20 + look * 4, pal.roof2);
      } else {
        cylinder(g, c, c, n * 0.32, top, 24, pal.wall2);
        dome(g, c, c, n * 0.32, top + 24, type === "observatory" ? pal.roof : pal.accent);
        if (type === "observatory") {
          const [x, y] = P(g, c, c, top + 24 + 30);
          g.ctx.strokeStyle = INK;
          g.ctx.lineWidth = g.line * 2;
          g.ctx.beginPath();
          g.ctx.moveTo(x, y);
          g.ctx.lineTo(x + 40 * g.s, y - 30 * g.s);
          g.ctx.stroke();
        }
      }
      return;
    }
    case "harbour": {
      poly(g, [P(g, 0.1, n * 0.55, z), P(g, n - 0.1, n * 0.55, z), P(g, n - 0.1, n - 0.1, z), P(g, 0.1, n - 0.1, z)], DRIFT);
      box(g, i0, i0, n * 0.6, n * 0.5, z, 40 + look * 6, pal.wall);
      gable(g, i0, i0, n * 0.6, n * 0.5, z + 40 + look * 6, 26, pal.roof, true);
      cylinder(g, n * 0.8, n * 0.25, 0.22, z, 90 + look * 14, pal.wall2);
      cone(g, n * 0.8, n * 0.25, 0.26, z + 90 + look * 14, 30, pal.roof);
      return;
    }
    case "exchange": {
      box(g, i0, i0, i1, i1, z, 8, pal.wall2);
      const cols = 2 + n * 2;
      for (let k = 0; k < cols; k++) {
        const a = i0 + 0.1 + ((i1 - i0 - 0.2) * k) / (cols - 1);
        box(g, a - 0.04, i1 - 0.2, a + 0.04, i1 - 0.12, z + 8, 40 + look * 8, pal.wall2);
      }
      box(g, i0, i0, i1, i1 - 0.25, z + 8, 40 + look * 8, pal.wall);
      gable(g, i0, i0, i1, i1, z + 48 + look * 8, 26 + n * 6, pal.roof2, true);
      return;
    }
    default: {
      // Cottage, block, clockworks, lantern hall, trade post, sun mirror, hospital: masses + roofs.
      const masses = n === 1 ? 1 : n === 2 ? 3 : 5;
      const spots: [number, number, number, number][] = [];
      if (masses === 1) spots.push([i0, i0, i1, i1]);
      else {
        const half = n / 2;
        spots.push([i0, i0, half - 0.05, half - 0.05], [half + 0.05, i0, i1, half - 0.05], [i0, half + 0.05, i1, i1]);
        if (masses === 5) spots.splice(2, 1, [i0, half + 0.05, half - 0.05, i1], [half + 0.05, half + 0.05, i1, i1]);
      }
      const wide = type === "clockworks" || type === "lanternHall" || type === "tradePost" || type === "hospital";
      spots.forEach(([a0, b0, a1, b1], k) => {
        const h = (wide ? 26 : 34) * tall + lift * (wide ? 0.7 : 1) + ((seed + k) % 3) * 6;
        const ramp = k % 2 ? pal.wall2 : pal.wall;
        box(g, a0, b0, a1, b1, z, h, ramp);
        windows(g, a0, b0, a1, b1, z, h, pal.glass, Math.max(1, Math.floor(h / 34)));
        const rise = (wide ? 18 : 30) + look * 3;
        if (type === "clockworks" && k === 0) {
          box(g, a1 - 0.25, b0 + 0.05, a1 - 0.08, b0 + 0.22, z + h, 30 + look * 8, pal.wall2);
          box(g, a0 + 0.1, b0 + 0.05, a0 + 0.27, b0 + 0.22, z + h, 20 + look * 8, pal.wall2);
          gear(g, (a0 + a1) / 2, b1, z + h * 0.5, 12 + look * 2, pal.accent);
        } else if ((k + look) % 3 === 0) pyramid(g, a0, b0, a1, b1, z + h, rise, pal.roof);
        else gable(g, a0, b0, a1, b1, z + h, rise, (k + seed) % 2 ? pal.roof : pal.roof2, (k + look) % 2 === 0);
        if ((type === "cottage" || type === "block") && look >= 2) box(g, a1 - 0.2, b0 + 0.1, a1 - 0.08, b0 + 0.22, z + h, rise + 10, pal.wall2);
      });
      if (type === "lanternHall" || type === "sunMirror") pennant(g, i0 + 0.15, i0 + 0.15, z + 80 + lift, HESPER);
      if (type === "sunMirror") {
        const [x, y] = P(g, n / 2, n / 2, z + 110 + lift);
        g.ctx.beginPath();
        g.ctx.ellipse(x, y, 20 * g.s * n, 26 * g.s * n, -0.3, 0, Math.PI * 2);
        g.ctx.fillStyle = pal.glass;
        g.ctx.fill();
        g.ctx.strokeStyle = INK;
        g.ctx.lineWidth = g.line;
        g.ctx.stroke();
      }
      if (type === "tradePost") for (let k = 0; k < 3; k++) box(g, i1 - 0.3 - k * 0.12, i1 - 0.3, i1 - 0.2 - k * 0.12, i1 - 0.15, z, 10, { light: SAIL, base: DRIFT, shade: DRIFT_SHADE });
      return;
    }
  }
}

export function drawGround(g: Iso, kind: string, era: Era): void {
  const pal = palette(era);
  g.n = 1;
  const ramp =
    kind === "road" ? pal.road : kind === "plaza" ? { light: GNOMON, base: GNOMON, shade: GNOMON_SHADE } : kind === "shore" ? { light: FOAM, base: "#D9CBA8", shade: "#BBA982" } : kind === "sand" ? { light: SAIL, base: "#D9CBA8", shade: "#BBA982" } : kind === "farm" ? pal.accent : pal.ground;
  const fill = kind.startsWith("grass") ? [pal.ground.base, pal.ground.light, pal.ground.shade, "#8F9670"][Number(kind.slice(5)) || 0] : ramp.base;
  poly(g, [P(g, 0, 0), P(g, 1, 0), P(g, 1, 1), P(g, 0, 1)], fill, false);
  const c = g.ctx;
  c.strokeStyle = ramp.shade;
  c.lineWidth = Math.max(1, g.line / 3);
  c.globalAlpha = 0.6;
  c.beginPath();
  const a = P(g, 0, 1), b = P(g, 1, 1), d = P(g, 1, 0);
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.lineTo(d[0], d[1]);
  c.stroke();
  if (kind === "farm" || kind === "road") {
    for (let k = 1; k < 5; k++) {
      const p = P(g, k / 5, 0.05), q = P(g, k / 5, 0.95);
      c.beginPath();
      c.moveTo(p[0], p[1]);
      c.lineTo(q[0], q[1]);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

export function drawWall(g: Iso, stage: number, piece: string, era: Era): void {
  const pal = palette(era);
  g.n = 1;
  const h = 26 + stage * 10;
  const ramp = stage >= 4 ? pal.wall2 : { light: "#A8967E", base: DRIFT, shade: DRIFT_SHADE };
  const t = 0.16;
  if (piece === "corner") {
    box(g, 0.25, 0.25, 0.75, 0.75, 0, h + 26, ramp);
    if (stage >= 5) cone(g, 0.5, 0.5, 0.32, h + 26, 40, pal.roof);
    return;
  }
  const alongI = piece.endsWith("I");
  const gate = piece.startsWith("gate");
  const seg = (a0: number, a1: number) => (alongI ? box(g, a0, 0.5 - t, a1, 0.5 + t, 0, h, ramp) : box(g, 0.5 - t, a0, 0.5 + t, a1, 0, h, ramp));
  if (gate) {
    seg(0, 0.3);
    seg(0.7, 1);
    if (alongI) box(g, 0.25, 0.5 - t, 0.75, 0.5 + t, h - 10, 24, ramp);
    else box(g, 0.5 - t, 0.25, 0.5 + t, 0.75, h - 10, 24, ramp);
    if (stage >= 6) pennant(g, 0.5, 0.5, h + 14, TEAL_DEEP);
  } else seg(0, 1);
  if (stage >= 3) {
    // Crenellations / walk.
    for (let k = 0; k < 4; k++) {
      const a = 0.1 + k * 0.25;
      if (alongI) box(g, a, 0.5 - t, a + 0.1, 0.5 + t, h, 8, ramp);
      else box(g, 0.5 - t, a, 0.5 + t, a + 0.1, h, 8, ramp);
    }
  }
}

export function drawProp(g: Iso, kind: string, era: Era): void {
  const pal = palette(era);
  g.n = 1;
  switch (kind) {
    case "farm":
      drawGround(g, "farm", era);
      return;
    case "hut":
      box(g, 0.25, 0.25, 0.75, 0.75, 0, 26, pal.wall2);
      gable(g, 0.25, 0.25, 0.75, 0.75, 26, 22, pal.roof, true);
      return;
    case "windmill":
      cylinder(g, 0.5, 0.5, 0.25, 0, 70, pal.wall2);
      cone(g, 0.5, 0.5, 0.28, 70, 20, pal.roof);
      return;
    case "tree": {
      const [x, y] = P(g, 0.5, 0.5, 0);
      g.ctx.fillStyle = DRIFT_SHADE;
      g.ctx.fillRect(x - 3 * g.s, y - 24 * g.s, 6 * g.s, 24 * g.s);
      g.ctx.beginPath();
      g.ctx.ellipse(x, y - 44 * g.s, 26 * g.s, 30 * g.s, 0, 0, Math.PI * 2);
      g.ctx.fillStyle = "#6F7F55";
      g.ctx.fill();
      g.ctx.strokeStyle = INK;
      g.ctx.lineWidth = g.line;
      g.ctx.stroke();
      return;
    }
    case "pier":
      box(g, 0.3, 0, 0.7, 1, 0, 6, { light: "#A8967E", base: DRIFT, shade: DRIFT_SHADE });
      return;
    default:
      box(g, 0.3, 0.3, 0.55, 0.55, 0, 16, { light: SAIL, base: DRIFT, shade: DRIFT_SHADE });
      box(g, 0.55, 0.4, 0.75, 0.6, 0, 12, { light: SAIL, base: DRIFT, shade: DRIFT_SHADE });
  }
}

export function drawTent(g: Iso): void {
  g.n = 2;
  const [x, y] = P(g, 1, 1, 0);
  const c = g.ctx;
  const R = 90 * g.s, H = 200 * g.s;
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI, a1 = ((k + 1) / 8) * Math.PI;
    c.beginPath();
    c.moveTo(x, y - H);
    c.lineTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R * 0.45);
    c.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R * 0.45);
    c.closePath();
    c.fillStyle = k % 2 ? HESPER : SAIL;
    c.fill();
  }
  c.beginPath();
  c.moveTo(x - R, y);
  c.lineTo(x, y - H);
  c.lineTo(x + R, y);
  c.ellipse(x, y, R, R * 0.45, 0, 0, Math.PI);
  c.strokeStyle = INK;
  c.lineWidth = g.line;
  c.stroke();
}

export function drawGnomon(g: Iso): void {
  g.n = 2;
  const c = g.ctx;
  const [x, y] = P(g, 1, 1, 0);
  c.beginPath();
  c.ellipse(x, y, 110 * g.s, 52 * g.s, 0, 0, Math.PI * 2);
  c.fillStyle = GNOMON;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = g.line;
  c.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * 80 * g.s, y + Math.sin(a) * 38 * g.s);
    c.lineTo(x + Math.cos(a) * 100 * g.s, y + Math.sin(a) * 47 * g.s);
    c.stroke();
  }
  poly(g, [[x - 10 * g.s, y], [x, y - 230 * g.s], [x + 10 * g.s, y]], GNOMON_SHADE);
}

export function drawPart(ctx: Ctx, w: number, h: number, costume: string, part: string, s: number, line: number): void {
  const fill: Record<string, string> = { field: "#7E8F55", clockworks: "#72583F", trade: "#BD9D68", watch: DRIFT, raider: TAR, hesper: "#3A3236" };
  const skin = costume === "raider" ? "#4A4440" : "#D9B48F";
  ctx.lineWidth = line * 0.5;
  ctx.strokeStyle = INK;
  const cw = w * s, ch = h * s;
  ctx.fillStyle = part === "head" ? skin : part === "prop" ? DRIFT : fill[costume];
  ctx.beginPath();
  if (part === "head") ctx.ellipse(cw / 2, ch / 2, cw / 2 - line, ch / 2 - line, 0, 0, Math.PI * 2);
  else ctx.roundRect(line, line, cw - line * 2, ch - line * 2, 3 * s);
  ctx.fill();
  ctx.stroke();
  if (costume === "hesper" && part === "torso") {
    ctx.fillStyle = HESPER;
    ctx.fillRect(line, ch * 0.4, cw - line * 2, ch * 0.15);
  }
  if (part !== "prop") {
    // Brass split-pin at the joint: the puppet's tell.
    ctx.fillStyle = BRASS_PIN;
    ctx.beginPath();
    ctx.arc(cw / 2, part === "head" ? ch - 2 * s : 3 * s, Math.max(1.2, 2 * s), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

export function drawBaked(ctx: Ctx, costume: string, frame: number, s: number, line: number): void {
  const fill: Record<string, string> = { field: "#7E8F55", clockworks: "#72583F", trade: "#BD9D68", watch: DRIFT, raider: TAR, hesper: "#3A3236" };
  const skin = costume === "raider" ? "#4A4440" : "#D9B48F";
  ctx.save();
  ctx.scale(s, s);
  ctx.lineWidth = line / s / 2;
  ctx.strokeStyle = INK;
  const step = frame ? 3 : -3;
  ctx.fillStyle = fill[costume];
  ctx.fillRect(16 - 5 + step, 34, 4, 15);
  ctx.fillRect(16 + 1 - step, 34, 4, 15);
  ctx.beginPath();
  ctx.roundRect(9, 18, 14, 18, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(16, 12, 7, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = BRASS_PIN;
  ctx.beginPath();
  ctx.arc(16, 19, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBoat(ctx: Ctx, s: number, line: number): void {
  ctx.save();
  ctx.scale(s, s);
  ctx.lineWidth = line / s;
  ctx.strokeStyle = INK;
  ctx.fillStyle = TAR;
  ctx.beginPath();
  ctx.moveTo(10, 70);
  ctx.lineTo(150, 70);
  ctx.lineTo(130, 92);
  ctx.lineTo(30, 92);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6E6A66";
  ctx.beginPath();
  ctx.moveTo(80, 10);
  ctx.lineTo(80, 66);
  ctx.lineTo(130, 62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawFx(ctx: Ctx, name: string, w: number, h: number): void {
  const cw = w, ch = h;
  if (name.startsWith("fx/fire") || name === "fx/glow" || name === "fx/window" || name === "fx/spark") {
    const warm = name === "fx/window" ? "255,214,140" : name === "fx/spark" ? "255,240,200" : name === "fx/glow" ? "255,220,160" : "255,150,60";
    const gr = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.min(cw, ch) / 2);
    gr.addColorStop(0, `rgba(${warm},1)`);
    gr.addColorStop(name.startsWith("fx/fire") ? 0.35 : 0.2, `rgba(${warm},0.6)`);
    gr.addColorStop(1, `rgba(${warm},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cw, ch);
    return;
  }
  if (name.startsWith("fx/smoke")) {
    ctx.fillStyle = "rgba(236,230,218,0.9)";
    ctx.beginPath();
    ctx.ellipse(cw / 2, ch / 2, cw / 2.4, ch / 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (name === "fx/arrow") {
    ctx.fillStyle = INK;
    ctx.fillRect(2, ch / 2 - 1, cw - 4, 2);
    return;
  }
  if (name === "fx/ring") {
    ctx.strokeStyle = "rgba(255,230,170,1)";
    ctx.lineWidth = Math.max(2, cw / 40);
    ctx.beginPath();
    ctx.ellipse(cw / 2, ch / 2, cw / 2 - ctx.lineWidth, ch / 2 - ctx.lineWidth, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (name === "fx/vignette") {
    const gr = ctx.createRadialGradient(cw / 2, ch / 2, cw * 0.3, cw / 2, ch / 2, cw * 0.72);
    gr.addColorStop(0, "rgba(61,52,40,0)");
    gr.addColorStop(1, "rgba(61,52,40,0.3)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cw, ch);
    return;
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cw, ch);
}

/** The paper grain tile: warm fibres, drawn once, composited as a static multiply overlay. */
export function drawGrain(ctx: Ctx, size: number, seed: number): void {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  for (let k = 0; k < size * 3; k++) {
    ctx.strokeStyle = `rgba(122,106,85,${0.06 + rnd() * 0.08})`;
    ctx.lineWidth = 0.6 + rnd();
    const x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI, l = 3 + rnd() * 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

export { TEAL, TEAL_DEEP };
