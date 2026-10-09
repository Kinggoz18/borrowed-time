/**
 * Multiplayer-ready data shape (FINAL_PLAN_BT.md §12): a versioned IslandSnapshot, a stable hash,
 * and a pure resolveRaid(snapshot, strength, seed). Local only in Phase 1.
 */
import { Rng } from "./rng";
import * as E from "./engine";
import type { IslandState } from "./state";

export const SNAPSHOT_VERSION = 1;
export const RULES_VERSION = "v2-build.2";

export interface IslandSnapshot {
  v: typeof SNAPSHOT_VERSION;
  rules: string;
  islandId: string;
  /** Sequence number of the last command applied. */
  seq: number;
  state: IslandState;
  /** Derived, for servers and replays that don't run the rules: grey lots and defence inputs. */
  grey: string[];
  defence: number;
}

export const cloneState = (st: IslandState): IslandState => JSON.parse(JSON.stringify(st)) as IslandState;

export function toSnapshot(st: IslandState, islandId: string, seq: number): IslandSnapshot {
  const grey = [...E.greySet(st)].filter((k) => k in st.lots);
  return { v: SNAPSHOT_VERSION, rules: RULES_VERSION, islandId, seq, state: cloneState(st), grey, defence: E.defence(st) };
}

/** JSON with object keys sorted, so equal states always serialise the same way. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}

/** FNV-1a 32-bit over the canonical JSON, as 8 hex digits. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
export const hashSnapshot = (s: IslandSnapshot): string => hashString(canonical(s));
export const hashState = (st: IslandState): string => hashString(canonical(st));

/**
 * Resolves one raid against an island, purely. `strength` is the raiders' nominal strength;
 * the seed rolls the actual strength inside ±spread (the server issues seeds, so clients can't
 * re-roll). Returns a new snapshot; the input is never changed.
 */
export function resolveRaid(
  snapshot: IslandSnapshot,
  strength: number,
  seed: number,
  decision: E.Decision = "hold",
): { snapshot: IslandSnapshot; result: E.RaidResult } {
  const st = cloneState(snapshot.state);
  const d = E.applyDecision(st, decision);
  const p = E.spread(st);
  const S = Math.round(strength * (1 - p + 2 * p * new Rng(seed).next()));
  const result = E.fight(st, d, S);
  return { snapshot: toSnapshot(st, snapshot.islandId, snapshot.seq), result };
}
