/**
 * Borrowed Time rules: a line-by-line port of the prototype core (prototype.html, CORE block)
 * with the build patches that sim-test.js applies under RULES=build. Pure: every function reads
 * or mutates only the IslandState it is given. Numeric operation order is kept identical to the
 * prototype on purpose, so campaigns match it bit for bit (tests/parity.test.ts).
 */
import { step, seedState, type Roll } from "./rng";
import { raidKind, tacticOf, type RaidKind, type RaidTactic } from "./raiders";
import {
  B, BASE_DAY, BASE_FOOD, BASE_HOUSE, BOSS_K, BUILD, COUNT, DAY_KIND, EVENTS, FOOT, MAX_LEVEL, MIN_DAY,
  PEOPLE_DEF, PEOPLE_INC, RAID_K, SEASON_DAYS, TECH, THREAT_EXP, TIERS, costMul, kij, lotKeys, ramp,
  stageOf, xpNeed, type BType, type TechId,
} from "./rules";
import { blockOf, GATE_LINE, physRadius, streetAt } from "./streets";
import { landmarkDef, LANDMARKS, plazaKey } from "./landmarks";
import type { Building, Glob, IslandState } from "./state";

export { dayKind } from "./rules";

// ---------- randomness carried in the state ----------
export function rand(st: IslandState): number {
  const [v, s] = step(st.rngS);
  st.rngS = s;
  return v;
}
export const stateRoll = (st: IslandState): Roll => () => rand(st);

// ---------- basic queries ----------
export function blds(st: IslandState): [string, Building][] {
  const out: [string, Building][] = [];
  for (const k in st.lots) {
    const b = st.lots[k];
    if (b) out.push([k, b]);
  }
  return out;
}
export const hasB = (st: IslandState, t: BType): boolean => blds(st).some(([, b]) => b.type === t);
export function lvOf(st: IslandState, t: BType): number {
  const g = B[t].glob;
  if (g) return st[g] ? (st[g] as Glob).n : -1;
  let m = -1;
  for (const k in st.lots) {
    const b = st.lots[k];
    if (b && b.type === t && b.n > m) m = b.n;
  }
  return m;
}
export const countOf = (st: IslandState, t: BType): number => {
  const g = B[t].glob;
  return g ? (st[g] ? 1 : 0) : blds(st).filter(([, b]) => b.type === t).length;
};
export const tierCap = (st: IslandState): number => TIERS[st.tier].cap;
export const cost = (type: BType, n: number, L: number): number => Math.round(B[type].base * (1 + 0.45 * n) * costMul(L));

// ---------- footprint claims (2×2 / 3×3 into free lots behind) ----------
let claimSig: string | null = null;
let claimVal: { owner: Record<string, string>; size: Record<string, number> } = { owner: {}, size: {} };
export function claims(st: IslandState): { owner: Record<string, string>; size: Record<string, number> } {
  let sig = st.tier + ":" + (st.landmarks ? JSON.stringify(st.landmarks) : "");
  for (const k in st.lots) {
    const b = st.lots[k];
    if (b) sig += k + b.type[0] + b.n + ";";
  }
  if (claimSig === sig) return claimVal;
  const owner: Record<string, string> = {};
  const size: Record<string, number> = {};
  const list = blds(st)
    .filter(([, b]) => FOOT[b.type] && FOOT[b.type]![stageOf(b.n)])
    .sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1));
  for (const [k, b] of list) {
    const [i, j] = kij(k);
    for (let f = FOOT[b.type]![stageOf(b.n)]; f >= 2; f--) {
      const t: string[] = [];
      let ok = true;
      for (let a = 0; a < f && ok; a++)
        for (let c = 0; c < f; c++) {
          if (!a && !c) continue;
          const q = i - a + "," + (j - c);
          // a footprint stays inside one city block: it never reaches across a street (core/streets.ts)
          if (st.lots[q] !== null || owner[q] || lmLot(st, q) || blockOf(i - a) !== blockOf(i) || blockOf(j - c) !== blockOf(j)) {
            ok = false;
            break;
          }
          t.push(q);
        }
      if (ok) {
        t.forEach((q) => (owner[q] = k));
        size[k] = f;
        break;
      }
    }
  }
  claimSig = sig;
  claimVal = { owner, size };
  return claimVal;
}
export const isFree = (st: IslandState, k: string | undefined): boolean =>
  k !== undefined && st.lots[k] === null && !claims(st).owner[k] && !lmLot(st, k);

