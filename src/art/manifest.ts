/**
 * Every stand-in frame, per atlas, at final resolution (ART_BIBLE.md §7). The generator draws
 * these; the runtime loads them. Sizes are high tier; the low tier is a separate half-size export.
 */
import { buildingFrameName, eraFrames, footprintForLook, frameSize, type Era } from "../sim/catalog";

export type Tier = "low" | "mid" | "high";
export interface FrameSpec {
  name: string;
  w: number;
  h: number;
  /** Anchor in frame pixels (high tier): the bottom diamond point for iso pieces. */
  ax: number;
  ay: number;
}
export interface AtlasSpec {
  name: string;
  frames: FrameSpec[];
  mipmaps: boolean;
}

export const WALL_PIECES = ["segI", "segJ", "gateI", "gateJ", "corner"] as const;
export const PUPPET_PARTS = ["head", "torso", "armL", "armR", "legs", "prop"] as const;
export const COSTUMES = ["field", "clockworks", "trade", "watch", "raider", "hesper"] as const;
export const GROUND = ["grass0", "grass1", "grass2", "grass3", "road", "plaza", "shore", "sand", "farm", "lot"] as const;
export const PROPS = ["farm", "hut", "windmill", "tree", "pier", "crates"] as const;

const iso = (name: string, n: 1 | 2 | 3): FrameSpec => {
  const { w, h } = frameSize(n);
  return { name, w, h, ax: w / 2, ay: h - 6 };
};

export function buildingAtlasFrames(era: Era): FrameSpec[] {
  const frames = eraFrames(era).map((f) => iso(buildingFrameName(era, f.type, f.look), footprintForLook(f.look)));
  // Merged cottage blocks (Town up): terrace variants at looks 4 and 5.
  if (era === "town" || era === "city") for (const l of [3, 4]) frames.push(iso(`${era}/block/${l}`, 1));
  return frames;
}

export function terrainFrames(): FrameSpec[] {
  const out: FrameSpec[] = [];
  for (const g of GROUND) out.push({ name: `ground/${g}`, w: 128, h: 64, ax: 64, ay: 64 });
  for (let s = 0; s < 7; s++) for (const p of WALL_PIECES) out.push(iso(`wall/${s}/${p}`, 1));
  for (const p of PROPS) out.push(iso(`prop/${p}`, 1));
  out.push(iso("tent", 2), iso("gnomon", 2));
  out.push({ name: "gnomonShadow", w: 256, h: 24, ax: 0, ay: 12 });
  return out;
}

export function unitFrames(): FrameSpec[] {
  const out: FrameSpec[] = [];
  const part: Record<(typeof PUPPET_PARTS)[number], [number, number]> = { head: [16, 16], torso: [18, 20], armL: [8, 18], armR: [8, 18], legs: [16, 16], prop: [16, 20] };
  for (const c of COSTUMES)
    for (const p of PUPPET_PARTS) {
      const [w, h] = part[p];
      out.push({ name: `part/${c}/${p}`, w: c === "hesper" ? Math.round(w * 1.1) : w, h: c === "hesper" ? Math.round(h * 1.4) : h, ax: w / 2, ay: p === "head" ? h : p === "legs" ? 0 : 2 });
    }
  // Baked 2-frame poses: the crowd on every tier, puppets on the low tier (ART_BIBLE.md §10).
  for (const c of COSTUMES) for (const f of [0, 1]) out.push({ name: `baked/${c}/${f}`, w: 32, h: 52, ax: 16, ay: 50 });
  out.push({ name: "boat", w: 160, h: 112, ax: 80, ay: 90 }, { name: "margery", w: 32, h: 28, ax: 16, ay: 26 });
  return out;
}

export function fxFrames(): FrameSpec[] {
  const out: FrameSpec[] = [];
  for (let k = 0; k < 4; k++) out.push({ name: `fx/fire/${k}`, w: 64, h: 64, ax: 32, ay: 32 });
  for (let k = 0; k < 3; k++) out.push({ name: `fx/smoke/${k}`, w: 64, h: 64, ax: 32, ay: 32 });
  out.push(
    { name: "fx/glow", w: 128, h: 128, ax: 64, ay: 64 },
    { name: "fx/window", w: 32, h: 32, ax: 16, ay: 16 },
    { name: "fx/spark", w: 16, h: 16, ax: 8, ay: 8 },
    { name: "fx/arrow", w: 32, h: 8, ax: 16, ay: 4 },
    { name: "fx/ring", w: 256, h: 128, ax: 128, ay: 64 },
    { name: "fx/vignette", w: 128, h: 128, ax: 0, ay: 0 },
    { name: "fx/white", w: 8, h: 8, ax: 0, ay: 0 },
  );
  return out;
}

export function atlasSpecs(): AtlasSpec[] {
  return [
    { name: "buildings-city", frames: buildingAtlasFrames("city"), mipmaps: true },
    // The next-oldest era's set stays resident: the era cinematic swaps between the two.
    { name: "buildings-town", frames: buildingAtlasFrames("town"), mipmaps: true },
    { name: "terrain", frames: terrainFrames(), mipmaps: true },
    { name: "units", frames: unitFrames(), mipmaps: false },
    { name: "fx", frames: fxFrames(), mipmaps: false },
  ];
}

/** Atlas scale per tier: the low tier loads the half-resolution export. */
export const tierScale = (tier: Tier) => (tier === "low" ? 0.5 : 1);
export const tierFolder = (tier: Tier) => (tier === "low" ? "low" : "high");
