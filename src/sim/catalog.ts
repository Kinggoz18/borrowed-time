/** Building catalogue for the stress scene: types, eras and looks (FINAL_PLAN_BT.md §2, ART_BIBLE.md §8). */
export const LOOK_NAMES = ["rough", "settled", "timber", "sturdy", "stone", "fine", "grand"] as const;
export type Era = "colony" | "village" | "town" | "city";

export const BUILDING_TYPES = [
  "field",
  "cottage",
  "clockworks",
  "watchtower",
  "hourglass",
  "lanternHall",
  "tradePost",
  "sunMirror",
  "academy",
  "hospital",
  "exchange",
  "harbour",
  "observatory",
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

/** Types each era can show and the looks it can reach (level caps 5 / 11 / 17 / 20). */
export const ERA_SETS: Record<Era, { types: number; looks: number }> = {
  colony: { types: 5, looks: 2 },
  village: { types: 7, looks: 4 },
  town: { types: 10, looks: 6 },
  city: { types: 13, looks: 7 },
};

/** City counts (plan §2): Field 12, Cottage 40, Clockworks 10, Watchtower 10, one of each other. */
export const CITY_COUNTS: Record<BuildingType, number> = {
  field: 12,
  cottage: 40,
  clockworks: 10,
  watchtower: 10,
  hourglass: 1,
  lanternHall: 1,
  tradePost: 1,
  sunMirror: 1,
  academy: 1,
  hospital: 1,
  exchange: 1,
  harbour: 1,
  observatory: 1,
};

/** Footprint side for a look index (0-based): looks 5-6 are 2x2, look 7 is 3x3. */
export function footprintForLook(look: number): 1 | 2 | 3 {
  if (look >= 6) return 3;
  if (look >= 4) return 2;
  return 1;
}

/** stageOf(n) = min(6, floor(n / 3)) */
export function stageOf(level: number): number {
  return Math.min(6, Math.floor(level / 3));
}

/** Max frame size per footprint on the high-tier atlas (ART_BIBLE.md §7). */
export function frameSize(n: 1 | 2 | 3): { w: number; h: number } {
  return n === 1 ? { w: 128, h: 192 } : n === 2 ? { w: 256, h: 320 } : { w: 384, h: 448 };
}

export function buildingFrameName(era: Era, type: BuildingType, look: number): string {
  return `${era}/${type}/${look}`;
}

/** Every building frame an era's atlas set must hold. */
export function eraFrames(era: Era): { type: BuildingType; look: number }[] {
  const set = ERA_SETS[era];
  const out: { type: BuildingType; look: number }[] = [];
  for (let t = 0; t < set.types; t++) for (let l = 0; l < set.looks; l++) out.push({ type: BUILDING_TYPES[t], look: l });
  return out;
}
