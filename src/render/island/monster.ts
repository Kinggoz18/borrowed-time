/**
 * The Long Dusk, drawn: a hooded shadow that rises out of the sea behind the island on day 6
 * (prototype `drawBoss`, LORE.md "the shadow of everything owed", FINAL_PLAN_BT.md "Long Dusk
 * spectacle"). Presentation only: the size follows the raid's strength, the outcome follows the
 * fight the rules already rolled. Pure, so the sizes and poses are unit-tested.
 */
import type { BattlePhase } from "./battle";

/** Frames per size in the shared pixel set (`fx/monster/<size>/<frame>`). */
export const MONSTER_FRAMES = 4;
export const MONSTER_SIZES = 3;
/** Eyes and arms advance this many frames a second: stepped, never smooth. */
export const MONSTER_FPS = 5;
/** Height of each size in art pixels (tools/art/monster.py: BASE_H 160 x [0.72, 1.0, 1.32]). */
export const MONSTER_ART_H = [115, 160, 211] as const;

/** prototype: scale = min(1.4, 0.7 + S / 300), here in three steps (small, medium, large). */
export function monsterSize(S: number): 0 | 1 | 2 {
  const sc = Math.min(1.4, 0.7 + S / 300);
  return sc < 0.9 ? 0 : sc < 1.15 ? 1 : 2;
}

export const monsterFrame = (seconds: number): number => Math.floor(seconds * MONSTER_FPS) % MONSTER_FRAMES;

/** Art-pixel width of each size (tools/art/monster.py: BASE_W 190 x [0.72, 1.0, 1.32]). */
export const MONSTER_ART_W = [137, 190, 251] as const;
/** The medium shadow spans this share of the island's width: it towers over the ring, it is not a prop on it. */
export const MONSTER_SPAN = 0.55;
/** The waterline sits this far down the island's back corner (as a share of its height) so the hem hides behind the land. */
export const MONSTER_BASE = 0.3;

/**
 * Whole-number magnification of the shadow's art pixels, so it is sized by the island and not by the art:
 * the medium shadow is MONSTER_SPAN of the island's width. Whole numbers keep every art pixel the same size.
 */
export function monsterScale(islandW: number, unit: number): number {
  return Math.max(2, Math.round((MONSTER_SPAN * islandW) / (MONSTER_ART_W[1] * unit)));
}

/** World size (units) of a shadow of this size at this magnification. */
export const monsterWidth = (size: number, k: number, unit: number): number => MONSTER_ART_W[size] * unit * k;

/** Where the amber eyes sit, from the sprite's bottom-centre anchor, in art pixels (tools/art/monster.py: 0.235 of the height, 8.5 x size either side). */
export function monsterEyes(size: number): { dx: number; dy: number } {
  const s = [0.72, 1.0, 1.32][size]!;
  return { dx: 8.5 * s, dy: -(MONSTER_ART_H[size]! * (1 - 0.235)) };
}

export interface MonsterPose {
  /** 0 = under the water, 1 = fully risen */
  rise: number;
  /** 0..1: the eyes come first, as two embers over the water, before the body rises */
  eyes: number;
  alpha: number;
  /** pixels the shadow lurches sideways (a lost fight: it leans over the walls) */
  lean: number;
}

const ease = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** Where the shadow is in each beat of the dusk battle. A held fight drives it back under; a lost one leaves it standing. */
export function monsterPose(phase: BattlePhase, u: number, won: boolean): MonsterPose {
  switch (phase) {
    case "approach":
      // two embers on the water first, then the dark climbs up behind them
      return { rise: ease(Math.max(0, (u - 0.25) / 0.75)), eyes: Math.min(1, u * 4), alpha: 1, lean: 0 };
    case "defend":
      return { rise: 1, eyes: 1, alpha: 1, lean: 0 };
    case "clash":
      return { rise: 1 - (won ? 0.06 : 0) * Math.sin(u * Math.PI * 3) ** 2, eyes: 1, alpha: 1, lean: won ? 0 : 3 * Math.sin(u * Math.PI * 4) };
    case "outcome":
      return won ? { rise: 1 - 0.45 * ease(u), eyes: 1, alpha: 1, lean: 0 } : { rise: 1, eyes: 1, alpha: 1, lean: 4 * Math.sin(u * Math.PI * 6) };
    case "resolved":
      return { rise: won ? 0.55 : 1, eyes: 1, alpha: 1, lean: 0 };
    case "aftermath":
      // "it didn't die. It sank back into the sea like it was patient." A lost night: it thins out with the dusk.
      return won ? { rise: 0.55 * (1 - ease(u)), eyes: 1 - ease(u), alpha: 1, lean: 0 } : { rise: 1, eyes: 1 - ease(u), alpha: 1 - ease(u), lean: 0 };
  }
}

/** How dark the sky and screen edges go while it stands (0..1): the island dims as it looms, then the day returns. */
export const monsterDread = (p: MonsterPose): number => Math.min(1, p.rise * 0.85 + p.eyes * 0.15) * p.alpha;

/** Arrows loosed by the defences: more of them the closer the defence is to the shadow's strength, never more than `cap`. */
export function arrowCount(S: number, D: number, cap: number): number {
  const share = Math.max(0, Math.min(1.2, D / Math.max(1, S)));
  return Math.max(2, Math.min(cap, Math.round(2 + 6 * share)));
}

/** World height of a size (units), for framing the camera so the whole shadow shows. */
export const monsterHeight = (size: number, unit: number, k = 1): number => MONSTER_ART_H[size]! * unit * k;
