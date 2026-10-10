/** What the HUD says, as pure data (no DOM), so every state is unit-tested. UX spec section 4. */
import * as E from "../core/engine";
import { BASE_DAY, dayKind, EVENTS, SEASON_DAYS, TIERS, xpNeed } from "../core/rules";
import type { IslandState } from "../core/state";
import { charter } from "./charterModel";
import { HUD } from "./copy";

export type OwedState = "safe" | "owed" | "near" | "over";

/** Nothing owed is safe; 80% of the limit is near; past it is over. */
export function owedState(debt: number, lim: number): OwedState {
  if (debt <= 0) return "safe";
  if (debt > lim) return "over";
  if (debt >= 0.8 * lim) return "near";
  return "owed";
}

export const fmt = (n: number): string => (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.floor(n)));

export interface OwedChip {
  state: OwedState;
  /** the big text: "Safe" or "18/67" */
  num: string;
  /** the small word under it */
  word: string;
  /** owed / limit, 0..1 (0 when safe); drives the thin meter */
  pct: number;
  label: string;
  /** only the near-limit chip pulses */
  pulse: boolean;
}
export function owedChip(debt: number, lim: number): OwedChip {
  const state = owedState(debt, lim);
  if (state === "safe") return { state, num: HUD.owed.safe, word: HUD.safeSub, pct: 0, label: "Nothing owed. Open Hesper.", pulse: false };
  const num = `${fmt(debt)}/${fmt(lim)}`;
  return { state, num, word: HUD.owed[state], pct: Math.min(1, debt / Math.max(1, lim)), label: `${debt} of ${lim} owed. Open Hesper.`, pulse: state === "near" };
}

export interface TimeBox {
  icon: "sun" | "moon";
  /** "Day 3 of 6" */
  day: string;
  /** "7h of light", "Dusk", "Night" or "Long Dusk tonight" */
  light: string;
  /** one pip per day of the season: done, now, and the Long Dusk pip */
  pips: { done: boolean; now: boolean; boss: boolean }[];
  /** lit segments of the light bar, and how many in all */
  lit: number;
  segments: number;
  /** the season's event, when it is not an ordinary season */
  event: string | null;
  label: string;
}
export function timeBox(st: IslandState): TimeBox {
  const left = Math.max(0, st.dayLen - st.hour);
  const longDusk = dayKind(st.day) === "boss";
  const light = st.phase === "dusk" ? HUD.dusk : st.phase === "night" ? HUD.night : longDusk ? HUD.longDusk : `${left}h of light`;
  const ev = EVENTS.find((e) => e.id === st.event);
  const day = `Day ${st.day} of ${SEASON_DAYS}`;
  return {
    icon: st.phase === "day" ? "sun" : "moon",
    day,
    light,
    pips: Array.from({ length: SEASON_DAYS }, (_, i) => ({ done: i + 1 < st.day, now: i + 1 === st.day, boss: dayKind(i + 1) === "boss" })),
    lit: st.phase === "day" ? left : 0,
    segments: st.dayLen,
    event: ev && ev.id !== "fair" ? ev.name : null,
    label: `${day}, ${light}`,
  };
}

/** Hours an hour, for the laptop plaque. */
export function incomeLine(st: IslandState): string {
  const per = E.income(st) / BASE_DAY;
  return `+${per < 10 ? per.toFixed(1).replace(/\.0$/, "") : Math.round(per)} an hour`;
}

/** The colony badge's second line. */
export const colonyLine = (st: IslandState): string => `${TIERS[st.tier].name} · Level ${st.L}`;

/** The goal chip and card: the same four rows as the Charter, so they cannot disagree. Null in the last era. */
export function goalModel(st: IslandState) {
  const c = charter(st);
  if (!c.next) return null;
  return {
    name: `${c.next.name} Charter`,
    met: c.met,
    ready: c.ready,
    line: c.ready ? HUD.readyAtDawn : `${c.met} of 4 ready`,
    rows: c.rows.map((r) => ({ id: r.id, met: r.met, title: r.short, value: r.hudValue })),
    label: `${c.next.name} Charter: ${c.met} of 4 ready. Open.`,
  };
}

/** Everything the HUD's look depends on, as one string: it only rebuilds a part when its piece changes. */
export const colonySig = (st: IslandState, name: string): string => [name, st.tier, st.L, Math.round((st.xp / Math.max(1, xpNeed(st.L))) * 20)].join("|");

