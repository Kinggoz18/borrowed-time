/**
 * Deterministic, loopable score tables. No samples: Web Audio plays these notes.
 * Tobias's Colony fiddle is a little sharp and late on purpose (LORE.md).
 */
export type MusicScene = "menu" | "day" | "dusk" | "raid" | "hesper";
export type Inst =
  | "fiddle"
  | "whistle"
  | "drone"
  | "surf"
  | "gurdy"
  | "drum"
  | "bell"
  | "lute"
  | "harpsichord"
  | "tick"
  | "brass"
  | "hiss"
  | "box";

export interface Note {
  t: number;
  dur: number;
  freq: number;
  inst: Inst;
  gain: number;
  /** Cents, for Tobias playing badly. */
  detune: number;
}

export const STEP_S = 0.5;
export const STEPS = 32;
export const LOOP_S = STEP_S * STEPS;

const COLONY = [293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 523.25, 587.33];
const VILLAGE = [196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0];
const TOWN = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const CITY = [174.61, 196.0, 220.0, 261.63, 293.66, 329.63, 349.23, 392.0];
const SCALES = [COLONY, VILLAGE, TOWN, CITY] as const;

/** Colony phrase: mostly D mixolydian, with a wrong 4th Tobias keeps hitting. */
const PHRASE = [0, 2, 4, 2, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 3, 0, 0, 2, 4, 5, 4, 2, 0, 2, 5, 4, 2, 0, 4, 2, 0, 0];
const BAD_CENTS = [0, 18, -14, 22, 0, -9, 28, 6, 0, 12, -18, 8, 20, -6, 16, 0];

function deg(era: number, i: number, oct = 0): number {
  const sc = SCALES[era] ?? COLONY;
  const n = ((i % sc.length) + sc.length) % sc.length;
  return sc[n]! * Math.pow(2, oct);
}

export function score(era: number, scene: MusicScene): Note[] {
  const e = Math.max(0, Math.min(3, era | 0));
  if (scene === "hesper") return hesper();
  if (scene === "raid") return raid(e);
  if (scene === "dusk") return dusk(e);
  return day(e, scene === "menu");
}

function day(era: number, menu: boolean): Note[] {
  const out: Note[] = [];
  const quiet = menu ? 0.85 : 1;
  out.push({ t: 0, dur: LOOP_S, freq: deg(era, 0, -1), inst: "drone", gain: 0.07 * quiet, detune: 0 });
  out.push({ t: 0, dur: LOOP_S, freq: deg(era, 4, -1), inst: "drone", gain: 0.05 * quiet, detune: 0 });
  if (era === 0) out.push({ t: 0, dur: LOOP_S, freq: 90, inst: "surf", gain: 0.08 * quiet, detune: 0 });
  if (era === 3) out.push({ t: 0, dur: LOOP_S, freq: 180, inst: "hiss", gain: 0.03 * quiet, detune: 0 });
  for (let s = 0; s < STEPS; s++) {
    const t = s * STEP_S;
    const i = PHRASE[s]!;
    const cents = era === 0 ? BAD_CENTS[s % BAD_CENTS.length]! : 0;
    if (era === 0) {
      out.push({ t, dur: 0.42, freq: deg(0, i), inst: "fiddle", gain: 0.12 * quiet, detune: cents });
      if (s % 2 === 1) out.push({ t: t + 0.12, dur: 0.28, freq: deg(0, i, 1), inst: "whistle", gain: 0.08 * quiet, detune: cents * 0.3 });
    } else if (era === 1) {
      out.push({ t, dur: 0.48, freq: deg(1, i), inst: "gurdy", gain: 0.1 * quiet, detune: 0 });
      if (s % 4 === 0) out.push({ t, dur: 0.12, freq: 70, inst: "drum", gain: 0.1 * quiet, detune: 0 });
    } else if (era === 2) {
      out.push({ t, dur: 0.22, freq: deg(2, i), inst: "lute", gain: 0.09 * quiet, detune: 0 });
      if (s % 2 === 0) out.push({ t: t + 0.25, dur: 0.08, freq: deg(2, (i + 2) % 8, 1), inst: "harpsichord", gain: 0.06 * quiet, detune: 0 });
      out.push({ t, dur: 0.04, freq: 1200, inst: "tick", gain: 0.022 * quiet, detune: 0 });
    } else {
      if (s % 2 === 0) out.push({ t, dur: 0.7, freq: deg(3, i, -1), inst: "brass", gain: 0.09 * quiet, detune: 0 });
      if (s % 4 === 2) out.push({ t, dur: 0.35, freq: deg(3, i), inst: "harpsichord", gain: 0.05 * quiet, detune: 0 });
    }
  }
  return out;
}

