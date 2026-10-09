/** Stand-in palettes from ART_BIBLE.md §4. Constants never change era; materials stay within the ceilings. */
export const INK = "#3D3428";
export const INK_DIM = "#7A6A55";
export const PAPER = "#EFE6D2";
export const TEAL = "#5E9A98";
export const TEAL_DEEP = "#3F7473";
export const FOAM = "#E4ECE3";
export const DRIFT = "#8C7B68";
export const DRIFT_SHADE = "#5F5244";
export const SAIL = "#E8DCC4";
export const SAIL_SHADE = "#C9B99A";
export const TAR = "#2A2420";
export const GNOMON = "#A39A8A";
export const GNOMON_SHADE = "#7B7366";
export const HESPER = "#B8633F";
export const BRASS_PIN = "#BFA06A";

export interface Ramp {
  light: string;
  base: string;
  shade: string;
}
export interface EraPalette {
  wall: Ramp;
  wall2: Ramp;
  roof: Ramp;
  roof2: Ramp;
  accent: Ramp;
  glass: string;
  ground: Ramp;
  road: Ramp;
}

const r = (light: string, base: string, shade: string): Ramp => ({ light, base, shade });

/** City: Brass & Steam (sooted brick, iron, glass, brass, verdigris, smoke blue). */
export const CITY: EraPalette = {
  wall: r("#A88270", "#8C6656", "#6A4C40"),
  wall2: r("#B3AA9A", "#968D7E", "#736B5F"),
  roof: r("#7D8C97", "#5F6E7A", "#46525C"),
  roof2: r("#8EAAA1", "#6E9488", "#53736A"),
  accent: r("#C2AC7A", "#A8915F", "#7F6D47"),
  glass: "#B5C6C4",
  ground: r("#9DA37A", "#858C64", "#6C7350"),
  road: r("#B3AA9A", "#968D7E", "#736B5F"),
};

/** Town: Gears & Gilt (plaster, terracotta tile at S <= 45, marble, gold leaf). */
export const TOWN: EraPalette = {
  wall: r("#E6DDCB", "#D8CDB8", "#B3A894"),
  wall2: r("#B48670", "#9A6B55", "#77513F"),
  roof: r("#BC8A75", "#A16E59", "#7C5343"),
  roof2: r("#DDD7CB", "#CFC8BA", "#A8A293"),
  accent: r("#D2B67C", "#B89A5E", "#8D7546"),
  glass: "#C9D3CC",
  ground: r("#A8AC7C", "#8F9566", "#737852"),
  road: r("#C8B9A0", "#AE9F86", "#8B7E69"),
};
