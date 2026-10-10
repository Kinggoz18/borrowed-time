/**
 * The Build sheet's content, as data: what shows for a tier, grouped by what it does, and the
 * state of each card. Pure (no DOM), so the grouping, the "locked items stay out" rule, the
 * one-teaser rule and every card state are unit-tested. UX spec section 7.
 */
import * as E from "../core/engine";
import { B, COUNT, type BType } from "../core/rules";
import type { IslandState } from "../core/state";
import { TEASERS } from "./copy";

export interface BuildGroup {
  id: string;
  title: string;
  /** the short label on the category rail */
  rail: string;
  tagline: string;
  types: BType[];
}

/** Order inside a group is the order they appear in the sheet. */
export const BUILD_GROUPS: readonly BuildGroup[] = [
  { id: "defence", title: "Defence", rail: "Defence", tagline: "Keep the night out.", types: ["palisade", "tower", "harbour"] },
  { id: "dwellings", title: "Dwellings", rail: "Homes", tagline: "Room for more people.", types: ["cottage", "lantern"] },
  { id: "food", title: "Food & farming", rail: "Food", tagline: "Fed people make Hours.", types: ["field"] },
  { id: "trade", title: "Trade & industry", rail: "Trade", tagline: "Hours, coin and caravans.", types: ["workshop", "road", "trade", "mirror", "exchange"] },
  { id: "civic", title: "Civic", rail: "Civic", tagline: "Time, learning and care.", types: ["bank", "academy", "hospital", "observatory"] },
];

/** What the Build sheet offers, in the order the data lists it. Academy waits for its research screen. */
export const BUILD_ORDER: BType[] = ["palisade", "field", "cottage", "workshop", "tower", "bank", "road", "trade", "lantern", "mirror", "hospital", "exchange", "harbour", "observatory"];

export const tierOf = (t: BType): number => B[t].tier ?? 0;

/** Groups with only what this settlement tier has unlocked and the UI can build. Empty groups are dropped. */
export function visibleGroups(tier: number, buildable: readonly BType[]): BuildGroup[] {
  return BUILD_GROUPS.map((g) => ({ ...g, types: g.types.filter((t) => buildable.includes(t) && tierOf(t) <= tier) })).filter((g) => g.types.length > 0);
}

/**
 * At most one calm sentence per group, only when something in that group arrives in the very next era,
 * only when the group already shows something, and never a building's name. Null otherwise.
 */
export function teaserFor(groupId: string, tier: number, buildable: readonly BType[]): string | null {
  const g = BUILD_GROUPS.find((x) => x.id === groupId);
  if (!g) return null;
  const shown = g.types.some((t) => buildable.includes(t) && tierOf(t) <= tier);
  const arriving = g.types.some((t) => buildable.includes(t) && tierOf(t) === tier + 1);
  return shown && arriving ? (TEASERS[`${tier}:${groupId}`] ?? null) : null;
}

export type CardState = "can" | "hours" | "credit" | "nolot" | "done";
export interface BuildCard {
  type: BType;
  name: string;
  cost: number;
  credit: boolean;
  state: CardState;
  /** "2 of 4 built", "Level 3", "All 4 built for now" or "" */
  meta: string;
  /** Hours still missing, when the state is "hours" */
  need: number;
  verb: "Build" | "Upgrade";
  /** the button does something */
  buy: boolean;
  /** a global (Palisade, Roads) that is already built: the button upgrades it */
  upgrade: boolean;
  /** shown with a green "Built" tag instead of a button */
  built: boolean;
}

/** One card's state. `lot` is the lot the sheet was opened from, if any. */
export function cardFor(st: IslandState, t: BType, lot?: string): BuildCard {
  const b = B[t];
  const glob = b.glob ? E.bAt(st, b.glob) : null;
  const base = { type: t, name: b.name, credit: !!b.credit };
  if (glob) {
    const cap = E.tierCap(st);
    const c = E.cost(t, glob.n + 1, st.L);
    if (glob.n >= cap) return { ...base, cost: c, state: "done", meta: `Level ${glob.n}`, need: 0, verb: "Upgrade", buy: false, upgrade: true, built: true };
    const ok = E.canUpgrade(st, b.glob!);
    const short = !ok && st.hours < c;
    return { ...base, cost: c, state: ok ? "can" : short ? "hours" : "done", meta: `Level ${glob.n}`, need: short ? Math.ceil(c - st.hours) : 0, verb: "Upgrade", buy: ok, upgrade: true, built: false };
  }
  const c = E.cost(t, 0, st.L);
  const have = E.countOf(st, t);
  const max = COUNT[t][st.tier];
  const meta = have >= max && max > 1 ? `All ${max} built for now` : have > 0 && max > 1 ? `${have} of ${max} built` : "";
  const mk = (state: CardState, extra: Partial<BuildCard> = {}): BuildCard => ({ ...base, cost: c, state, meta, need: 0, verb: "Build", buy: state === "can", upgrade: false, built: false, ...extra });
  if (have >= max) return mk("done", { built: true });
  if (b.credit) {
    if (st.debt + c > E.limit(st)) return mk("credit");
  } else if (st.hours < c) return mk("hours", { need: Math.ceil(c - st.hours) });
  if (!b.glob) {
    const spot = lot ?? safestLot(st);
    if (!spot || !E.isFree(st, spot)) return mk("nolot");
  }
  return mk("can");
}

export const safestLot = (st: IslandState): string | undefined => E.greyOrder(st).slice().reverse().find((k) => E.isFree(st, k));

/** A category has "something you can afford now" when any of its cards can be bought. */
export const groupAffordable = (st: IslandState, g: BuildGroup, lot?: string): boolean => g.types.some((t) => cardFor(st, t, lot).buy);
