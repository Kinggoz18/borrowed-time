/**
 * Landmarks: purely cosmetic monuments tied to the lore. They appear on their own when the island
 * reaches their tier (never built, never in the Build sheet) and have no effect on play; tapping one
 * shows a short plaque. Pure placement, so unlock and positions are unit-tested.
 */
import type { Coast } from "./coast";

export interface LandmarkDef {
  id: string;
  /** first tier that shows it: 2 = Town, 3 = City */
  tier: number;
  name: string;
  /** one line in the colony's voice, mentioning its place in the lore */
  plaque: string;
  /** where it stands: a street junction (physical cell), or the shore along a direction from the gnomon */
  at: { cell: [number, number] } | { shore: [number, number] };
  /** cells it covers on the ground (for the tap target), radius around `at` */
  reach: number;
}

export const LANDMARKS: readonly LandmarkDef[] = [
  { id: "clock", tier: 2, name: "The Town Clock", plaque: "Ada wept when the first clock tower struck, then took it apart to see how. It keeps the hours we keep, not the ones we owe.", at: { cell: [-6, -6] }, reach: 0 },
  { id: "wreck", tier: 2, name: "The Founders' Wreck", plaque: "The Patience, hauled up the beach. Forty-one of us and a goat called Margery came ashore from this hull.", at: { shore: [-1, 1] }, reach: 1 },
  { id: "bargain", tier: 2, name: "Hesper's First Bargain", plaque: "One hour, lent gently, on this very spot. The basin has never run dry, and nobody has asked who fills it.", at: { cell: [6, 2] }, reach: 0 },
  { id: "dial", tier: 3, name: "The Great Dial", plaque: "One ring, gear and lamp at a time, so we can keep our own time. Hesper won't lend an hour toward it. It is never finished.", at: { cell: [-2, -2] }, reach: 0 },
  { id: "lighthouse", tier: 3, name: "The Lighthouse", plaque: "Lights on the horizon answered ours. We keep this one burning for the Late as well; some of them still know the way home.", at: { shore: [-1, -1] }, reach: 1 },
  { id: "bell", tier: 3, name: "The Tide-Bell", plaque: "It rings the Long Dusk in, one note before the shadow rises. Nobody remembers who cast it, or who rings it.", at: { cell: [-6, 2] }, reach: 0 },
];
export const landmarkFrame = (id: string): string => `land/${id}`;

/** Cells (i, j) of the shore along a direction from the gnomon: the last land cell that is sand or beach, one cell in from the sea. */
export function shoreSpot(coast: Coast, di: number, dj: number): { i: number; j: number } {
  let i = 0, j = 0;
  while (coast.isLand(i + di, j + dj)) {
    i += di;
    j += dj;
  }
  // two cells in from the last land cell: on the beach, with sea in view
  return { i: i - 2 * di, j: j - 2 * dj };
}

export interface PlacedLandmark {
  def: LandmarkDef;
  i: number;
  j: number;
}

/** Landmarks shown at a tier. The shore ones are cut from the fixed island, so they never move. */
export function landmarksFor(tier: number, coast: Coast): PlacedLandmark[] {
  return LANDMARKS.filter((d) => d.tier <= tier).map((def) => {
    if ("cell" in def.at) return { def, i: def.at.cell[0], j: def.at.cell[1] };
    const s = shoreSpot(coast, def.at.shore[0], def.at.shore[1]);
    return { def, i: s.i, j: s.j };
  });
}
