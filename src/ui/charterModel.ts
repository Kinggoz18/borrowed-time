/** The Charter as pure data: four requirement rows, a hero line, and what the next age gives. UX spec section 6. */
import * as E from "../core/engine";
import { B, TIERS, type BType, type TierDef } from "../core/rules";
import type { IslandState } from "../core/state";
import { CHARTER } from "./copy";

export type ReqId = "level" | "people" | "kept" | "seal";
export interface ReqRow {
  id: ReqId;
  title: string;
  /** the HUD card's short label */
  short: string;
  met: boolean;
  value: string;
  /** the HUD card's short value */
  hudValue: string;
  /** progress 0..1 for rows that fill (level, people) */
  pct?: number;
  hint?: string;
  /** the one button that fixes it */
  action?: { go: "build-dwellings" | "build-food" | "hesper"; label: string };
}
export interface CharterModel {
  next: TierDef | null;
  title: string;
  met: number;
  ready: boolean;
  close: boolean;
  hero: string;
  rows: ReqRow[];
  rewards: { icon: "star" | "people" | "build"; title: string; line: string }[];
  /** next-era buildings the Build sheet will offer, for the "New to build" strip */
  unlocks: BType[];
}

/** The order the Charter names new buildings in (a player-friendly order, not the data order). */
const NAMING_ORDER: BType[] = ["road", "trade", "lantern", "mirror", "academy", "hospital", "exchange", "harbour", "observatory"];

export function charter(st: IslandState, offered: readonly BType[] = NAMING_ORDER): CharterModel {
  const g = E.growthNeeds(st);
  const nx = g.next;
  if (!nx) return { next: null, title: CHARTER.signed.title, met: 4, ready: true, close: false, hero: CHARTER.signed.body, rows: [], rewards: [], unlocks: [] };
  const lim = E.limit(st);
  const room = E.popRoom(st);
  const food = Math.floor(E.food(st));
  const homesShort = room < nx.pop;
  const foodShort = food < nx.pop;
  const sealDays = Math.max(0, (st.lien || 0) - E.absDay(st));
  const peopleHint = homesShort && foodShort ? `Homes for ${room}, food for ${food}. Add Cottages and Fields to make room for ${nx.pop}.` : homesShort ? `Homes for ${room}. Add Cottages to make room for ${nx.pop}.` : foodShort ? `Food for ${food}. Add Fields to feed ${nx.pop}.` : CHARTER.settledHint;
  const rows: ReqRow[] = [
    {
      id: "level",
      title: "Time lived",
      short: "Level",
      met: g.level,
      value: g.level ? `Level ${st.L} reached` : `Level ${st.L} of ${nx.lvl}`,
      hudValue: `${Math.min(st.L, nx.lvl)} of ${nx.lvl}`,
      pct: Math.min(1, st.L / nx.lvl),
      hint: g.level ? undefined : CHARTER.levelHint,
    },
    {
      id: "people",
      title: "People",
      short: "People",
      met: g.people,
      value: g.people ? `${nx.pop} of ${nx.pop} settled` : `${st.pop} of ${nx.pop} settled`,
      hudValue: `${Math.min(st.pop, nx.pop)} of ${nx.pop}`,
      pct: Math.min(1, st.pop / nx.pop),
      hint: g.people ? undefined : peopleHint,
      action: g.people ? undefined : homesShort ? { go: "build-dwellings", label: "Build homes" } : foodShort ? { go: "build-food", label: "Build food" } : undefined,
    },
    {
      id: "kept",
      title: "Kept time",
      short: "Kept time",
      met: g.kept,
      value: `You owe ${st.debt} · limit ${lim}`,
      hudValue: g.kept ? "Under limit" : "Over the limit",
      hint: g.kept ? undefined : CHARTER.keptHint,
      action: g.kept ? undefined : { go: "hesper", label: "Visit Hesper" },
    },
    {
      id: "seal",
      title: "Hesper's seal",
      short: "Hesper's seal",
      met: g.seal,
      value: g.seal ? "No seal on the charter" : `Sealed for ${sealDays} more day${sealDays === 1 ? "" : "s"}`,
      hudValue: g.seal ? "None" : `${sealDays} more day${sealDays === 1 ? "" : "s"}`,
      hint: g.seal ? undefined : CHARTER.sealHint,
    },
  ];
  const met = rows.filter((r) => r.met).length;
  const ready = met === 4;
  const era = nx.name;
  const lastUnmet = rows.find((r) => !r.met);
  const hero = ready ? CHARTER.heroReady : met === 3 ? CHARTER.heroClose + (lastUnmet?.id === "seal" ? CHARTER.heroCloseSeal(era) : "") : CHARTER.heroBlocked(era);
  const nextTier = st.tier + 1;
  const unlocks = NAMING_ORDER.filter((t) => B[t].tier === nextTier && offered.includes(t)).slice(0, 4);
  return {
    next: nx,
    title: `${era} Charter`,
    met,
    ready,
    close: met === 3,
    hero,
    rows,
    rewards: [
      { icon: "star", ...CHARTER.land },
      { icon: "people", ...CHARTER.people(TIERS[nextTier].popCap) },
      { icon: "build", ...CHARTER.levels(TIERS[nextTier].cap) },
    ],
    unlocks,
  };
}