function dusk(era: number): Note[] {
  const out: Note[] = [];
  out.push({ t: 0, dur: LOOP_S, freq: deg(era, 0, -2), inst: "drone", gain: 0.07, detune: 0 });
  out.push({ t: 0, dur: LOOP_S, freq: deg(era, 0, -1), inst: "drone", gain: 0.04, detune: 0 });
  for (let s = 0; s < STEPS; s += 8) {
    out.push({ t: s * STEP_S, dur: 2.4, freq: deg(era, 4, 1), inst: "bell", gain: 0.12, detune: 0 });
  }
  if (era >= 1) out.push({ t: 4, dur: 0.2, freq: 180, inst: "drum", gain: 0.04, detune: 0 });
  return out;
}

function raid(era: number): Note[] {
  const out: Note[] = [];
  out.push({ t: 0, dur: LOOP_S, freq: 55 + era * 6, inst: "drone", gain: 0.09, detune: 0 });
  out.push({ t: 0, dur: LOOP_S, freq: 82, inst: "drone", gain: 0.05, detune: 0 });
  for (let s = 0; s < STEPS; s++) {
    const t = s * STEP_S;
    if (s % 2 === 0) out.push({ t, dur: 0.14, freq: 60, inst: "drum", gain: 0.13, detune: 0 });
    if (s % 4 === 2) out.push({ t, dur: 0.1, freq: 180, inst: "drum", gain: 0.08, detune: 0 });
  }
  return out;
}

function hesper(): Note[] {
  const box = [523.25, 659.25, 783.99, 659.25, 1046.5, 783.99, 659.25, 523.25];
  const out: Note[] = [];
  out.push({ t: 0, dur: LOOP_S, freq: 130.81, inst: "drone", gain: 0.03, detune: 0 });
  for (let s = 0; s < STEPS; s++) {
    const t = s * STEP_S;
    out.push({ t, dur: 0.05, freq: 1800, inst: "tick", gain: 0.04, detune: 0 });
    if (s % 2 === 0) out.push({ t, dur: 0.35, freq: box[(s / 2) % box.length]!, inst: "box", gain: 0.1, detune: s % 8 === 6 ? 8 : 0 });
  }
  return out;
}

export const STINGER: Note[] = [
  { t: 0, dur: 0.18, freq: 261.63, inst: "bell", gain: 0.14, detune: 0 },
  { t: 0.16, dur: 0.18, freq: 329.63, inst: "bell", gain: 0.14, detune: 0 },
  { t: 0.32, dur: 0.18, freq: 392.0, inst: "bell", gain: 0.15, detune: 0 },
  { t: 0.48, dur: 0.5, freq: 523.25, inst: "bell", gain: 0.16, detune: 0 },
];

/** Instruments used by a scene, in first-heard order. Pure, for tests. */
export function palette(era: number, scene: MusicScene): Inst[] {
  const seen = new Set<Inst>();
  const out: Inst[] = [];
  for (const n of score(era, scene)) {
    if (seen.has(n.inst)) continue;
    seen.add(n.inst);
    out.push(n.inst);
  }
  return out;
}
