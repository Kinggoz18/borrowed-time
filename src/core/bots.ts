/**
 * Strategy bots and campaigns, ported from sim-test.js (RULES=build). Pure and deterministic:
 * a campaign is a function of (strategy, seed, seasons).
 */
import { Rng, type Roll } from "./rng";
import {
  B, COUNT, DAY_KIND, SEASON_DAYS, TIERS, costMul, stageOf, type BType, type TechId,
} from "./rules";
import * as E from "./engine";
import type { IslandState } from "./state";

export interface Strategy {
  tut: boolean;
  d1: number;
  daily: number;
  repayFrom: number;
  credit: number;
  dusk: "walls" | "smart" | "borrow";
}
export const STRATS: Record<StrategyName, Strategy> = {
  never: { tut: false, d1: 0, daily: 0, repayFrom: 99, credit: 0, dusk: "walls" },
  balanced: { tut: true, d1: 0.25, daily: 0, repayFrom: 2, credit: 0.5, dusk: "smart" },
  leverage: { tut: true, d1: 0.6, daily: 0, repayFrom: 3, credit: 0.8, dusk: "smart" },
  borrowMax: { tut: true, d1: 1.0, daily: 0, repayFrom: 4, credit: 1, dusk: "borrow" },
  reckless: { tut: true, d1: 0, daily: 0.25, repayFrom: 99, credit: 1, dusk: "borrow" },
};
export type StrategyName = "never" | "balanced" | "leverage" | "borrowMax" | "reckless";
export const STRATEGY_NAMES: StrategyName[] = ["never", "balanced", "leverage", "borrowMax", "reckless"];

/** Pacing tracker: every income-raising action, timed in in-game days. */
interface TrackPoint {
  t: number;
  tier: number;
  gain: number;
  inc: number;
  look?: boolean;
}
interface Ctx {
  track: TrackPoint[] | null;
  clock: number;
  breathers: { with: number; without: number }[] | null;
}

function build(c: Ctx, st: IslandState, k: string | undefined, type: BType): boolean {
  const i0 = E.income(st);
  const r = E.build(st, k, type);
  if (r && c.track) {
    const i1 = E.income(st);
    c.track.push({ t: c.clock + st.hour / st.dayLen, tier: st.tier, gain: (i1 - i0) / i0, inc: i1, look: true });
  }
  return r;
}
function upgrade(c: Ctx, st: IslandState, k: string): boolean {
  const i0 = E.income(st);
  const lv = () => E.bAt(st, k)?.n ?? 0;
  const s0 = stageOf(lv());
  const r = E.upgrade(st, k);
  if (r && c.track) {
    const i1 = E.income(st);
    c.track.push({ t: c.clock + st.hour / st.dayLen, tier: st.tier, gain: (i1 - i0) / i0, inc: i1, look: stageOf(lv()) !== s0 });
  }
  return r;
}
function buildDial(c: Ctx, st: IslandState): boolean {
  const i0 = E.income(st);
  const r = E.buildDial(st);
  if (r && c.track) c.track.push({ t: c.clock + st.hour / st.dayLen, tier: st.tier, gain: E.income(st) / i0 - 1, inc: E.income(st), look: true });
  return r;
}
function resolveDusk(c: Ctx, st: IslandState, dec: E.Decision, rnd: Roll): E.DuskResult {
  if (c.breathers && st.breather && DAY_KIND[st.day] === "raid") {
    // Breathers gate: compare tonight's nominal with and without the breather
    const was = st.breather;
    const withB = E.nominal(st);
    st.breather = false;
    const without = E.nominal(st);
    st.breather = was;
    c.breathers.push({ with: withB, without });
  }
  const ev = E.resolveDusk(st, dec, rnd);
  if (!("quiet" in ev && ev.quiet) && (ev as E.RaidResult).won && c.track) {
    c.track.push({ t: c.clock + 1, tier: st.tier, gain: 0, inc: E.income(st), look: true });
  }
  return ev;
}

