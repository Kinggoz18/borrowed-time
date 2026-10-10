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

export interface MonsterPose {
  /** 0 = under the water, 1 = fully risen */
  rise: number;
  alpha: number;
  /** pixels the shadow lurches sideways (a lost fight: it leans over the walls) */
  lean: number;
}

const ease = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** Where the shadow is in each beat of the dusk battle. A held fight drives it back under; a lost one leaves it standing. */
export function monsterPose(phase: BattlePhase, u: number, won: boolean): MonsterPose {
  switch (phase) {
    case "approach":
      return { rise: ease(u), alpha: 1, lean: 0 };
    case "defend":
      return { rise: 1, alpha: 1, lean: 0 };
    case "clash":
      return { rise: 1 - (won ? 0.06 : 0) * Math.sin(u * Math.PI * 3) ** 2, alpha: 1, lean: won ? 0 : 3 * Math.sin(u * Math.PI * 4) };
    case "outcome":
      return won ? { rise: 1 - 0.45 * ease(u), alpha: 1, lean: 0 } : { rise: 1, alpha: 1, lean: 4 * Math.sin(u * Math.PI * 6) };
    case "resolved":
      return { rise: won ? 0.55 : 1, alpha: 1, lean: 0 };
    case "aftermath":
      // "it didn't die. It sank back into the sea like it was patient." A lost night: it thins out with the dusk.
      return won ? { rise: 0.55 * (1 - ease(u)), alpha: 1, lean: 0 } : { rise: 1, alpha: 1 - ease(u), lean: 0 };
  }
}

/** Arrows loosed by the defences: more of them the closer the defence is to the shadow's strength, never more than `cap`. */
export function arrowCount(S: number, D: number, cap: number): number {
  const share = Math.max(0, Math.min(1.2, D / Math.max(1, S)));
  return Math.max(2, Math.min(cap, Math.round(2 + 6 * share)));
}

/** World height of a size (units), for framing the camera so the whole shadow shows. */
export const monsterHeight = (size: number, unit: number): number => MONSTER_ART_H[size] * unit;
