/** What a quality tier turns on. Presets and auto-detection live in perf/quality.ts. */
export type Tier = "low" | "mid" | "high";
export type Mode = "loop" | "worst" | "throttle";

export interface TierConfig {
  tier: Tier;
  /** Render resolution cap (plan §5: DPR 2 max). */
  dprCap: number;
  bloom: boolean;
  /** Bloom chain resolution (half resolution, plan §5). */
  bloomResolution: number;
  particles: number;
  villagers: number;
  raiders: number;
  boats: number;
  /** Paper puppets on pins (6 parts each); off = baked 2-frame poses (ART_BIBLE.md §10). */
  puppets: boolean;
  /** Which atlas export to load. */
  atlas: "high" | "low";
  /** Texture memory budget in MB (plan §5). */
  budgetMB: number;
}

export interface Scenario {
  mode: Mode;
  /** The gate's 48 crowd clusters (~1,600 figures). Off = only the shipped design's sampled figures. */
  crowd: boolean;
  seed: number;
  /** Throttle-check length in minutes (10 by default). */
  minutes: number;
}