// ---------- landmarks (cosmetic) and moving a building ----------
/** True when a placed landmark stands on this lot (a landmark takes the lot, nothing else about it). */
export function lmLot(st: IslandState, k: string): boolean {
  if (!st.landmarks) return false;
  for (const id in st.landmarks) if (st.landmarks[id] === k) return true;
  return false;
}
/** Landmarks this settlement has unlocked (Town: three, City: three more). */
export const unlockedLandmarks = (st: IslandState) => LANDMARKS.filter((l) => l.tier <= st.tier);
/** Plaza tiles (street crossings in the built area) a landmark may stand on; the avenue to the gate stays clear. */
export function plazaSpots(st: IslandState): string[] {
  const r = (TIERS[st.tier].grid - 1) / 2;
  const R = physRadius(r);
  const out: string[] = [];
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) if (j !== GATE_LINE && streetAt(i, j, r) === "plaza") out.push(plazaKey(i, j));
  return out;
}
/** Free spots for a landmark: free lots and unoccupied plaza tiles. */
export function landmarkSpots(st: IslandState, id: string): string[] {
  const taken = new Set(Object.entries(st.landmarks ?? {}).filter(([k]) => k !== id).map(([, v]) => v));
  const lots = Object.keys(st.lots).filter((k) => isFree(st, k) || st.landmarks?.[id] === k).filter((k) => k !== "0,0" && !taken.has(k));
  return [...lots, ...plazaSpots(st).filter((k) => !taken.has(k))];
}
export function canPlaceLandmark(st: IslandState, id: string, at: string): boolean {
  const d = landmarkDef(id);
  if (!d || d.tier > st.tier || st.phase !== "day") return false;
  if (st.landmarks?.[id] === at) return false;
  return landmarkSpots(st, id).includes(at);
}
/** Places a landmark, or moves it (free). One of each. */
export function placeLandmark(st: IslandState, id: string, at: string): boolean {
  if (!canPlaceLandmark(st, id, at)) return false;
  (st.landmarks ??= {})[id] = at;
  return true;
}
export function removeLandmark(st: IslandState, id: string): boolean {
  if (!st.landmarks || !(id in st.landmarks)) return false;
  delete st.landmarks[id];
  if (!Object.keys(st.landmarks).length) delete st.landmarks;
  return true;
}

/** Moving a built building costs a quarter of what its first level costs. */
export const MOVE_FEE = 0.25;
export const moveFee = (st: IslandState, key: string): number => {
  const b = st.lots[key];
  return b ? Math.max(1, Math.round(MOVE_FEE * cost(b.type, 0, st.L))) : 0;
};
/** Why a building can't be moved right now, or null when it can. */
export function moveBlock(st: IslandState, from: string, to?: string): "night" | "none" | "same" | "taken" | "hours" | null {
  if (st.phase !== "day") return "night";
  if (!st.lots[from]) return "none";
  if (st.hours < moveFee(st, from)) return "hours";
  if (to === undefined) return null;
  if (to === from) return "same";
  if (!isFree(st, to)) return "taken";
  return null;
}
/** Moves a building (level and everything else kept) to a free lot for a small fee in Hours. Takes effect at once. */
export function moveBuilding(st: IslandState, from: string, to: string): boolean {
  if (moveBlock(st, from, to) !== null) return false;
  const fee = moveFee(st, from);
  st.hours -= fee;
  st.lots[to] = st.lots[from];
  st.lots[from] = null;
  return true;
}

