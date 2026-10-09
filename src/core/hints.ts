/**
 * Dusk hints (FINAL_PLAN_BT.md §3 "Raids are a surprise"): the kind of night and a rough band
 * measured against your defence right now. Presentation only: reads the state, never rolls the
 * island's RNG, so showing a hint cannot change the game.
 */
import * as E from "./engine";
import { dayKind } from "./rules";
import type { IslandState } from "./state";

export type HintKind = "quiet" | "skiffs" | "longboats" | "longDusk";
export type Band = "light" | "even" | "heavy";
export interface DuskHint {
  kind: HintKind;
  band: Band | null;
  line: string;
  /** Estimated raider strength as a range. Null on quiet nights. */
  range: [number, number] | null;
}

/** Displayed raider range without an Observatory (the true roll stays hidden). */
export const HINT_SPREAD = 0.25;
/** Observatory: Ada can count oars, not intentions. */
export const OBS_HINT_SPREAD = 0.1;

export function hintSpread(st: IslandState): number {
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

/** Four or five short lines per kind and band, rotated by season and day. */
export const LINES: Record<Exclude<HintKind, "quiet">, Record<Band, readonly string[]>> = {
  skiffs: {
    light: [
      "A few oars, far out.",
      "Thin wakes. Not many.",
      "One lamp on the water, then gone.",
      "A small sail, grey as the shore.",
      "Someone rowing, slowly, a long way off.",
    ],
    even: [
      "Gulls gone quiet. Light boats.",
      "Quick hulls, close enough to count.",
      "Oars in time. They're not lost.",
      "Grey sails, low, coming in.",
      "Light boats. The watch is awake.",
    ],
    heavy: [
      "Quick oars, lots of them. They're making good time.",
      "The water is busy. Too many small hulls.",
      "Little hulls in a line. They know the grey shore.",
      "Oars like rain. Light boats, too many.",
      "The Late in little boats, and plenty of them.",
    ],
  },
  longboats: {
    light: [
      "One heavy hull, low in the water.",
      "A single drum, far off.",
      "One long boat. It isn't hurrying.",
      "A deep hull on a quiet sea.",
      "Something heavy, still a way out.",
    ],
    even: [
      "Gulls gone quiet. Many oars.",
      "Long boats. You can hear the timber.",
      "Heavy hulls, keeping time.",
      "The kind that knock walls, not just purses.",
      "Oars and a low sail. They mean to land.",
    ],
    heavy: [
      "Drums on the water. Too many oars to count.",
      "The big boats are full. The drums agree.",
      "Longboats, packed. They've done this before.",
      "A wall of hulls. The dusk is loud.",
      "Heavy timber, many oars, no song we like.",
    ],
  },
  longDusk: {
    light: [
      "The dusk is thin tonight.",
      "A long shadow, but a short one as these go.",
      "The light is leaving, not all at once.",
      "The season's end feels light. Don't trust that.",
      "A pale Long Dusk. It still has a name.",
    ],
    even: [
      "The light is leaving early.",
      "Clocks slow. The sea is holding its breath.",
      "The Long Dusk is the size of a usual debt.",
      "The shadow on the water is ours, more or less.",
      "Evening came in a hurry. The usual hurry.",
    ],
    heavy: [
      "Every clock on the island has stopped.",
      "The dusk is as tall as what we owe.",
      "No birds. No bells. The sea is standing up.",
      "The Long Dusk has learned our names.",
      "The shadow doesn't end at the shore.",
    ],
  },
};

export const QUIET: readonly string[] = [
  "Calm sea.",
  "Calm sea. Nothing out there but tomorrow.",
  "The horizon is empty. For now.",
  "No oars. The gulls are still talking.",
  "A quiet night. The watch can sit.",
];

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

export function duskHint(st: IslandState): DuskHint {
  const k = dayKind(st.day);
  if (k === "quiet") return { kind: "quiet", band: null, line: pickLine(QUIET, st.season, st.day), range: null };
  const kind: HintKind = k === "boss" ? "longDusk" : (st.season * 7 + st.day) % 3 === 0 ? "longboats" : "skiffs";
  const n = E.nominal(st);
  const band = bandOf(n, E.defence(st));
  return {
    kind,
    band,
    line: pickLine(LINES[kind][band], st.season, st.day),
    range: strengthRange(n, hintSpread(st)),
  };
}
