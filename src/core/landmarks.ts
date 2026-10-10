/**
 * Landmarks: cosmetic monuments tied to the lore. They have no effect on play (no Hours, defence or
 * housing). From Town the player unlocks them and places each one on a free lot or a plaza tile, one of
 * each; a placed one can be moved for free. Pure data and geometry, no rules.
 */
export interface LandmarkDef {
  id: string;
  /** the settlement tier that unlocks it: 2 = Town, 3 = City */
  tier: number;
  name: string;
  /** one line in the colony's voice, mentioning its place in the lore */
  plaque: string;
}

export const LANDMARKS: readonly LandmarkDef[] = [
  { id: "clock", tier: 2, name: "The Town Clock", plaque: "Ada wept when the first clock tower struck, then took it apart to see how. It keeps the hours we keep, not the ones we owe." },
  { id: "wreck", tier: 2, name: "The Founders' Wreck", plaque: "The Patience, hauled up the beach. Forty-one of us and a goat called Margery came ashore from this hull." },
  { id: "bargain", tier: 2, name: "Hesper's First Bargain", plaque: "One hour, lent gently, on this very spot. The basin has never run dry, and nobody has asked who fills it." },
  { id: "dial", tier: 3, name: "The Great Dial", plaque: "One ring, gear and lamp at a time, so we can keep our own time. Hesper won't lend an hour toward it. It is never finished." },
  { id: "lighthouse", tier: 3, name: "The Lighthouse", plaque: "Lights on the horizon answered ours. We keep this one burning for the Late as well; some of them still know the way home." },
  { id: "bell", tier: 3, name: "The Tide-Bell", plaque: "It rings the Long Dusk in, one note before the shadow rises. Nobody remembers who cast it, or who rings it." },
];
export const landmarkDef = (id: string): LandmarkDef | undefined => LANDMARKS.find((l) => l.id === id);

/** A placed landmark's spot: a lot key "i,j", or a plaza tile "p:I,J" (physical street crossing). */
export const plazaKey = (I: number, J: number): string => `p:${I},${J}`;
export const isPlazaKey = (k: string): boolean => k.startsWith("p:");
export function parsePlaza(k: string): { i: number; j: number } | null {
  const m = /^p:(-?\d+),(-?\d+)$/.exec(k);
  return m ? { i: Number(m[1]), j: Number(m[2]) } : null;
}
