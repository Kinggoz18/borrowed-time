/**
 * Dusk hints (FINAL_PLAN_BT.md §3 "Raids are a surprise"): the kind of night and a rough band
 * measured against your defence right now. Presentation only: reads the state, never rolls the
 * island's RNG, so showing a hint cannot change the game.
 */
import * as E from "./engine";
import { HIDDEN, LINES, QUIET, raidKind, sailCount, sailTint, stealthHidden, tacticOf, type RaidKind, type SailTint } from "./raiders";
import type { IslandState } from "./state";

export type { RaidKind };
export type HintKind = RaidKind;
export type Band = "light" | "even" | "heavy";
export { HIDDEN, LINES, QUIET };

export interface DuskHint {
  kind: HintKind;
  band: Band | null;
  line: string;
  /** Estimated raider strength as a range. Null on quiet nights. */
  range: [number, number] | null;
  /** Stealth raids: the watch couldn't name the boats (no Observatory / upgraded tower). */
  hidden: boolean;
}

/** Displayed raider range without an Observatory (the true roll stays hidden). */
export const HINT_SPREAD = 0.25;
/** Observatory: Ada can count oars, not intentions. */
export const OBS_HINT_SPREAD = 0.1;
/** Hidden stealth: vaguer still. */
export const HIDDEN_HINT_SPREAD = 0.4;

export function hintSpread(st: IslandState): number {
  if (stealthHidden(st)) return HIDDEN_HINT_SPREAD;
  return E.hasB(st, "observatory") ? OBS_HINT_SPREAD : HINT_SPREAD;
}

export function strengthRange(nominal: number, spread: number): [number, number] {
  return [Math.round(nominal * (1 - spread)), Math.round(nominal * (1 + spread))];
}

/** Layout for the dusk card's defence-vs-raiders bar (percent of a shared scale). */
export function rangeBar(
  def: number,
  lo: number,
  hi: number,
): { max: number; loPct: number; widthPct: number; defPct: number } {
  const max = Math.max(def, hi, 1) * 1.15;
  return {
    max,
    loPct: (lo / max) * 100,
    widthPct: (Math.max(0, hi - lo) / max) * 100,
    defPct: (def / max) * 100,
  };
}

/** Numbers the dusk card shows: defence now, each choice, and the raiders' range. */
export interface DuskRead {
  hint: DuskHint;
  defence: number;
  wallsDefence: number;
  borrowDefence: number;
  canBorrow: boolean;
  loan: number;
}

export function duskRead(st: IslandState): DuskRead {
  const hint = duskHint(st);
  return {
    hint,
    defence: E.defence(st),
    wallsDefence: E.defence(st, { walls: true }),
    borrowDefence: E.defence(st, { borrow: true }),
    canBorrow: E.canBorrowDusk(st),
    loan: E.duskLoan(st),
  };
}

/** Pick a line from a bank using season and day only — never the island RNG. */
export function pickLine(lines: readonly string[], season: number, day: number): string {
  const n = lines.length;
  if (!n) return "";
  const i = ((season * 3 + day * 7) % n + n) % n;
  return lines[i]!;
}

/** light < 70% of your defence, even 70–110%, heavy > 110%. */
export function bandOf(strength: number, defence: number): Band {
  const q = strength / Math.max(1, defence);
  return q < 0.7 ? "light" : q <= 1.1 ? "even" : "heavy";
}

/** Fraction of the day when the watch calls (hour = round(NOON_FRAC * dayLen), clamped). */
export const NOON_FRAC = 0.6;
export const NOON_CALM_LINE = "Calm sea.";

export function noonHour(dayLen: number): number {
  const h = Math.round(NOON_FRAC * dayLen);
  return Math.max(1, Math.min(dayLen - 1, h));
}

export interface NoonCall {
  calm: boolean;
  kind: RaidKind;
  band: Band | null;
  line: string;
  sails: number;
  tint: SailTint | null;
  hidden: boolean;
}

/** Same threat read as dusk, earlier in the day; calm line on quiet nights. */
export function noonCall(st: IslandState): NoonCall {
  const hint = duskHint(st);
  if (hint.kind === "quiet") {
    return { calm: true, kind: "quiet", band: null, line: NOON_CALM_LINE, sails: 0, tint: null, hidden: false };
  }
  const hidden = hint.hidden;
  const sails = hidden ? 0 : sailCount(st.season, st.day);
  const tint = hidden ? null : sailTint(hint.kind);
  return { calm: false, kind: hint.kind, band: hint.band, line: hint.line, sails, tint, hidden };
}

export function duskHint(st: IslandState): DuskHint {
  const kind = raidKind(st);
  if (kind === "quiet") return { kind, band: null, line: pickLine(QUIET, st.season, st.day), range: null, hidden: false };
  const hidden = stealthHidden(st, kind);
  const n = Math.round(E.nominal(st) * tacticOf(st, kind).scale);
  const band = bandOf(n, E.defence(st));
  const line = hidden ? pickLine(HIDDEN, st.season, st.day) : pickLine(LINES[kind][band], st.season, st.day);
  return { kind, band, line, range: strengthRange(n, hintSpread(st)), hidden };
}
