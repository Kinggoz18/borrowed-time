/**
 * The Late, by the age their island went grey (LORE.md). Kind is picked from season and day,
 * never the island RNG. Tactics apply on the Phase 1 ruleset; the prototype ruleset keeps the
 * old one-kind fight so parity stays bit for bit.
 */
import { dayKind, RULESET } from "./rules";
import type { IslandState } from "./state";

export type RaidKind =
  | "quiet"
  | "skiffs"
  | "longboats"
  | "ghosts"
  | "runners"
  | "siege"
  | "rams"
  | "ironclads"
  | "meters"
  | "longDusk";

export type Band = "light" | "even" | "heavy";

export interface RaidTactic {
  /** Multiplier on rolled strength. Colony types stay at 1 so the first shore stays fair. */
  scale: number;
  hitMul: number;
  stealMul: number;
  lootMul: number;
  /** Extra passes over grey lots before inland buildings. */
  greyBias: number;
  palisadeFirst: boolean;
  richestFirst: boolean;
  maxHits: number | null;
}

export const CLASSIC: RaidTactic = {
  scale: 1,
  hitMul: 1,
  stealMul: 1,
  lootMul: 1,
  greyBias: 0,
  palisadeFirst: false,
  richestFirst: false,
  maxHits: null,
};

/** Colony pool keeps the old 2:1 skiffs/longboats pattern: (season*7+day) % 3 === 0 → longboats. */
export const RAID_POOL: readonly (readonly RaidKind[])[] = [
  ["longboats", "skiffs", "skiffs"],
  ["skiffs", "longboats", "ghosts", "runners"],
  ["skiffs", "longboats", "ghosts", "runners", "siege", "rams"],
  ["skiffs", "longboats", "ghosts", "runners", "siege", "rams", "ironclads", "meters"],
];

export const TACTICS: Record<RaidKind, RaidTactic> = {
  quiet: CLASSIC,
  // steal Hours, hit little
  skiffs: { ...CLASSIC, hitMul: 0.5, stealMul: 1.2, lootMul: 1.15, maxHits: 2 },
  // knock levels, grey land first (the old fight)
  longboats: CLASSIC,
  // hide their approach; usually weaker
  ghosts: { ...CLASSIC, scale: 0.8, hitMul: 0.55, stealMul: 0.7, lootMul: 0.65 },
  // fast skiffs: the lent shore first
  runners: { ...CLASSIC, scale: 0.95, stealMul: 1.1, lootMul: 1.05, greyBias: 1 },
  // siege longboat: the ring first
  siege: { ...CLASSIC, scale: 1.04, palisadeFirst: true, hitMul: 1.05 },
  // rams: the finest roofs, not the fields
  rams: { ...CLASSIC, scale: 1.02, richestFirst: true },
  // iron hulls from a later grey
  ironclads: { ...CLASSIC, scale: 1.06, hitMul: 1.2, stealMul: 1.1, lootMul: 1.1 },
  // Aster's habit: they count Hours as they take them
  meters: { ...CLASSIC, scale: 0.96, stealMul: 1.35, hitMul: 0.7, lootMul: 1.2, maxHits: 3 },
  longDusk: CLASSIC,
};

export function kindsForTier(tier: number): readonly RaidKind[] {
  return RAID_POOL[Math.max(0, Math.min(3, tier))]!;
}

export function raidKind(st: IslandState): RaidKind {
  const k = dayKind(st.day);
  if (k === "quiet") return "quiet";
  if (k === "boss") return "longDusk";
  const pool = kindsForTier(st.tier);
  const i = ((st.season * 7 + st.day) % pool.length + pool.length) % pool.length;
  return pool[i]!;
}

export function tacticOf(st: IslandState, kind: RaidKind = raidKind(st)): RaidTactic {
  if (RULESET === "prototype") return CLASSIC;
  return TACTICS[kind];
}