// ---------- grey (lent) land ----------
const GO_CACHE: Record<number, string[]> = {};
const GS_CACHE = new Map<number, Set<string>>();
export function greyOrder(st: IslandState): string[] {
  const n = Object.keys(st.lots).length;
  if (GO_CACHE[n]) return GO_CACHE[n];
  return (GO_CACHE[n] = Object.keys(st.lots).sort((a, b) => {
    const [ai, aj] = kij(a);
    const [bi, bj] = kij(b);
    return bi + bj - (ai + aj) || ai - bi;
  }));
}
export function greyCount(st: IslandState): number {
  return st.debt <= 0 ? 0 : Math.ceil(Math.min(1, st.debt / limit(st)) * Object.keys(st.lots).length);
}
export function greySet(st: IslandState): Set<string> {
  const c = greyCount(st);
  const n = Object.keys(st.lots).length;
  const key = n * 1000 + c;
  let g = GS_CACHE.get(key);
  if (!g) {
    g = new Set(greyOrder(st).slice(0, c));
    GS_CACHE.set(key, g);
  }
  return g;
}
export const greyFrac = (st: IslandState): number => Math.min(1, st.debt / limit(st));

type EffKey = "food" | "house" | "inc" | "def" | "keep";
export function sumEff(st: IslandState, f: EffKey): number {
  const g = greySet(st);
  let s = 0;
  for (const [k, b] of blds(st)) {
    const e = B[b.type][f];
    if (e) s += e(b.n) * (g.has(k) ? 0.5 : 1);
  }
  return s;
}

// ---------- economy ----------
export const limit = (st: IslandState): number =>
  Math.round(45 * costMul(st.L) * TIERS[st.tier].lim * (hasB(st, "exchange") ? 1.15 + 0.01 * lvOf(st, "exchange") : 1));
export function rate(st: IslandState): number {
  let r = 0.25;
  if (hasB(st, "bank")) r /= 2;
  if (st.event === "generous") r *= 0.6;
  if (st.tech && st.tech.ledgers) r *= 0.8;
  if (hasB(st, "exchange")) r *= 0.7 - 0.01 * lvOf(st, "exchange");
  return r;
}
export const food = (st: IslandState): number =>
  (BASE_FOOD + sumEff(st, "food")) * (st.event === "lean" ? 0.75 : 1) * (st.tech && st.tech.rotation ? 1.15 : 1);
export const housing = (st: IslandState): number => BASE_HOUSE + sumEff(st, "house");
export const popRoom = (st: IslandState): number => Math.min(Math.floor(housing(st)), TIERS[st.tier].popCap);
export const fed = (st: IslandState): number => Math.min(st.pop, Math.floor(food(st)));
export const peopleInc = (st: IslandState): number => PEOPLE_INC * Math.sqrt(fed(st));
export const peopleDef = (st: IslandState): number => PEOPLE_DEF * Math.sqrt(fed(st));
export const roadMul = (st: IslandState): number => (st.road ? 1.05 + 0.01 * st.road.n : 1);
export const dialBonus = (st: IslandState): number => BUILD.dialTop * (1 - Math.exp(-(st.dial || 0) / 30));
/** Hours a day. Build curve: every building keeps a little of the day; captured boats fish. */
export const income = (st: IslandState): number =>
  (4 + peopleInc(st) + (sumEff(st, "inc") + sumEff(st, "keep")) * roadMul(st) * 1) *
  (st.tech && st.tech.looms ? 1.1 : 1) *
  (1 + dialBonus(st) + BUILD.boatTop * (1 - Math.exp(-(st.boats || 0) / 25)));
export const duskMul = (st: IslandState): number => (hasB(st, "harbour") ? 1.5 : 1.3);
export function defence(st: IslandState, o: { walls?: boolean; borrow?: boolean } = {}): number {
  let d = (st.pal ? B.palisade.def!(st.pal.n) : 0) + sumEff(st, "def") + peopleDef(st) * (o.walls ? 2 : 1);
  if (st.tech && st.tech.crossbows) d *= 1.12;
  if (o.borrow) d *= duskMul(st);
  return Math.round(d);
}
export function dayLength(st: IslandState, short: number): number {
  let d = BASE_DAY - short;
  if (st.event === "summer") d++;
  if (hasB(st, "mirror")) d++;
  return Math.max(MIN_DAY, d);
}
export function netWorth(st: IslandState): number {
  let v = st.hours + st.caravan - st.debt + (st.pal ? st.pal.inv : 0) + (st.road ? st.road.inv : 0);
  for (const [, b] of blds(st)) v += b.inv;
  return v;
}

