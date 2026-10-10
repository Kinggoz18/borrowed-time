/**
 * Where the player's landmarks stand on the ground. The monuments themselves are cosmetic and live
 * in core/landmarks.ts; this only maps a placed spot (a lot key or a plaza tile) to a drawn cell.
 * Pure, so the placement geometry is unit-tested.
 */
import { landmarkDef, LANDMARKS, parsePlaza, type LandmarkDef } from "../../core/landmarks";
import { kij } from "../../core/rules";
import { phys } from "../../core/streets";
import type { IslandState } from "../../core/state";

export { LANDMARKS, type LandmarkDef };
export const landmarkFrame = (id: string): string => `land/${id}`;

/** The physical cell a placed landmark stands on: a lot's drawn cell, or the plaza crossing itself. Null for a spot that is neither. */
export function spotCell(at: string): { i: number; j: number } | null {
  const p = parsePlaza(at);
  if (p) return p;
  if (!/^-?\d+,-?\d+$/.test(at)) return null;
  const [i, j] = kij(at);
  return { i: phys(i), j: phys(j) };
}

export interface PlacedLandmark {
  def: LandmarkDef;
  at: string;
  i: number;
  j: number;
}
/** The landmarks the player has placed, in a fixed order (the order they unlock in). Nothing is placed unless the player did it. */
export function placedLandmarks(st: IslandState): PlacedLandmark[] {
  const out: PlacedLandmark[] = [];
  for (const def of LANDMARKS) {
    const at = st.landmarks?.[def.id];
    if (!at || def.tier > st.tier || !landmarkDef(def.id)) continue;
    const c = spotCell(at);
    if (c) out.push({ def, at, i: c.i, j: c.j });
  }
  return out;
}
