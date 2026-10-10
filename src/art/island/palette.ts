/**
 * Colours for the Phase 1 stand-ins, straight from ART_BIBLE.md §4. Constants never change era;
 * each era adds only its material ramps (light / base / shade, baked light from the upper left).
 */
export interface Ramp {
  light: string;
  base: string;
  shade: string;
}
const r = (light: string, base: string, shade: string): Ramp => ({ light, base, shade });

export const INK = "#3D3428";
export const INK_DIM = "#7A6A55";
export const PAPER = "#EFE6D2";
export const TEAL = "#5E9A98";
export const TEAL_DEEP = "#3F7473";
export const FOAM = "#E4ECE3";
export const TAR = "#2A2420";
export const HESPER = "#B8633F";
export const BRASS_PIN = "#BFA06A";
/** UI meaning colours (signals only, never materials). */
export const DEBT = "#A4532F";
export const SAFE = "#82C155";
export const GOLD = "#D9A441";

export const DRIFT = r("#A8977F", "#8C7B68", "#5F5244");
export const SAIL = r("#F2E9D6", "#E8DCC4", "#C9B99A");
export const GNOMON = r("#BDB4A3", "#A39A8A", "#7B7366");
export const TARR = r("#4A403A", "#2A2420", "#1C1815");
export const STRIPE = r("#CF7A55", HESPER, "#8E4A2E");

export type Era = "colony" | "village" | "town" | "city";

/** Material ramps per era. Village: Hearth & Harvest (§4 table). Colony: Wreck & Frontier from the constants. */
export interface EraKit {
  name: Era;
  wall: Ramp;
  wall2: Ramp;
  roof: Ramp;
  roof2: Ramp;
  wood: Ramp;
  stone: Ramp;
  crop: Ramp;
  grass: Ramp;
  ground: Ramp;
  accent: Ramp;
}
export const VILLAGE: EraKit = {
  name: "village",
  wall: r("#DDB879", "#BD9D68", "#8F754F"), // ochre daub
  wall2: r("#987554", "#72583F", "#4F3C2C"), // wattle / oak
  roof: r("#CFB172", "#A78C5C", "#776441"), // thatch
  roof2: r("#C8C1B1", "#A8A090", "#7D7668"), // fieldstone
  wood: r("#987554", "#72583F", "#4F3C2C"),
  stone: r("#C8C1B1", "#A8A090", "#7D7668"),
  crop: r("#E2C67E", "#C0A369", "#8C784D"), // wheat
  grass: r("#9DAA6E", "#7E8F55", "#5C6B3D"), // moss
  ground: r("#B5A78A", "#9C8E70", "#7A6E55"),
  accent: r("#ECE6DA", "#ECE6DA", "#C9C2B4"), // hearth smoke white
};
export const COLONY: EraKit = {
  name: "colony",
  wall: SAIL, // canvas
  wall2: DRIFT, // ship timber
  roof: SAIL,
  roof2: TARR, // tarred hull planks
  wood: DRIFT,
  stone: GNOMON,
  crop: r("#B9C48A", "#9AA86E", "#738052"),
  grass: r("#A6B07A", "#8C9862", "#6B754B"),
  ground: r("#D9CBA8", "#C2B08A", "#9A8A69"),
  accent: r("#7FB3B1", TEAL, TEAL_DEEP),
};
export const BLUE_DOOR = r("#5F82A3", "#4E6F8E", "#38526B");
/** The procedural stand-ins only exist for Colony and Village colours; Town and City draw from their pixel pages (the stand-ins are a fallback for a page that has not loaded). */
export const kitFor = (era: Era): EraKit => (era === "colony" ? COLONY : VILLAGE);