// ---------- raids ----------
export const wealth = (st: IslandState): number =>
  st.hours + st.caravan + (st.pal ? st.pal.inv : 0) + (st.road ? st.road.inv : 0) + blds(st).reduce((a, [, b]) => a + b.inv, 0);
export const bossDebtK = (st: IslandState): number => {
  const k = BUILD.bossDebtTier[st.tier] === 1 ? BUILD.bossDebt : BUILD.bossDebt * BUILD.bossDebtTier[st.tier];
  return hasB(st, "observatory") ? k * (0.6 - 0.01 * lvOf(st, "observatory")) : k;
};
function nominalRaw(st: IslandState, day: number): number {
  const kind = DAY_KIND[day];
  if (!kind) return 0;
  const ev =
    (st.event === "redsails" ? 1.2 : 1) * ramp(st.L) * TIERS[st.tier].threat * (st.breather && kind === "raid" ? 0.8 : 1);
  const w = Math.pow(Math.max(0, wealth(st)) / costMul(st.L), THREAT_EXP);
  if (kind === "boss")
    return Math.round(
      (BOSS_K[0] * w + BOSS_K[1] + (bossDebtK(st) * (day === st.day ? Math.max(st.debt, st.dawnDebt || 0) : st.debt)) / costMul(st.L)) * ev,
    );
  return Math.round((RAID_K[day][0] * w + RAID_K[day][1]) * ev);
}
/** Nominal raider strength. Build rule: an ordinary raid grows at most 25% faster than income since the same raid last season. */
export function nominal(st: IslandState, day = st.day): number {
  let n = nominalRaw(st, day);
  const m = st.raidMem[day];
  if (DAY_KIND[day] === "raid" && m && m.tier === st.tier) n = Math.min(n, Math.round(m.n * 1.25 * Math.max(1, income(st) / m.inc)));
  return n;
}
export const spread = (st: IslandState, day = st.day): number => (DAY_KIND[day] === "boss" && hasB(st, "observatory") ? 0.05 : 0.15);
export const raidRange = (st: IslandState, day = st.day): [number, number] | null => {
  const s = nominal(st, day);
  const p = spread(st, day);
  return s ? [Math.round(s * (1 - p)), Math.round(s * (1 + p))] : null;
};

// ---------- actions ----------
function affordable(st: IslandState, type: BType, n: number): boolean {
  const c = cost(type, n, st.L);
  return B[type].credit ? st.debt + c <= limit(st) : st.hours >= c;
}
export { affordable };
export function canBuild(st: IslandState, key: string | undefined, type: BType): boolean {
  const b = B[type];
  if (b.tier && st.tier < b.tier) return false;
  if (b.glob) return !st[b.glob] && affordable(st, type, 0);
  if (!isFree(st, key) || countOf(st, type) >= COUNT[type][st.tier]) return false;
  return affordable(st, type, 0);
}
function pay(st: IslandState, type: BType, n: number): number {
  const c = cost(type, n, st.L);
  if (B[type].credit) {
    st.debt += c;
    st.stats.borrowed += c;
  } else st.hours -= c;
  return c;
}
export function gainXP(st: IslandState, x: number): number[] {
  st.xp += x;
  const ups: number[] = [];
  while (st.L < MAX_LEVEL && st.xp >= xpNeed(st.L)) {
    st.xp -= xpNeed(st.L);
    st.L++;
    st.stats.levelUps++;
    ups.push(st.L);
  }
  return ups;
}
export function build(st: IslandState, key: string | undefined, type: BType): boolean {
  if (!canBuild(st, key, type)) return false;
  const c = pay(st, type, 0);
  const g = B[type].glob;
  if (g) st[g] = { n: 0, inv: c };
  else st.lots[key!] = { type, n: 0, inv: c };
  gainXP(st, 2);
  return true;
}
export const bAt = (st: IslandState, key: string): Building | Glob | null =>
  key === "pal" || key === "road" ? st[key] : st.lots[key] ?? null;
export const typeAt = (st: IslandState, key: string): BType | null =>
  key === "pal" ? "palisade" : key === "road" ? "road" : st.lots[key]?.type ?? null;
