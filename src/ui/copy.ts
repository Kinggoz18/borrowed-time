/** Player-facing words. Short, plain, in the island's voice (LORE.md; one line per beat). */
import type { BType } from "../core/rules";

export const BLURB: Partial<Record<BType, string>> = {
  palisade: "A ring of stakes. Defends every night.",
  field: "Feeds people. Fed people make Hours.",
  cottage: "Homes. More people can stay.",
  workshop: "Clockworks. Makes Hours.",
  tower: "Watchtower. Stronger at dusk.",
  bank: "Hourglass. Halves Hesper's interest.",
  road: "More Hours. Raiders use them too.",
  trade: "Stake Hours on tomorrow's caravan.",
  lantern: "Built on credit. Hours and homes.",
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
