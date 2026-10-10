/**
 * Villager needs derived from island state (presentation and goals only).
 */
import * as E from "./engine";
import type { IslandState } from "./state";

export type NeedState = "ok" | "strained" | "failing";

export interface NeedGroup {
  food: NeedState;
  shelter: NeedState;
  safety: NeedState;
  foodCount: number;
  shelterCount: number;
  safetyCount: number;
}

export function needs(st: IslandState): NeedGroup {
  const pop = st.pop;
  const food = E.food(st);
  const homes = E.popRoom(st);
  const unfed = Math.max(0, pop - Math.floor(food));
  const unhoused = Math.max(0, pop - homes);
  const grey = E.greyCount(st);
  const posts = E.blds(st).filter(([, b]) => b.type === "tower" || b.type === "palisade").length;

  const foodState: NeedState = unfed === 0 ? "ok" : unfed <= Math.max(1, Math.floor(pop * 0.2)) ? "strained" : "failing";
  const shelterState: NeedState = unhoused === 0 ? "ok" : unhoused <= 2 ? "strained" : "failing";
  const safetyState: NeedState = grey === 0 ? "ok" : grey <= 1 && posts > 0 ? "strained" : "failing";

  return {
    food: foodState,
    shelter: shelterState,
    safety: safetyState,
    foodCount: unfed,
    shelterCount: unhoused,
    safetyCount: grey > 0 ? Math.min(pop, grey * 3) : 0,
  };
}

export function needColonyCopy(n: NeedGroup): string[] {
  const lines: string[] = [];
  if (n.shelterCount > 0) lines.push(`${n.shelterCount === 1 ? "One family" : `${n.shelterCount} families`} ${n.shelterCount === 1 ? "is" : "are"} sleeping rough.`);
  if (n.foodCount > 0) lines.push(`${n.foodCount === 1 ? "One mouth" : `${n.foodCount} mouths`} ${n.foodCount === 1 ? "goes" : "go"} hungry today.`);
  if (n.safety === "failing" && n.safetyCount > 0) lines.push("Grey land still waits for walls.");
  return lines;
}