export function canUpgrade(st: IslandState, key: string): boolean {
  const b = bAt(st, key);
  return !!b && b.n < tierCap(st) && affordable(st, typeAt(st, key)!, b.n + 1);
}
export function upgrade(st: IslandState, key: string): boolean {
  if (!canUpgrade(st, key)) return false;
  const b = bAt(st, key)! as Building;
  const type = typeAt(st, key)!;
  const paid = pay(st, type, b.n + 1);
  b.inv += paid;
  // the frames still stand: a level knocked off by a raid is rebuilt at half price
  if (b.lost! > 0) {
    b.lost!--;
    const back = Math.floor(paid * BUILD.rebuild);
    if (B[type].credit) st.debt -= back;
    else st.hours += back;
    b.inv -= back;
  }
  b.n++;
  gainXP(st, 1 + Math.round(BUILD.upgradeXpPerStage * stageOf(b.n)));
  return true;
}
export function borrow(st: IslandState, x: number): number {
  x = Math.min(Math.round(x), limit(st) - st.debt);
  if (x <= 0) return 0;
  st.debt += x;
  st.hours += x;
  st.stats.borrowed += x;
  // borrowed time is literal: today gets longer, tomorrow shorter
  const dl = Math.min(3, Math.floor(x / (5 * costMul(st.L))));
  st.dayLen += dl;
  st.shortTomorrow += dl;
  return x;
}
export function repay(st: IslandState, x: number): number {
  x = Math.min(Math.floor(x), Math.floor(st.hours), st.debt);
  if (x <= 0) return 0;
  st.debt -= x;
  st.hours -= x;
  st.stats.repaid += x;
  return x;
}
export const techCost = (st: IslandState, id: TechId): number =>
  Math.round(TECH[id].base * costMul(st.L) * (1 - 0.02 * Math.max(0, lvOf(st, "academy"))));
export function research(st: IslandState, id: TechId): boolean {
  if (!hasB(st, "academy") || st.tech[id] || st.researching || st.hours < techCost(st, id)) return false;
  st.hours -= techCost(st, id);
  st.researching = id;
  return true;
}
export const tradeCap = (st: IslandState): number =>
  hasB(st, "trade") ? Math.round((10 + 3 * lvOf(st, "trade")) * costMul(st.L) * TIERS[st.tier].lim) : 0;
export function sendCaravan(st: IslandState, x: number): number {
  x = Math.min(Math.floor(x), Math.floor(st.hours), tradeCap(st) - st.caravan);
  if (x <= 0) return 0;
  st.hours -= x;
  st.caravan += x;
  return x;
}
/** The Great Dial (City): paid in your own Hours only. */
export const dialCost = (st: IslandState): number =>
  Math.round(BUILD.dialBase * (1 + BUILD.dialGrowth * (st.dial || 0)) * costMul(st.L));
export function buildDial(st: IslandState): boolean {
  if (st.tier < 3 || st.hours < dialCost(st)) return false;
  st.hours -= dialCost(st);
  st.dial = (st.dial || 0) + 1;
  gainXP(st, 1 + Math.round(BUILD.upgradeXpPerStage * Math.min(6, Math.floor(st.dial / 3))));
  return true;
}

// ---------- the day ----------
export function newGame(o: { seed?: number } = {}): IslandState {
  const seed = o.seed || 1;
  const st: IslandState = {
    seed, rngS: seedState(seed * 97 + 13), L: 1, xp: 0, tier: 0, hours: 8, debt: 0, pop: 6, lots: {}, pal: null, road: null,
    tech: {}, researching: null, caravan: 0, price: 1, day: 1, hour: 0, dayLen: BASE_DAY, shortTomorrow: 0, season: 1,
    event: "fair", phase: "day",
    stats: { borrowed: 0, repaid: 0, interest: 0, seized: 0, raidsWon: 0, raidsLost: 0, bossWon: 0, bossLost: 0, levelUps: 0, tierUps: 0 },
    noMorning: false, dawnDebt: 0, breather: false, seizedSeason: 0, lien: 0, boats: 0, dial: 0, raidMem: {}, bossResult: null,
  };
  for (const k of lotKeys(0)) st.lots[k] = null;
  startSeason(st);
  return st;
}
function startSeason(st: IslandState): void {
  st.event = EVENTS[Math.floor(rand(st) * EVENTS.length)].id;
  st.dawnDebt = 0;
  st.day = 1;
  st.hour = 0;
  st.dayLen = dayLength(st, 0);
}
export interface DuskCall {
  dusk: true;
  kind: "raid" | "boss" | "quiet";
}
export function tickHour(st: IslandState): DuskCall | null {
  if (st.phase !== "day") return null;
  st.hours += income(st) / BASE_DAY;
  st.hour++;
  if (st.hour >= st.dayLen) {
    st.phase = "dusk";
    return { dusk: true, kind: DAY_KIND[st.day] || "quiet" };
  }
  return null;
}