const freeLot = (st: IslandState): string | undefined => E.greyOrder(st).slice().reverse().find((k) => E.isFree(st, k));
function bestOf(list: (() => unknown)[]): boolean {
  for (const o of list) if (o()) return true;
  return false;
}
function upgradeCheapest(c: Ctx, st: IslandState, type: BType): boolean {
  const cands = E.blds(st).filter(([k, b]) => b.type === type && E.canUpgrade(st, k)).sort((a, b) => a[1].n - b[1].n);
  return cands.length ? upgrade(c, st, cands[0][0]) : false;
}
function tryDefence(c: Ctx, st: IslandState): boolean {
  const f = freeLot(st);
  const opts: { c: number; d: number; go: () => boolean }[] = [];
  if (!st.pal) opts.push({ c: E.cost("palisade", 0, st.L), d: B.palisade.def!(0), go: () => build(c, st, "pal", "palisade") });
  else if (st.pal.n < E.tierCap(st)) opts.push({ c: E.cost("palisade", st.pal.n + 1, st.L), d: 3, go: () => upgrade(c, st, "pal") });
  E.blds(st).forEach(([k, b]) => {
    if (b.type === "tower" && b.n < E.tierCap(st)) opts.push({ c: E.cost("tower", b.n + 1, st.L), d: 2.5, go: () => upgrade(c, st, k) });
  });
  if (f) opts.push({ c: E.cost("tower", 0, st.L), d: 5, go: () => build(c, st, f, "tower") });
  opts.sort((a, b) => a.c / a.d - b.c / b.d);
  for (const o of opts) if (st.hours >= o.c && o.go()) return true;
  return false;
}
function tryEconomy(c: Ctx, st: IslandState, rnd: Roll): boolean {
  const f = freeLot(st);
  const want = (t: BType) => f && build(c, st, f, t);
  const opts: (() => unknown)[] = [];
  const room = E.popRoom(st);
  const cap = TIERS[st.tier].popCap;
  if (Math.floor(E.food(st)) <= Math.max(st.pop, room - 1) && Math.floor(E.food(st)) < cap)
    opts.push(() => want("field"), () => upgradeCheapest(c, st, "field"));
  if (room <= st.pop + 2 && room < cap) opts.push(() => want("cottage"), () => upgradeCheapest(c, st, "cottage"));
  if (st.debt > 0.3 * E.limit(st)) opts.push(() => want("bank"));
  opts.push(() => want("workshop"), () => upgradeCheapest(c, st, "workshop"));
  if (rnd() < 0.25) opts.reverse();
  if (st.tier >= 3 && st.hours - E.dialCost(st) > 4 && buildDial(c, st)) return true;
  if (bestOf(opts)) return true;
  // spare Hours: the best-value upgrade of anything
  const ups: [number, string, number?][] = [];
  E.blds(st).forEach(([k, b]) => {
    if (E.canUpgrade(st, k) && !B[b.type].credit) ups.push([E.cost(b.type, b.n + 1, st.L), k]);
  });
  if (st.pal && E.canUpgrade(st, "pal")) ups.push([E.cost("palisade", st.pal.n + 1, st.L), "pal"]);
  (["field", "cottage", "tower", "workshop"] as BType[]).forEach((t) => {
    if (f && E.canBuild(st, f, t)) ups.push([E.cost(t, 0, st.L), "new:" + t]);
  });
  if (st.tier >= 3) ups.push([E.dialCost(st), "dial"]);
  const I = E.income(st);
  const DIAL_INC = 0.25 / 30;
  ups.forEach((u) => {
    const [cc, k] = u;
    let d: number;
    if (k === "dial") d = (DIAL_INC + 0.01) * I;
    else if (k.startsWith("new:")) d = 0.01 * I;
    else {
      const b = E.bAt(st, k)!;
      const e = B[E.typeAt(st, k)!];
      d = (e.inc ? e.inc(b.n + 1) - e.inc(b.n) : 0) + (e.keep ? e.keep(b.n + 1) - e.keep(b.n) : 0);
      if (stageOf(b.n + 1) !== stageOf(b.n)) d += 0.01 * I;
    }
    u.push(d / cc);
  });
  ups.sort((a, b) => b[2]! - a[2]! || a[0] - b[0]);
  for (const [cc, k] of ups)
    if (st.hours - cc > 4) {
      if (k === "dial" ? buildDial(c, st) : k.startsWith("new:") ? build(c, st, f, k.slice(4) as BType) : upgrade(c, st, k)) return true;
    }
  return false;
}
function tryCredit(c: Ctx, st: IslandState, P: Strategy): boolean {
  if (!P.credit) return false;
  const f = freeLot(st);
  for (const t of ["lantern", "mirror"] as BType[]) {
    if (B[t].tier! > st.tier) continue;
    const cc = E.cost(t, 0, st.L);
    if (!E.hasB(st, t) && f && st.debt + cc <= P.credit * E.limit(st)) return build(c, st, f, t);
    const k = E.blds(st).find(([, b]) => b.type === t);
    if (k && k[1].n < E.tierCap(st) && st.debt + E.cost(t, k[1].n + 1, st.L) <= P.credit * E.limit(st) * 0.6) return upgrade(c, st, k[0]);
  }
  return false;
}
const UNLOCKS: BType[] = ["road", "trade", "hospital", "academy", "harbour", "exchange", "observatory"];
function trySystems(c: Ctx, st: IslandState, P: Strategy, late: boolean): boolean {
  const f = freeLot(st);
  const room = () => (P.credit ? P.credit * E.limit(st) - st.debt : 0);
  for (const t of UNLOCKS) {
    if (B[t].tier! > st.tier || E.countOf(st, t)) continue;
    const cc = E.cost(t, 0, st.L);
    if (st.hours - cc > 4 && (B[t].glob || f) && build(c, st, B[t].glob ? B[t].glob : f, t)) return true;
  }
  if (E.hasB(st, "academy") && !st.researching)
    for (const id of ["ledgers", "looms", "rotation", "crossbows"] as TechId[]) {
      if (st.tech[id]) continue;
      const cc = E.techCost(st, id);
      if (st.hours - cc < 4 && P.credit >= 0.8 && room() > cc) E.borrow(st, cc - st.hours + 4);
      if (st.hours - cc >= 4 && E.research(st, id)) return true;
      break;
    }
  if (!late && E.tradeCap(st) > st.caravan && st.price >= 1.25) {
    const want = E.tradeCap(st) - st.caravan;
    if (P.credit >= 0.8 && st.price >= 1.35 && room() > 0) E.borrow(st, Math.min(want, room()) * 0.5);
    if (st.hours - 8 > 0 && E.sendCaravan(st, Math.min(want, st.hours - 8))) return true;
  }
  return false;
}
/** Bot dusk choice (the prototype's "smart" bot reads the exact range). */
export function botDecision(st: IslandState, P: Strategy, kind: string): E.Decision {
  const r2 = E.raidRange(st);
  const D = E.defence(st);
  if (kind === "quiet" || !r2) return "hold";
  if (P.dusk === "borrow") return E.canBorrowDusk(st) ? "borrow" : "walls";
  if (P.dusk === "smart") return D >= r2[1] ? "hold" : E.canBorrowDusk(st) && D * 1.3 >= r2[0] ? "borrow" : "walls";
  return D >= r2[1] ? "hold" : "walls";
}
function playDay(c: Ctx, st: IslandState, P: Strategy, rnd: Roll, first: boolean): E.NightResult | undefined {
  if (first && P.tut) E.borrow(st, 10);
  if (st.day === 1 && P.d1) E.borrow(st, P.d1 * E.limit(st) - st.debt);
  if (P.daily && st.day < SEASON_DAYS) E.borrow(st, P.daily * E.limit(st));
  while (st.phase === "day") {
    const kind = DAY_KIND[st.day];
    const r = E.raidRange(st);
    const T = r ? r[1] : 0;
    const late = st.hour >= st.dayLen - 4;
    const boss = kind === "boss";
    for (let n = 0; n < 12; n++) {
      if (boss && st.debt > 0 && P.repayFrom < 99 && st.hours >= 1) {
        E.repay(st, st.hours);
        continue;
      }
      if (T && E.defence(st) < T && (late || boss)) {
        if (tryDefence(c, st)) continue;
      }
      if (st.day >= P.repayFrom && st.debt > 0 && st.hours > 3 && (!T || E.defence(st) >= T)) {
        E.repay(st, st.hours - 2);
        continue;
      }
      if (tryCredit(c, st, P)) continue;
      if (trySystems(c, st, P, late)) continue;
      if (!late) {
        if (tryEconomy(c, st, rnd)) continue;
      }
      const nk = E.raidRange(st, st.day + 1);
      if (late && nk && E.defence(st) < nk[1] && (!T || E.defence(st) >= T)) {
        if (tryDefence(c, st)) continue;
      }
      break;
    }
    const e = E.tickHour(st);
    if (e) {
      const dec = botDecision(st, P, e.kind);
      resolveDusk(c, st, dec, rnd);
      return E.night(st);
    }
  }
  return undefined;
}

