/**
 * The Build sheet's content, as data: what shows for a tier, grouped by what it does.
 * Pure (no DOM), so the grouping and the "locked items stay hidden" rule are unit-tested.
 */
import { B, TIERS, type BType } from "../core/rules";

export interface BuildGroup {
  id: string;
  title: string;
  types: BType[];
}

/** Order inside a group is the order they appear in the sheet. */
export const BUILD_GROUPS: readonly BuildGroup[] = [
  { id: "defence", title: "Defence", types: ["palisade", "tower", "harbour"] },
  { id: "dwellings", title: "Dwellings", types: ["cottage", "lantern"] },
  { id: "food", title: "Food and farming", types: ["field"] },
  { id: "trade", title: "Trade and industry", types: ["workshop", "bank", "trade", "mirror", "exchange"] },
  { id: "civic", title: "Civic and roads", types: ["road", "academy", "hospital", "observatory"] },
];

export const tierOf = (t: BType): number => B[t].tier ?? 0;

/** Groups with only what this settlement tier has unlocked and the UI can build. Empty groups are dropped. */
export function visibleGroups(tier: number, buildable: readonly BType[]): BuildGroup[] {
  return BUILD_GROUPS.map((g) => ({ ...g, types: g.types.filter((t) => buildable.includes(t) && tierOf(t) <= tier) })).filter((g) => g.types.length > 0);
}

/** One slim line: what the next era opens. Null at the last era or when nothing new is buildable. */
export function nextEraLine(tier: number, buildable: readonly BType[]): string | null {
  if (tier + 1 >= TIERS.length) return null;
  const names = buildable.filter((t) => tierOf(t) === tier + 1).map((t) => B[t].name);
  return names.length ? `${TIERS[tier + 1].name} unlocks: ${names.join(", ")}.` : null;
}