export type Decision = "hold" | "borrow" | "walls";
export const duskLoan = (st: IslandState): number => Math.round(0.2 * limit(st));
export const canBorrowDusk = (st: IslandState): boolean => limit(st) - st.debt >= duskLoan(st);

export interface Damage {
  k: string;
  type: BType;
  levels?: number;
  destroyed?: boolean;
}
export interface RaidResult {
  day: number;
  season: number;
  boss: boolean;
  quiet?: false;
  kind: RaidKind;
  S: number;
  D: number;
  decision: Decision;
  won: boolean;
  loot: number;
  stolen: number;
  damaged: Damage[];
  villagersLost: number;
  saved?: number;
  boat?: boolean;
}
export interface QuietResult {
  day: number;
  quiet: true;
}
export type DuskResult = RaidResult | QuietResult;

/**
 * The night's fight, given the actual raider strength S (already rolled). Shared by the game,
 * the bots and resolveRaid(snapshot, strength, seed).
 */
function hitOrder(st: IslandState, tac: RaidTactic): string[] {
  if (tac.richestFirst) {
    return blds(st)
      .slice()
      .sort((a, b) => b[1].n - a[1].n || b[1].inv - a[1].inv || (a[0] < b[0] ? -1 : 1))
      .map(([k]) => k);
  }
  const go = greyOrder(st);
  const g = go.slice(0, greyCount(st)).filter((k) => st.lots[k]);
  const rest = go.filter((k) => st.lots[k] && !g.includes(k));
  const out = [...g];
  for (let i = 0; i < tac.greyBias; i++) out.push(...g);
  return out.concat(rest);
}

export function fight(st: IslandState, decision: Decision, S: number): RaidResult {
  const kind = raidKind(st);
  const tac = tacticOf(st, kind);
  const S1 = Math.round(S * tac.scale);
  const boss = DAY_KIND[st.day] === "boss";
  const D = defence(st, { walls: decision === "walls", borrow: decision === "borrow" });
  const ev: RaidResult = { day: st.day, season: st.season, boss, kind, S: S1, D, decision, won: D >= S1, loot: 0, stolen: 0, damaged: [], villagersLost: 0 };
  if (ev.won) {
    // salvage: repelled raiders leave the hours they carried; in borrowed light we find more
    ev.loot = Math.round((0.12 * income(st) + BUILD.salvage * S1 + 2) * (decision === "borrow" ? 1.5 : 1) * tac.lootMul);
    st.hours += ev.loot;
    if (boss) st.stats.bossWon++;
    else st.stats.raidsWon++;
    gainXP(st, boss ? 20 + 2 * st.L : 8 + st.L);
  } else {
    if (boss) st.stats.bossLost++;
    else st.stats.raidsLost++;
    gainXP(st, boss ? 6 : 3);
    const f = Math.min(1, (S1 - D) / S1) * (boss ? 1.5 : 1);
    const hosp = hasB(st, "hospital");
    const heal = hosp ? 0.4 + 0.02 * lvOf(st, "hospital") : 0;
    ev.stolen = Math.round(Math.min(st.hours, f * income(st) * (hosp ? 0.8 : 1) * tac.stealMul));
    st.hours -= ev.stolen;
    // raiders run the roads; the hospital patches grey land; grey land is hit first unless a type says otherwise
    let hits = Math.ceil(f * (4 + 2 * st.tier) * tac.hitMul) + (st.road ? 1 : 0) - (hosp ? 1 : 0);
    if (tac.maxHits != null) hits = Math.min(hits, tac.maxHits);
    if (tac.palisadeFirst && hits > 0 && st.pal && st.pal.n > 0) {
      st.pal.n--;
      ev.damaged.push({ k: "pal", type: "palisade", levels: 1 });
      hits--;
    }
    const order = hitOrder(st, tac);
    for (const k of order) {
      if (hits <= 0) break;
      const b = st.lots[k];
      if (!b) continue;
      if (b.n === 0) {
        if (boss) {
          st.lots[k] = null;
          ev.damaged.push({ k, type: b.type, destroyed: true });
        } else ev.damaged.push({ k, type: b.type, levels: 0 });
      } else {
        b.n--;
        b.inv *= 0.9;
        b.lost = (b.lost || 0) + 1;
        ev.damaged.push({ k, type: b.type, levels: 1 });
      }
      hits--;
    }
    if (hits > 0 && st.pal && st.pal.n > 0) {
      st.pal.n--;
      ev.damaged.push({ k: "pal", type: "palisade", levels: 1 });
    }
    ev.villagersLost = Math.min(st.pop - 1, Math.ceil(f * 0.08 * st.pop * (decision === "walls" ? 2 : 1) * (boss ? 2 : 1) * (1 - heal)));
    ev.saved = hosp ? Math.round(f * 0.08 * st.pop * (decision === "walls" ? 2 : 1) * (boss ? 2 : 1) * heal) : 0;
    st.pop -= ev.villagersLost;
  }
  return ev;
}