export interface SeasonRecord {
  tier: number;
  won: boolean;
  growth: number;
  seized: number;
  debt: number;
}
export interface DayRecord {
  t: number;
  tier: number;
  inc: number;
  h: number;
  debt: number;
  lim: number;
  L: number;
  pop: number;
  day: number;
  seized: number;
}
export interface Campaign {
  seasons: SeasonRecord[];
  lvlDay: Record<number, number>;
  lvlInc: Record<number, number>;
  tierDay: Record<number, number>;
  days: DayRecord[];
  acts: TrackPoint[];
  breathers: { with: number; without: number }[];
  final: IslandState;
}
/** Each strategy plays its own colony from empty land. */
export function campaign(name: StrategyName, seed: number, seasons: number): Campaign {
  const st = E.newGame({ seed });
  const rnd = new Rng(seed * 7 + 3).next;
  const P = STRATS[name];
  const out: Campaign = { seasons: [], lvlDay: { 1: 0 }, lvlInc: { 1: E.income(st) }, tierDay: { 0: 0 }, days: [], acts: [], breathers: [], final: st };
  const c: Ctx = { track: out.acts, clock: 0, breathers: out.breathers };
  for (let k = 0; k < seasons; k++) {
    const t0 = st.tier;
    const w0 = E.netWorth(st) / costMul(st.L);
    const z0 = st.stats.seized;
    const dayAbs0 = k * SEASON_DAYS;
    const s0 = st.season;
    let first = k === 0;
    let res: E.NightResult["seasonEnd"] = null;
    let d = 0;
    while (st.season === s0) {
      const L0 = st.L;
      const T0 = st.tier;
      c.clock = dayAbs0 + d;
      out.days.push({ t: c.clock, tier: st.tier, inc: E.income(st), h: st.hours, debt: st.debt, lim: E.limit(st), L: st.L, pop: st.pop, day: st.day, seized: st.stats.seized });
      const n = playDay(c, st, P, rnd, first);
      first = false;
      d++;
      if (n && n.seasonEnd) res = n.seasonEnd;
      for (let l = L0 + 1; l <= st.L; l++) {
        out.lvlDay[l] = dayAbs0 + d;
        out.lvlInc[l] = E.income(st);
      }
      for (let t = T0 + 1; t <= st.tier; t++) out.tierDay[t] = dayAbs0 + d;
    }
    out.seasons.push({ tier: t0, won: !!(res && res.won), growth: E.netWorth(st) / costMul(st.L) - w0, seized: st.stats.seized - z0, debt: st.debt / E.limit(st) });
  }
  return out;
}

