import type { BType, EventId, TechId } from "./rules";

export interface Building {
  type: BType;
  n: number;
  inv: number;
  /** Levels knocked off by raids, rebuilt at half price. */
  lost?: number;
}
export interface Glob {
  n: number;
  inv: number;
}
export interface Stats {
  borrowed: number;
  repaid: number;
  interest: number;
  seized: number;
  raidsWon: number;
  raidsLost: number;
  bossWon: number;
  bossLost: number;
  levelUps: number;
  tierUps: number;
}
export type Phase = "day" | "dusk" | "night";

/** The whole island. Plain JSON: saving is `JSON.stringify`, nothing else. */
export interface IslandState {
  seed: number;
  /** xorshift state (see rng.ts). */
  rngS: number;
  L: number;
  xp: number;
  tier: number;
  hours: number;
  debt: number;
  pop: number;
  /** Lot key "i,j" → building or null (free). Key order matters: it is insertion order. */
  lots: Record<string, Building | null>;
  pal: Glob | null;
  road: Glob | null;
  tech: Partial<Record<TechId, true>>;
  researching: TechId | null;
  caravan: number;
  price: number;
  day: number;
  hour: number;
  dayLen: number;
  shortTomorrow: number;
  season: number;
  event: EventId;
  phase: Phase;
  stats: Stats;
  noMorning: boolean;
  dawnDebt: number;
  breather: boolean;
  seizedSeason: number;
  /** Hesper's seal: no growth until this absolute day (season·6 + day). */
  lien: number;
  boats: number;
  dial: number;
  raidMem: Record<number, { n: number; inc: number; tier: number }>;
  /** The latest Long Dusk result (replaces the prototype's log scan). */
  bossResult: { season: number; won: boolean } | null;
}
