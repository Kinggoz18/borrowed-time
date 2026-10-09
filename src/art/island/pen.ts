/**
 * Drawing primitives for the stand-in sprites (Canvas 2D). Isometric 2:1, one light from the upper
 * left baked in as flat 3-step shading: tops get the light step, left faces the base, right faces
 * the shade (ART_BIBLE.md §5). Outlines in ink, two weights only (§2), with a slight brush wobble.
 */
import { INK, type Ramp } from "./palette";

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

export class Pen {
  /** outer line width in canvas px; interior is half. */
  readonly line: number;
  private wob = 0;
  constructor(
    readonly c: Ctx,
    /** anchor: the bottom (front) point of the lot diamond, in canvas px */
    readonly ax: number,
    readonly ay: number,
    /** scale: 1 = the 64×32 tile (low tier), 2 = 128×64 (high tier) */
    readonly s: number,
    seed = 1,
  ) {
    this.line = s >= 2 ? 3 : 2;
    this.wob = seed;
  }
  /** Lot-local point: (0,0) back corner, (1,1) front corner, h in tile px (at s = 1). */
  P(a: number, b: number, h = 0): Pt {
    return [this.ax + (a - b) * 32 * this.s, this.ay + (a + b - 2) * 16 * this.s - h * this.s];
  }
  private jitter(): number {
    // deterministic ±0.5 px brush wobble (§2), never random
    this.wob = (this.wob * 1103515245 + 12345) & 0x7fffffff;
    return ((this.wob / 0x7fffffff) - 0.5) * 0.5 * (this.s / 2 + 0.5);
  }
  poly(pts: Pt[], fill: string | null, stroke: "outer" | "inner" | "none" = "outer"): void {
    const c = this.c;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x + this.jitter(), y + this.jitter()) : c.moveTo(x, y)));
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke !== "none") {
      c.strokeStyle = INK;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.lineWidth = stroke === "outer" ? this.line : this.line / 2;
      c.stroke();
    }
  }
  line2(p: Pt, q: Pt, w = 0.5, color = INK): void {
    const c = this.c;
    c.beginPath();
    c.moveTo(p[0], p[1]);
    c.lineTo(q[0] + this.jitter(), q[1] + this.jitter());
    c.strokeStyle = color;
    c.lineCap = "round";
    c.lineWidth = this.line * w;
    c.stroke();
  }
  /** Flat diamond on the ground (or at height h). */
  diamond(a0: number, b0: number, a1: number, b1: number, h: number, fill: string, stroke: "outer" | "inner" | "none" = "inner"): void {
    this.poly([this.P(a0, b0, h), this.P(a1, b0, h), this.P(a1, b1, h), this.P(a0, b1, h)], fill, stroke);
  }
  /** Soft cast shadow: a flat ink shape at 20%, offset down-right, never blurred. */
  shadow(a0: number, b0: number, a1: number, b1: number, h: number): void {
    const c = this.c;
    c.save();
    c.globalAlpha = 0.2;
    const d = Math.min(0.5, h / 60);
    this.poly([this.P(a0, b1, 0), this.P(a1, b1, 0), this.P(a1 + d, b1 - d * 0.2, 0), this.P(a1 + d, b0 - d * 0.2, 0), this.P(a1, b0, 0)], INK, "none");
    c.restore();
  }
  box(a0: number, b0: number, a1: number, b1: number, z0: number, h: number, ramp: Ramp): void {
    const z1 = z0 + h;
    this.poly([this.P(a0, b1, z0), this.P(a1, b1, z0), this.P(a1, b1, z1), this.P(a0, b1, z1)], ramp.base);
    this.poly([this.P(a1, b1, z0), this.P(a1, b0, z0), this.P(a1, b0, z1), this.P(a1, b1, z1)], ramp.shade);
    this.poly([this.P(a0, b0, z1), this.P(a1, b0, z1), this.P(a1, b1, z1), this.P(a0, b1, z1)], ramp.light);
  }
  /** Gable roof. alongA: ridge runs along a (left-right on screen's left face). */
  gable(a0: number, b0: number, a1: number, b1: number, z: number, rise: number, ramp: Ramp, alongA: boolean, eave = 0.06): void {
    a0 -= eave; b0 -= eave; a1 += eave; b1 += eave;
    if (alongA) {
      const bm = (b0 + b1) / 2;
      this.poly([this.P(a1, b0, z), this.P(a1, b1, z), this.P(a1, bm, z + rise)], ramp.shade);
      this.poly([this.P(a0, b1, z), this.P(a1, b1, z), this.P(a1, bm, z + rise), this.P(a0, bm, z + rise)], ramp.light);
    } else {
      const am = (a0 + a1) / 2;
      this.poly([this.P(a0, b1, z), this.P(a1, b1, z), this.P(am, b1, z + rise)], ramp.base);
      this.poly([this.P(a1, b1, z), this.P(a1, b0, z), this.P(am, b0, z + rise), this.P(am, b1, z + rise)], ramp.light);
    }
  }
  /** Hipped roof (four slopes, short ridge). */
  hip(a0: number, b0: number, a1: number, b1: number, z: number, rise: number, ramp: Ramp, eave = 0.06): void {
    a0 -= eave; b0 -= eave; a1 += eave; b1 += eave;
    const bm = (b0 + b1) / 2, ia = (a1 - a0) * 0.28;
    const r0 = this.P(a0 + ia, bm, z + rise), r1 = this.P(a1 - ia, bm, z + rise);
    this.poly([this.P(a0, b1, z), this.P(a1, b1, z), r1, r0], ramp.light);
    this.poly([this.P(a1, b1, z), this.P(a1, b0, z), r1], ramp.shade);
  }
  pyramid(a0: number, b0: number, a1: number, b1: number, z: number, rise: number, ramp: Ramp): void {
    const apex = this.P((a0 + a1) / 2, (b0 + b1) / 2, z + rise);
    this.poly([this.P(a0, b1, z), this.P(a1, b1, z), apex], ramp.base);
    this.poly([this.P(a1, b1, z), this.P(a1, b0, z), apex], ramp.shade);
  }
  /** Upright cylinder centred at (a,b), radius r in tiles. */
  cylinder(a: number, b: number, r: number, z0: number, h: number, ramp: Ramp): void {
    const c = this.c;
    const [x, y0] = this.P(a, b, z0);
    const y1 = y0 - h * this.s;
    const rx = r * 45 * this.s, ry = rx * 0.5;
    c.beginPath();
    c.moveTo(x - rx, y1);
    c.lineTo(x - rx, y0);
    c.ellipse(x, y0, rx, ry, 0, Math.PI, 0, true);
    c.lineTo(x + rx, y1);
    c.closePath();
    c.fillStyle = ramp.base;
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = ramp.shade;
    c.fillRect(x + rx * 0.25, y1 - ry, rx, y0 - y1 + ry * 2);
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = this.line;
    c.stroke();
    c.beginPath();
    c.ellipse(x, y1, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = ramp.light;
    c.fill();
    c.stroke();
  }
  /** Cone roof (round hut, round tower). */
  cone(a: number, b: number, r: number, z: number, rise: number, ramp: Ramp): void {
    const c = this.c;
    const [x, y] = this.P(a, b, z);
    const rx = r * 45 * this.s, top = y - rise * this.s;
    c.beginPath();
    c.moveTo(x - rx, y);
    c.lineTo(x, top);
    c.lineTo(x + rx, y);
    c.ellipse(x, y, rx, rx * 0.5, 0, 0, Math.PI);
    c.closePath();
    c.fillStyle = ramp.light;
    c.fill();
    c.save();
    c.clip();
    c.beginPath();
    c.moveTo(x + rx * 0.1, top);
    c.lineTo(x + rx * 1.2, y);
    c.lineTo(x + rx * 0.2, y + rx);
    c.closePath();
    c.fillStyle = ramp.shade;
    c.fill();
    c.restore();
    c.beginPath();
    c.moveTo(x - rx, y);
    c.lineTo(x, top);
    c.lineTo(x + rx, y);
    c.ellipse(x, y, rx, rx * 0.5, 0, 0, Math.PI);
    c.closePath();
    c.strokeStyle = INK;
    c.lineWidth = this.line;
    c.stroke();
  }
  /** Low thatch dome (the round wattle hut). */
  dome(a: number, b: number, r: number, z: number, rise: number, ramp: Ramp): void {
    const c = this.c;
    const [x, y] = this.P(a, b, z);
    const rx = r * 45 * this.s, ry = rise * this.s;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, Math.PI, 0);
    c.ellipse(x, y, rx, rx * 0.45, 0, 0, Math.PI);
    c.closePath();
    c.fillStyle = ramp.light;
    c.fill();
    c.save();
    c.clip();
    c.beginPath();
    c.ellipse(x + rx * 0.55, y, rx * 0.6, ry * 1.2, 0, 0, Math.PI * 2);
    c.fillStyle = ramp.shade;
    c.fill();
    c.restore();
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, Math.PI, 0);
    c.ellipse(x, y, rx, rx * 0.45, 0, 0, Math.PI);
    c.closePath();
    c.strokeStyle = INK;
    c.lineWidth = this.line;
    c.stroke();
  }
  /** A door or window on the left (lit) face b = b1, from a0 to a1 along it. */
  leftPanel(a0: number, a1: number, b: number, z0: number, h: number, fill: string): void {
    this.poly([this.P(a0, b, z0), this.P(a1, b, z0), this.P(a1, b, z0 + h), this.P(a0, b, z0 + h)], fill, "inner");
  }
  /** A door or window on the right (shade) face a = a1. */
  rightPanel(b0: number, b1: number, a: number, z0: number, h: number, fill: string): void {
    this.poly([this.P(a, b1, z0), this.P(a, b0, z0), this.P(a, b0, z0 + h), this.P(a, b1, z0 + h)], fill, "inner");
  }
  post(a: number, b: number, z0: number, h: number, w: number, color: string): void {
    const [x, y] = this.P(a, b, z0);
    const c = this.c;
    c.fillStyle = color;
    c.strokeStyle = INK;
    c.lineWidth = this.line / 2;
    c.beginPath();
    c.rect(x - (w * this.s) / 2, y - h * this.s, w * this.s, h * this.s);
    c.fill();
    c.stroke();
  }
  /** Spoked wheel (the Clockworks' gear, the treadwheel). */
  wheel(a: number, b: number, z: number, R: number, ramp: Ramp, teeth = 10): void {
    const c = this.c;
    const [x, y] = this.P(a, b, z);
    const r0 = R * this.s;
    c.beginPath();
    for (let k = 0; k < teeth * 2; k++) {
      const ang = (k / (teeth * 2)) * Math.PI * 2;
      const rr = k % 2 ? r0 : r0 * 1.18;
      c.lineTo(x + Math.cos(ang) * rr * 0.75, y + Math.sin(ang) * rr);
    }
    c.closePath();
    c.fillStyle = ramp.base;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = this.line;
    c.stroke();
    c.beginPath();
    c.ellipse(x, y, r0 * 0.3, r0 * 0.4, 0, 0, Math.PI * 2);
    c.fillStyle = ramp.shade;
    c.fill();
    c.lineWidth = this.line / 2;
    c.stroke();
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI;
      this.line2([x - Math.cos(ang) * r0 * 0.7, y - Math.sin(ang) * r0 * 0.95], [x + Math.cos(ang) * r0 * 0.7, y + Math.sin(ang) * r0 * 0.95], 0.4);
    }
  }
  /** A small flag or pennant on a pole. */
  flag(a: number, b: number, z: number, h: number, color: string, stripes?: string): void {
    const [x, y] = this.P(a, b, z);
    const top = y - h * this.s;
    this.line2([x, y], [x, top], 0.6);
    const w = 12 * this.s;
    this.poly([[x, top], [x + w, top + 3 * this.s], [x, top + 7 * this.s]], color, "inner");
    if (stripes) this.line2([x + 2 * this.s, top + 1.5 * this.s], [x + 2 * this.s, top + 5.5 * this.s], 0.8, stripes);
  }
}