/** The decision's own effects: the dusk loan (falls back to hold without headroom) or the walls. */
export function applyDecision(st: IslandState, decision: Decision): Decision {
  if (decision === "borrow") {
    if (canBorrowDusk(st)) {
      const x = duskLoan(st);
      st.debt += x;
      st.hours += x;
      st.stats.borrowed += x;
      st.shortTomorrow += 1;
    } else decision = "hold";
  }
  if (decision === "walls") st.noMorning = true;
  return decision;
}

/** Dusk: the player's decision, then the fight. `roll` rolls the actual strength inside ±spread. */
export function resolveDusk(st: IslandState, decision: Decision = "hold", roll: Roll = stateRoll(st)): DuskResult {
  const day = st.day;
  const kind = DAY_KIND[day] || "quiet";
  const n0 = kind === "raid" ? nominal(st) : 0;
  const inc0 = income(st);
  st.phase = "night";
  if (kind === "quiet") return { day, quiet: true };
  decision = applyDecision(st, decision);
  const S = Math.round(nominal(st) * (1 - spread(st) + 2 * spread(st) * roll()));
  const ev = fight(st, decision, S);
  if (kind === "raid") st.breather = !ev.won;
  else st.breather = true; // breathers after spikes
  if (kind === "boss") st.bossResult = { season: st.season, won: ev.won };
  if (n0) st.raidMem[day] = { n: n0, inc: inc0, tier: st.tier };
  // a held night leaves a Late boat on our beach; it moors at the docks and fishes
  if (ev.won) {
    st.boats = (st.boats || 0) + 1;
    ev.boat = true;
  }
  return ev;
}

export interface Seizure {
  k: string;
  type: BType;
  n: number;
  credit: number;
}
export interface NightResult {
  interest: number;
  seized: Seizure | null;
  servant?: number;
  fled?: number;
  researched?: TechId;
  caravan?: number;
  stake?: number;
  ups: number[];
  tierUp: number | null;
  left: number;
  arrived?: number;
  morning: number;
  seasonEnd: { season: number; won: boolean; clean: boolean } | null;
}
export const absDay = (st: IslandState): number => st.season * SEASON_DAYS + st.day;

