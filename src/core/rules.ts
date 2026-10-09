/**
 * Rule tables and curves from the v2 prototype (DESIGN_V2.md) with the build changes from
 * FINAL_PLAN_BT.md §3 (tier levels 1/3/7/11, City raid scale ×1.12). Pure data, no side effects.
 */
export const SEASON_DAYS = 6;
export const BASE_DAY = 12;
export const MAX_LEVEL = 20;
export const MIN_DAY = 7;

export type DayKind = "raid" | "boss" | "quiet";
export const DAY_KIND: Record<number, DayKind | undefined> = { 2: "raid", 4: "raid", 6: "boss" };
export const dayKind = (day: number): DayKind => DAY_KIND[day] ?? "quiet";

export interface TierDef {
  name: "Colony" | "Village" | "Town" | "City";
  lvl: number;
  pop: number;
  grid: number;
  cap: number;
  popCap: number;
  lim: number;
  threat: number;
}
/** lvl/pop = what it takes to reach the tier; cap = building level cap; lim/threat = loan and raid scale. */
export const TIERS: readonly TierDef[] = [
  { name: "Colony", lvl: 1, pop: 0, grid: 7, cap: 5, popCap: 41, lim: 1.2, threat: 1 },
  { name: "Village", lvl: 3, pop: 36, grid: 11, cap: 11, popCap: 160, lim: 1.25, threat: 0.95 },
  { name: "Town", lvl: 7, pop: 120, grid: 15, cap: 17, popCap: 500, lim: 2, threat: 1.08 },
  { name: "City", lvl: 11, pop: 380, grid: 21, cap: 20, popCap: 1600, lim: 2.8, threat: 1.12 },
];

export const PEOPLE_INC = 1.5;
export const PEOPLE_DEF = 0.6;
export const BASE_FOOD = 8;
export const BASE_HOUSE = 6;

/** Build-rule constants (sim-test.js defaults). */
export const BUILD = {
  lienDays: 12,
  rebuild: 0.5,
  upgradeXpPerStage: 1,
  salvage: 0.3,
  keep: [0.25, 0.2] as const,
  boatTop: 0.08,
  dialTop: 0.25,
  dialBase: 20,
  dialGrowth: 0.03,
  flee: 0,
} as const;

/** Cost multiplier: a Hill curve plus a slow linear tail. */
export const costMul = (L: number): number => 1 + (2.4 * L * L) / (L * L + 64) + 0.05 * L;
export const xpNeed = (L: number): number => Math.round(30 * Math.pow(L, 1.35));
export const ramp = (L: number): number => 0.68 + (0.42 * L * L) / (L * L + 16) + 0.01 * L;

export type BType =
  | "field" | "cottage" | "workshop" | "tower" | "bank" | "lantern" | "mirror" | "palisade"
  | "road" | "trade" | "academy" | "hospital" | "exchange" | "harbour" | "observatory";
type Eff = (n: number) => number;
export interface BDef {
  name: string;
  base: number;
  food?: Eff;
  house?: Eff;
  inc?: Eff;
  def?: Eff;
  keep?: Eff;
  one?: boolean;
  credit?: boolean;
  tier?: number;
  ring?: boolean;
  glob?: "pal" | "road";
}
const keep: Eff = (n) => BUILD.keep[0] + BUILD.keep[1] * n;
export const B: Record<BType, BDef> = {
  field: { name: "Field", base: 6, food: (n) => 10 + 7 * n, keep },
  cottage: { name: "Cottage", base: 7, house: (n) => 6 + 2 * n, keep },
  workshop: { name: "Clockworks", base: 10, inc: (n) => 4 + 2 * n, keep },
  tower: { name: "Watchtower", base: 9, def: (n) => 5 + 2.5 * n, keep },
  bank: { name: "Hourglass", base: 8, inc: (n) => 1 + 0.5 * n, one: true, keep },
  lantern: { name: "Lantern Hall", base: 26, inc: (n) => 10 + 3 * n, house: (n) => 20 + 6 * n, one: true, credit: true, tier: 1, keep },
  mirror: { name: "Sun Mirror", base: 34, inc: (n) => 5 + 2 * n, one: true, credit: true, tier: 2, keep },
  palisade: { name: "Palisade", base: 8, def: (n) => 6 + 3 * n, one: true, ring: true, glob: "pal" },
  road: { name: "Roads", base: 12, one: true, glob: "road", tier: 1 },
  trade: { name: "Trade Post", base: 14, inc: (n) => 1 + 0.5 * n, one: true, tier: 1, keep },
  academy: { name: "Academy", base: 20, inc: (n) => 2 + n, one: true, tier: 2, keep },
  hospital: { name: "Hospital", base: 16, one: true, tier: 2, keep },
  exchange: { name: "Exchange", base: 30, one: true, tier: 3, keep },
  harbour: { name: "Harbour", base: 26, def: (n) => 8 + 3 * n, one: true, tier: 3, keep },
  observatory: { name: "Observatory", base: 30, one: true, tier: 3, keep },
};
export const B_TYPES = Object.keys(B) as BType[];
export const LOT_TYPES = B_TYPES.filter((t) => !B[t].glob);

