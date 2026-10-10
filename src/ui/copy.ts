/** Player-facing words. Short, plain, in the island's voice (LORE.md; one line per beat). */
import type { BType } from "../core/rules";

export const BLURB: Partial<Record<BType, string>> = {
  palisade: "A ring of stakes that holds the night back.",
  tower: "Eyes on the water. Stronger at dusk.",
  cottage: "A roof for more people to stay.",
  lantern: "Hesper lends the lamps. Hours and homes in one.",
  field: "Feeds people. Fed people make Hours.",
  workshop: "Clockwork benches. They make Hours.",
  road: "More Hours from everything. Raiders use roads too.",
  trade: "Stake Hours on tomorrow's caravan.",
  mirror: "A longer day, every day. Built on credit.",
  bank: "Your own count. Halves Hesper's interest.",
  hospital: "The Stitch. The hurt come home.",
  exchange: "A counting house. A longer line of credit, cheaper to keep.",
  harbour: "Boats at the docks. Stronger borrowed dusks.",
  observatory: "Ada counts the sails. Raids are easier to read.",
};
export const LOOK_NAMES = ["Rough", "Settled", "Timber", "Sturdy", "Stone", "Fine", "Grand"];
export const KIND_TITLE = {
  quiet: "A quiet night",
  skiffs: "Skiffs tonight",
  longboats: "Longboats tonight",
  ghosts: "Quiet boats tonight",
  runners: "Fast skiffs tonight",
  siege: "Siege boats tonight",
  rams: "Rams tonight",
  ironclads: "Iron hulls tonight",
  meters: "Counting boats tonight",
  longDusk: "The Long Dusk",
} as const;
export const HIDDEN_TITLE = "Something on the water";
export const BAND_WORD = { light: "Light", even: "Even", heavy: "Heavy" } as const;

export const LINES = {
  introTitle: "We're starving.",
  introBody: "Eight Hours will not feed six for long. Hesper is watching from her tent.",
  introAsk: "Borrow 10 Hours?",
  firstBorrow: "“Tomorrow's light, lent today. Do bring it back.” — Hesper",
  firstGrey: "“The shore is mine for a while. I'll keep it warm.” — Hesper",
  paidOff: "“Paid in full. I'll miss you until tomorrow.” — Hesper",
  nearLimit: "“Nearly all of it is mine now. Gently, but soon.” — Hesper",
  coachPalisade: "Build the Palisade first. It keeps the night out.",
  coachField: "Now a Field. People need food.",
  seized: "“Gently, as always.”",
  held: "“Held. I'm sitting down. It's free now.” — Tobias",
  firstRaid: "“Evening. We only want the hours. Keep your walls.” — Captain Fennick",
  village: "“We slept one night and woke a century later. Someone built a mill.” — Ada",
};

/** Build menu: one calm sentence per group about the very next era. Never a building's name (UX spec 7.3). Keyed `${tier}:${groupId}`. */
export const TEASERS: Record<string, string> = {
  "0:dwellings": "Bigger homes arrive in the Village.",
  "0:trade": "New ways to work arrive in the Village.",
  "1:trade": "A new way to make Hours arrives in the Town.",
  "1:civic": "Learning and care arrive in the Town.",
  "2:defence": "A harbour for your boats arrives in the City.",
  "2:trade": "A counting house arrives in the City.",
  "2:civic": "A watching dome arrives in the City.",
};

/** Words the HUD says, in one place. */
export const HUD = {
  owed: { safe: "Safe", owed: "Owed", near: "Near limit", over: "Over the limit" },
  safeSub: "Nothing owed",
  longDusk: "Long Dusk tonight",
  dusk: "Dusk",
  night: "Night",
  readyAtDawn: "Ready at dawn",
  openCharter: "Open the Charter",
  nightToast: "The night has started. Building starts again at dawn.",
} as const;

/** What the Charter promises for each age. Values come from the rules; only the sentences live here. */
export const CHARTER = {
  kicker: "Next age",
  heroBlocked: (era: string) => `Meet all four and the island wakes in the ${era} age.`,
  heroClose: "One thing left.",
  heroCloseSeal: (era: string) => ` Hesper's seal is the last thing between you and the ${era} age.`,
  heroReady: "All four met. The island grows at dawn.",
  banner: "The island will grow when you wake.",
  keepGoing: "Keep going",
  signed: { title: "The Charter is signed.", body: "The island has grown as far as it can. What's left is keeping it." },
  land: { title: "A bigger island", line: "More land to build on, with a new ring around it." },
  people: (n: number) => ({ title: `Room for ${n} people`, line: "More hands, more Hours." }),
  levels: (n: number) => ({ title: `Buildings grow to Level ${n}`, line: "Finer looks, stronger work." }),
  hesper: "Hesper says the island grows when it has kept enough of our time.",
  needs: "What it needs",
  gets: "What you get",
  newToBuild: "New to build",
  levelHint: "Build and upgrade to earn levels.",
  keptHint: "Repay Hesper to get back under.",
  sealHint: "“Only a formality.” She lifts it herself.",
  settledHint: "Room for everyone. People arrive on their own, one by one.",
} as const;

/** Profile marks: earned ones only, each with one line. */
export const MARKS = {
  roof: { name: "First roof", line: "Raised your first building." },
  night: { name: "Held the night", line: "Turned a raid back." },
  dusk: { name: "Long Dusk held", line: "Season 1 ended standing." },
  grew: { name: "Grew up", line: "Reached the {era} age." },
  paid: { name: "Paid in full", line: "Cleared a debt to Hesper." },
  learned: { name: "Learned something", line: "Finished your first study." },
} as const;
export const MARKS_EMPTY = "No marks yet. Build a roof, hold a night.";

export const PLURAL: Partial<Record<BType, string>> = { field: "Fields", cottage: "Cottages", workshop: "Clockworks", tower: "Watchtowers" };

/** Journal chapters, one per age (LORE.md). */
export const CHAPTERS = ["Wreck & Frontier", "Hearth & Harvest", "Gears & Gilt", "Brass & Steam"] as const;