/** Observatory, or a Watchtower upgraded to timber (n ≥ 3), can still name a stealth raid. */
export function canSpot(st: IslandState): boolean {
  for (const k in st.lots) {
    const b = st.lots[k];
    if (!b) continue;
    if (b.type === "observatory") return true;
    if (b.type === "tower" && b.n >= 3) return true;
  }
  return false;
}

export function stealthHidden(st: IslandState, kind: RaidKind = raidKind(st)): boolean {
  return kind === "ghosts" && !canSpot(st);
}

export const LINES: Record<Exclude<RaidKind, "quiet">, Record<Band, readonly string[]>> = {
  skiffs: {
    light: [
      "A few oars, far out.",
      "Thin wakes. Not many.",
      "One lamp on the water, then gone.",
      "A small sail, grey as the shore.",
      "Someone rowing, slowly, a long way off.",
    ],
    even: [
      "Gulls gone quiet. Light boats.",
      "Quick hulls, close enough to count.",
      "Oars in time. They're not lost.",
      "Grey sails, low, coming in.",
      "Light boats. The watch is awake.",
    ],
    heavy: [
      "Quick oars, lots of them. They're making good time.",
      "The water is busy. Too many small hulls.",
      "Little hulls in a line. They know the grey shore.",
      "Oars like rain. Light boats, too many.",
      "The Late in little boats, and plenty of them.",
    ],
  },
  longboats: {
    light: [
      "One heavy hull, low in the water.",
      "A single drum, far off.",
      "One long boat. It isn't hurrying.",
      "A deep hull on a quiet sea.",
      "Something heavy, still a way out.",
    ],
    even: [
      "Gulls gone quiet. Many oars.",
      "Long boats. You can hear the timber.",
      "Heavy hulls, keeping time.",
      "The kind that knock walls, not just purses.",
      "Oars and a low sail. They mean to land.",
    ],
    heavy: [
      "Drums on the water. Too many oars to count.",
      "The big boats are full. The drums agree.",
      "Longboats, packed. They've done this before.",
      "A wall of hulls. The dusk is loud.",
      "Heavy timber, many oars, no song we like.",
    ],
  },
  ghosts: {
    light: [
      "A quiet hull, hugging the fog.",
      "No drums. One shape that wasn't there.",
      "The grey shore has a visitor, walking light.",
      "Oars wrapped. They don't want to be counted.",
      "A boat with no lamp, and no wake to speak of.",
    ],
    even: [
      "Quiet boats. The gulls never saw them.",
      "They're already near the grey lots.",
      "Soft oars, many of them.",
      "The Late, stepping where the hours have gone.",
      "No drums. That is the point.",
    ],
    heavy: [
      "The fog is full of hulls, still silent.",
      "Too many quiet boats to be a mistake.",
      "They came in without a sound. There are a lot of them.",
      "The grey shore is crowded and nobody rang the bell.",
      "Silent, and not few.",
    ],
  },
  runners: {
    light: [
      "A fast wake, aimed at the grey lots.",
      "One skiff in a hurry, shore-side.",
      "They're making for the lent land.",
      "Quick oars, a short trip to the grey.",
      "A light boat that isn't taking the long way.",
    ],
    even: [
      "Fast skiffs. Grey land first.",
      "They're skipping the deep water.",
      "Quick hulls on the lent shore.",
      "The Late know which lots have no hours left.",
      "Making good time, and not toward the gate.",
    ],
    heavy: [
      "A rush of small boats onto the grey.",
      "Too many fast hulls, all for the lent shore.",
      "They'll be on the grey lots before the bell.",
      "Quick oars, lots of them, and they know the way.",
      "The lent land is the landing.",
    ],
  },
  siege: {
    light: [
      "One ram, lashed to a long hull.",
      "A boat built to kiss a wall.",
      "Timber on the prow, not just oars.",
      "They're looking at the ring, not the fields.",
      "A slow heavy boat with a purpose.",
    ],
    even: [
      "Siege hulls. The palisade is the point.",
      "Longboats with rams. Walls first.",
      "They brought timber to spend on our ring.",
      "The drums are for the gate.",
      "Heavy boats, aimed at the stakes.",
    ],
    heavy: [
      "Rams and towers of timber on the water.",
      "The kind that take walls down a level.",
      "Too many siege hulls. The ring will hear it.",
      "They're here for the palisade, and they brought enough.",
      "Drums at the gate. The boats are built for it.",
    ],
  },
  rams: {
    light: [
      "They're looking at the tall roofs.",
      "One boat, pointed at the best house.",
      "Not the fields. The works.",
      "A prow aimed at the clockworks.",
      "They want the hours kept in the finest timber.",
    ],
    even: [
      "The best house is the one they want.",
      "Rams for the tall looks, not the sprouts.",
      "They're counting chimneys.",
      "The Late from a later grey, with taste.",
      "Aimed at what we spent the most hours on.",
    ],
    heavy: [
      "A line of prows, all at the grandest roofs.",
      "They'll knock the fine looks first.",
      "Too many rams for the workshops and halls.",
      "The tallest buildings are the landing.",
      "Not a raid for grain. A raid for craft.",
    ],
  },
  ironclads: {
    light: [
      "Brass on a grey hull, far out.",
      "A later boat, from a later dusk.",
      "Steam and a grey sail together.",
      "Iron in the water. Not many yet.",
      "A hull that doesn't creak like ours.",
    ],
    even: [
      "Iron boats. Mixed ages on the same tide.",
      "Steam, oars, and a grey flag.",
      "The Late from a city that ran out of tomorrow.",
      "Brass fittings, tar sails.",
      "A heavier dusk than timber usually brings.",
    ],
    heavy: [
      "Iron hulls, packed. A later grey, in force.",
      "Steam and drums. They've done cities before.",
      "Too much metal for a frontier night.",
      "The boats look like Aster's, drained of colour.",
      "A fleet from an age we haven't kept yet.",
    ],
  },
  meters: {
    light: [
      "A clerk's lamp on the water.",
      "Someone counting, out past the foam.",
      "A neat row of oars. A neater ledger.",
      "They brought a book. That's worse.",
      "A quiet boat that knows our totals.",
    ],
    even: [
      "They're counting as they row.",
      "Aster's habit, in Late boats.",
      "Lamps and ledgers on the dusk water.",
      "They want the hours measured, then taken.",
      "The kind that steal purses, not walls.",
    ],
    heavy: [
      "A fleet of lamps. They're still counting.",
      "Too many clerks on the water.",
      "They'll take the Hours and leave the timber.",
      "Ledgers open. Oars in time. Many of both.",
      "The Metered City's cousins, out of tomorrow.",
    ],
  },
  longDusk: {
    light: [
      "The dusk is thin tonight.",
      "A long shadow, but a short one as these go.",
      "The light is leaving, not all at once.",
      "The season's end feels light. Don't trust that.",
      "A pale Long Dusk. It still has a name.",
    ],
    even: [
      "The light is leaving early.",
      "Clocks slow. The sea is holding its breath.",
      "The Long Dusk is the size of a usual debt.",
      "The shadow on the water is ours, more or less.",
      "Evening came in a hurry. The usual hurry.",
    ],
    heavy: [
      "Every clock on the island has stopped.",
      "The dusk is as tall as what we owe.",
      "No birds. No bells. The sea is standing up.",
      "The Long Dusk has learned our names.",
      "The shadow doesn't end at the shore.",
    ],
  },
};

export const QUIET: readonly string[] = [
  "Calm sea.",
  "Calm sea. Nothing out there but tomorrow.",
  "The horizon is empty. For now.",
  "No oars. The gulls are still talking.",
  "A quiet night. The watch can sit.",
];

/** When ghosts hide: the watch can't name the boats. */
export const HIDDEN: readonly string[] = [
  "The water is wrong. Can't say why.",
  "A gap in the gulls. Nothing to point at.",
  "The watch heard something. Then they didn't.",
  "Fog on a clear dusk. Keep still.",
  "The shore feels later than it is.",
];
