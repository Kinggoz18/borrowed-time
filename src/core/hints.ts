/**
 * Dusk hints (FINAL_PLAN_BT.md §3 "Raids are a surprise"): the kind of night and a rough band
 * measured against your defence right now, never a number. Presentation only: reads the state,
 * never rolls the island's RNG, so showing a hint cannot change the game.
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
  /** With the Observatory (City): a ±10% strength range. Otherwise null. */
  range: [number, number] | null;
}

const LINES: Record<Exclude<HintKind, "quiet">, Record<Band, string>> = {
  skiffs: { light: "A few oars, far out.", even: "Gulls gone quiet. Light boats.", heavy: "Quick oars, lots of them. They're making good time." },
  longboats: { light: "One heavy hull, low in the water.", even: "Gulls gone quiet. Many oars.", heavy: "Drums on the water. Too many oars to count." },
  longDusk: { light: "The dusk is thin tonight.", even: "The light is leaving early.", heavy: "Every clock on the island has stopped." },
};
const QUIET = ["Calm sea.", "Calm sea. Nothing out there but tomorrow."];

/** light < 70% of your defence, even 70–110%, heavy > 110%. */
export function bandOf(strength: number, defence: number): Band {
  const q = strength / Math.max(1, defence);
  return q < 0.7 ? "light" : q <= 1.1 ? "even" : "heavy";
}

export function duskHint(st: IslandState): DuskHint {
  const k = dayKind(st.day);
  if (k === "quiet") return { kind: "quiet", band: null, line: QUIET[(st.season + st.day) % 2], range: null };
  const kind: HintKind = k === "boss" ? "longDusk" : (st.season * 7 + st.day) % 3 === 0 ? "longboats" : "skiffs";
  const n = E.nominal(st);
  const band = bandOf(n, E.defence(st));
  const obs = E.hasB(st, "observatory");
  return { kind, band, line: LINES[kind][band], range: obs ? [Math.round(n * 0.9), Math.round(n * 1.1)] : null };
}