/** Night: interest, default (seizure), research, caravans, XP; then morning: people, bonus, growth. */
export function night(st: IslandState): NightResult {
  const ev: NightResult = { interest: 0, seized: null, ups: [], tierUp: null, left: 0, morning: 0, seasonEnd: null };
  if (st.debt > 0) {
    ev.interest = Math.ceil(st.debt * rate(st));
    st.debt += ev.interest;
    st.stats.interest += ev.interest;
  }
  if (st.debt > limit(st)) {
    // default: the Clockkeeper seizes the most valuable building, grey land first
    const g = greySet(st);
    let best: { k: string; b: Building; score: number } | null = null;
    for (const [k, b] of blds(st)) {
      const score = b.inv + (g.has(k) ? 1e6 : 0);
      if (!best || score > best.score) best = { k, b, score };
    }
    if (best) {
      const credit = Math.round(best.b.inv * 0.6);
      st.lots[best.k] = null;
      st.debt = Math.max(0, st.debt - credit);
      ev.seized = { k: best.k, type: best.b.type, n: best.b.n, credit };
      st.stats.seized++;
      ev.fled = Math.min(st.pop - 1, Math.ceil(BUILD.flee * st.pop));
      st.pop -= ev.fled;
      // Hesper's seal: the dial won't overflow under it
      st.lien = absDay(st) + BUILD.lienDays;
      st.seizedSeason = (st.seizedSeason || 0) + 1;
    } else {
      st.debt = limit(st);
      if (st.pop > 1) {
        ev.servant = Math.min(st.pop - 1, Math.max(1, Math.round(st.pop * 0.03)));
        st.pop -= ev.servant;
      }
    }
  }
  if (st.researching) {
    st.tech[st.researching] = true;
    ev.researched = st.researching;
    st.researching = null;
  }
  if (st.caravan) {
    ev.caravan = Math.round(st.caravan * st.price * (0.75 + 0.3 * rand(st)));
    ev.stake = st.caravan;
    st.hours += ev.caravan;
    st.caravan = 0;
  }
  st.price = Math.round((0.75 + 0.7 * rand(st)) * 100) / 100;
  ev.ups = gainXP(st, 4 + st.L);
  if (st.day >= SEASON_DAYS) {
    const boss = st.bossResult && st.bossResult.season === st.season ? st.bossResult : null;
    ev.seasonEnd = { season: st.season, won: !!(boss && boss.won), clean: !st.seizedSeason };
    st.seizedSeason = 0;
    st.season++;
    startSeason(st);
  } else {
    st.day++;
    st.hour = 0;
    st.dayLen = dayLength(st, st.shortTomorrow);
    // Hesper's ledger closes at dawn on the last day
    st.dawnDebt = DAY_KIND[st.day] === "boss" ? st.debt : 0;
  }
  st.shortTomorrow = 0;
  // morning: people arrive or leave (the hungry and the homeless leave at dawn)
  const tgt = Math.min(popRoom(st), Math.floor(food(st)));
  const keepN = Math.min(Math.floor(food(st)), popRoom(st));
  if (st.pop > keepN && st.pop > 1) {
    ev.left = Math.min(st.pop - 1, Math.max(1, Math.ceil((st.pop - keepN) / 2)));
    st.pop -= ev.left;
  } else if (st.pop < tgt) {
    let g = Math.max(1, Math.ceil((tgt - st.pop) / 2));
    if (st.tier === 0) g = Math.min(g, 8);
    st.pop += g;
    ev.arrived = g;
  }
  ev.morning = st.noMorning ? 0 : Math.round(income(st) * 0.3);
  st.hours += ev.morning;
  st.noMorning = false;
  const nx = TIERS[st.tier + 1];
  if (nx && canGrow(st)) {
    st.tier++;
    for (const k of lotKeys(st.tier)) if (!(k in st.lots)) st.lots[k] = null;
    ev.tierUp = st.tier;
    st.stats.tierUps++;
  }
  st.phase = "day";
  return ev;
}

/** The kept years overflow when the colony has lived enough (level) and is big enough (people); lent hours are not kept. */
export function growthNeeds(st: IslandState): { level: boolean; people: boolean; kept: boolean; seal: boolean; next: (typeof TIERS)[number] | null } {
  const nx = TIERS[st.tier + 1] ?? null;
  return {
    next: nx,
    level: !!nx && st.L >= nx.lvl,
    people: !!nx && st.pop >= nx.pop,
    kept: st.debt <= limit(st),
    seal: (st.lien || 0) <= absDay(st),
  };
}
export function canGrow(st: IslandState): boolean {
  const g = growthNeeds(st);
  return !!g.next && g.level && g.people && g.kept && g.seal;
}