/** How many of each building a tier allows (Colony, Village, Town, City). */
export const COUNT: Record<BType, readonly [number, number, number, number]> = {
  field: [3, 5, 8, 12], cottage: [4, 10, 20, 40], workshop: [2, 4, 7, 10], tower: [2, 4, 7, 10],
  bank: [1, 1, 1, 1], lantern: [0, 1, 1, 1], mirror: [0, 0, 1, 1], palisade: [1, 1, 1, 1],
  road: [0, 1, 1, 1], trade: [0, 1, 1, 1], academy: [0, 0, 1, 1], hospital: [0, 0, 1, 1],
  exchange: [0, 0, 0, 1], harbour: [0, 0, 0, 1], observatory: [0, 0, 0, 1],
};

export type TechId = "ledgers" | "rotation" | "crossbows" | "looms";
export const TECH: Record<TechId, { name: string; base: number; text: string }> = {
  ledgers: { name: "Ledgers", base: 40, text: "Interest -20%" },
  rotation: { name: "Crop rotation", base: 40, text: "Food +15%" },
  crossbows: { name: "Crossbows", base: 50, text: "Defence +12%" },
  looms: { name: "Clockwork looms", base: 50, text: "Hours +10%" },
};

export type EventId = "fair" | "summer" | "lean" | "generous" | "redsails";
export const EVENTS: readonly { id: EventId; name: string; text: string }[] = [
  { id: "fair", name: "Fair winds", text: "An ordinary season. Nothing to blame." },
  { id: "summer", name: "Long summer", text: "Every day has one extra hour of light." },
  { id: "lean", name: "Lean harvest", text: "Fields feed a quarter less." },
  { id: "generous", name: "A generous Keeper", text: "Interest is lower this season." },
  { id: "redsails", name: "Red sails", text: "Raiders come stronger this season." },
];

export const LOOK_EVERY = 3;
export const LOOKS = 7;
export const LOOK_NAMES = ["rough", "settled", "timber", "sturdy", "stone", "fine", "grand"] as const;
export const stageOf = (n: number): number => Math.min(LOOKS - 1, Math.floor(n / LOOK_EVERY));

/** Big looks spread into free lots behind them: 2×2 from look 5, 3×3 at look 7. */
export const FOOT: Partial<Record<BType, readonly number[]>> = {
  field: [0, 0, 0, 0, 2, 2, 3], workshop: [0, 0, 0, 0, 2, 2, 3], tower: [0, 0, 0, 0, 0, 2, 2],
  bank: [0, 0, 0, 0, 2, 2, 3], lantern: [0, 0, 0, 0, 2, 2, 3], mirror: [0, 0, 0, 0, 2, 2, 3],
  trade: [0, 0, 0, 0, 2, 2, 3], academy: [0, 0, 0, 0, 2, 2, 3], hospital: [0, 0, 0, 0, 2, 2, 3],
  exchange: [0, 0, 0, 0, 2, 2, 3], harbour: [0, 0, 0, 0, 2, 2, 3], observatory: [0, 0, 0, 0, 2, 2, 3],
};

export const RAID_K: Record<number, readonly [number, number]> = { 2: [0.45, 5], 4: [0.65, 7] };
export const BOSS_K = [0.78, 8] as const;
export const THREAT_EXP = 0.63;

export function lotKeys(tier: number): string[] {
  const r = (TIERS[tier].grid - 1) / 2;
  const out: string[] = [];
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (i || j) out.push(i + "," + j);
  return out;
}
export const kij = (k: string): [number, number] => {
  const [i, j] = k.split(",").map(Number);
  return [i, j];
};
