/**
 * Dusk battle sequence (restored from the v2 playRaid + stress-scene beats: boats in,
 * towers and the ring answer, clash, then outcome). Damage and seizure visuals wait until
 * after `resolved`. Presentation only; the rules already rolled the fight.
 */
export type BattlePhase = "approach" | "defend" | "clash" | "outcome" | "resolved" | "aftermath";

export interface BattleBeat {
  phase: BattlePhase;
  dur: number;
}

export const BATTLE_RESOLVED_EVENT = "bt:battle-resolved";

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Beats in order. `resolved` is a zero-length marker: fire the event, then play aftermath. */
export function battleTimeline(res: { won: boolean; boss?: boolean }, reduced: boolean): BattleBeat[] {
  const d = (full: number): number => (reduced ? Math.min(0.08, full * 0.05) : full);
  return [
    { phase: "approach", dur: d(res.boss ? 2 : 1.7) },
    { phase: "defend", dur: d(0.8) },
    { phase: "clash", dur: d(1.4) },
    { phase: "outcome", dur: d(1) },
    { phase: "resolved", dur: 0 },
    { phase: "aftermath", dur: d(res.won ? 1.1 : 1.7) },
  ];
}

export function boatCount(kind: string, boss: boolean, cap: number): number {
  if (boss) return Math.min(cap, 4);
  if (kind === "ghosts" || kind === "skiffs") return Math.min(cap, 1);
  if (kind === "siege" || kind === "ironclads") return Math.min(cap, 3);
  return Math.min(cap, 2);
}

export function raiderCount(kind: string, boss: boolean, cap: number): number {
  if (boss) return Math.min(cap, 10);
  if (kind === "ghosts") return Math.min(cap, 3);
  if (kind === "ironclads" || kind === "siege") return Math.min(cap, 7);
  return Math.min(cap, 5);
}
