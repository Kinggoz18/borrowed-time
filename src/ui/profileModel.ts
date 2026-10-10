/** The Profile as pure data: who we are, what we have, what we owe. UX spec section 5. */
import * as E from "../core/engine";
import { B, COUNT, SEASON_DAYS, TIERS, xpNeed, type BType } from "../core/rules";
import type { IslandState } from "../core/state";
import { MARKS, PLURAL } from "./copy";
import { capital, numWord } from "./words";

export interface Mark {
  id: keyof typeof MARKS;
  name: string;
  line: string;
}
export interface ProfileColony {
  level: number;
  xpPct: number;
  xpNow: number;
  xpMax: number;
  kicker: string;
  toNext: string;
  stats: { n: number; label: string }[];
  marks: Mark[];
}
export interface ProfileIsland {
  fed: { pct: number; value: string; short: boolean };
  homes: { pct: number; value: string; short: boolean };
  /** "Five are sleeping rough. A Cottage gives them a roof." */
  rough: string | null;
  hungry: string | null;
  buildings: { type: BType; name: string; value: string }[];
  grey: string | null;
}
export interface LedgerRow {
  label: string;
  n: number;
  bad?: boolean;
}

/** Days kept: how many days this colony has lived. */
export const daysKept = (st: IslandState): number => (st.season - 1) * SEASON_DAYS + st.day;

export function profileColony(st: IslandState): ProfileColony {
  const need = xpNeed(st.L);
  const atMax = st.L >= 20;
  const s = st.stats;
  const marks: Mark[] = [];
  if (E.blds(st).length > 0 || st.pal || st.road || s.levelUps > 0) marks.push({ id: "roof", ...MARKS.roof });
  if (s.raidsWon >= 1) marks.push({ id: "night", ...MARKS.night });
  if (s.bossWon >= 1) marks.push({ id: "dusk", name: MARKS.dusk.name, line: `Season ${st.bossResult?.won ? st.bossResult.season : Math.max(1, st.season - 1)} ended standing.` });
  if (s.tierUps >= 1 || st.tier > 0) marks.push({ id: "grew", name: MARKS.grew.name, line: MARKS.grew.line.replace("{era}", TIERS[st.tier].name) });
  if (s.repaid >= 1 && st.debt === 0) marks.push({ id: "paid", ...MARKS.paid });
  if (Object.keys(st.tech).length > 0) marks.push({ id: "learned", ...MARKS.learned });
  return {
    level: st.L,
    xpPct: atMax ? 1 : Math.min(1, st.xp / need),
    xpNow: st.xp,
    xpMax: need,
    kicker: `${TIERS[st.tier].name} · Season ${st.season}, Day ${st.day}`,
    toNext: atMax ? "The highest level" : `${Math.floor(st.xp)} of ${need} to Level ${st.L + 1}`,
    stats: [
      { n: st.pop, label: "People" },
      { n: E.blds(st).length + (st.pal ? 1 : 0) + (st.road ? 1 : 0), label: "Buildings" },
      { n: daysKept(st), label: "Days kept" },
      { n: s.raidsWon, label: "Nights held" },
    ],
    // newest-looking first: the later in the story, the nearer the top
    marks: marks.reverse().slice(0, 6),
  };
}

export function profileIsland(st: IslandState, offered: readonly BType[]): ProfileIsland {
  const food = Math.floor(E.food(st));
  const room = E.popRoom(st);
  const roughN = Math.max(0, st.pop - room);
  const hungryN = Math.max(0, st.pop - food);
  const rows: ProfileIsland["buildings"] = [];
  for (const t of offered) {
    const b = B[t];
    if ((b.tier ?? 0) > st.tier || COUNT[t][st.tier] === 0) continue;
    const have = b.glob ? (st[b.glob] ? 1 : 0) : E.countOf(st, t);
    const max = COUNT[t][st.tier];
    const name = PLURAL[t] ?? b.name;
    let value: string;
    if (b.glob) value = st[b.glob] ? `Level ${st[b.glob]!.n}` : "Not yet";
    else if (b.one || max === 1) value = have ? "Built" : "Not yet";
    else value = `${have} of ${max}`;
    rows.push({ type: t, name, value });
  }
  const g = E.greyCount(st);
  return {
    fed: { pct: st.pop > 0 ? Math.min(1, food / st.pop) : 1, value: `Food for ${food} · ${st.pop} here`, short: hungryN > 0 },
    homes: { pct: st.pop > 0 ? Math.min(1, room / st.pop) : 1, value: `Room for ${room} · ${st.pop} here`, short: roughN > 0 },
    rough: roughN > 0 ? `${capital(numWord(roughN))} ${roughN === 1 ? "is" : "are"} sleeping rough. A Cottage gives them a roof.` : null,
    hungry: hungryN > 0 ? `${capital(numWord(hungryN))} ${hungryN === 1 ? "is" : "are"} going hungry. A Field feeds more mouths.` : null,
    buildings: rows,
    grey: g > 0 ? `${g} ${g === 1 ? "lot is" : "lots are"} grey. They work at half until you repay.` : null,
  };
}

export function ledgerRows(st: IslandState): LedgerRow[] {
  const s = st.stats;
  const rows: LedgerRow[] = [
    { label: "Borrowed", n: s.borrowed },
    { label: "Repaid", n: s.repaid },
    { label: "Interest paid", n: Math.round(s.interest), bad: true },
    { label: "Nights held", n: s.raidsWon },
    { label: "Nights lost", n: s.raidsLost },
    { label: "Long Dusks held", n: s.bossWon },
  ];
  if (s.seized > 0) rows.push({ label: "Buildings taken", n: s.seized, bad: true });
  return rows;
}
