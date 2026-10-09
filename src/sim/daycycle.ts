/** Day/night cycle (prototype lightAt). t: 0 dawn, 0.5 noon, 1 dusk, 1..2 night. */
export type DayPhase = "dawn" | "day" | "dusk" | "night";

export interface Light {
  sky: number;
  sea: number;
  tint: number;
  tintAlpha: number;
  /** 0 by day, 1 at full night: window and torch glows follow it. */
  night: number;
}

const STOPS = [
  { t: 0.0, sky: 0xe9c7a8, sea: 0x8fb0ae, tint: 0xffe6cc, ta: 0.1 },
  { t: 0.5, sky: 0xc9dad8, sea: 0x86aaa9, tint: 0xffffff, ta: 0.0 },
  { t: 0.85, sky: 0xe5b07e, sea: 0x8c9e9a, tint: 0xffcf9a, ta: 0.16 },
  { t: 1.0, sky: 0xa86b62, sea: 0x6f7f86, tint: 0xe7967a, ta: 0.3 },
  { t: 1.35, sky: 0x3a3f5c, sea: 0x4b5a6c, tint: 0x6f7ab0, ta: 0.42 },
  { t: 2.0, sky: 0x1f2538, sea: 0x2f3a4c, tint: 0x4b5487, ta: 0.52 },
];

export function mixColor(a: number, b: number, u: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * u);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

export function lightAt(t: number): Light {
  const tt = Math.max(0, Math.min(2, t));
  let a = STOPS[0], b = STOPS[STOPS.length - 1];
  for (let k = 0; k < STOPS.length - 1; k++)
    if (tt >= STOPS[k].t && tt <= STOPS[k + 1].t) {
      a = STOPS[k];
      b = STOPS[k + 1];
      break;
    }
  const u = b.t === a.t ? 0 : (tt - a.t) / (b.t - a.t);
  return {
    sky: mixColor(a.sky, b.sky, u),
    sea: mixColor(a.sea, b.sea, u),
    tint: mixColor(a.tint, b.tint, u),
    tintAlpha: a.ta + (b.ta - a.ta) * u,
    night: Math.max(0, Math.min(1, (tt - 0.95) / 0.5)),
  };
}

export function phaseAt(t: number): DayPhase {
  if (t < 0.15) return "dawn";
  if (t < 0.85) return "day";
  if (t < 1.0) return "dusk";
  return "night";
}

/** Cycle time for a clock in seconds. The normal loop is one full day and night per periodS. */
export function cycleAt(seconds: number, periodS: number): number {
  const u = (((seconds / periodS) % 1) + 1) % 1;
  return u * 2;
}

/** The gnomon shadow angle (radians) sweeps from west at dawn to east at dusk. */
export function gnomonAngle(t: number): number {
  const day = Math.max(0, Math.min(1, t));
  return Math.PI * (0.15 + 0.7 * day);
}