/** Income growth per 6-day window and gaps between meaningful advancements, per tier. */
export interface Pacing {
  win: number[];
  gaps: number[];
  days: number;
}
const MEANINGFUL = 0.01;
export function pacing(c: Campaign): (Pacing | null)[] {
  return [0, 1, 2, 3].map((t) => {
    const ds = c.days.filter((d) => d.tier === t);
    if (ds.length < 7) return null;
    const win: number[] = [];
    for (let i = SEASON_DAYS; i < ds.length; i++) win.push(ds[i].inc / ds[i - SEASON_DAYS].inc - 1);
    const t0 = ds[0].t;
    const t1 = ds[ds.length - 1].t + 1;
    const ev: number[] = [];
    const tl = c.acts
      .filter((a) => a.tier === t)
      .map((a) => ({ t: a.t, inc: a.inc, look: a.look }))
      .concat(ds.map((d) => ({ t: d.t, inc: d.inc, look: undefined })))
      .sort((x, y) => x.t - y.t);
    let base = ds[0].inc;
    tl.forEach((p) => {
      if (p.look || p.inc >= base * (1 + MEANINGFUL)) {
        ev.push(p.t);
        base = p.inc;
      }
    });
    Object.values(c.lvlDay).forEach((x) => {
      if (x > t0 && x <= t1) ev.push(x);
    });
    ev.sort((x, y) => x - y);
    const pts = [t0, ...ev];
    const gaps: number[] = [];
    for (let i = 1; i < pts.length; i++) gaps.push(pts[i] - pts[i - 1]);
    const last = t === 3 ? 0 : t1 - pts[pts.length - 1];
    if (last) gaps.push(last);
    return { win, gaps, days: ds.length };
  });
}
export { COUNT };
