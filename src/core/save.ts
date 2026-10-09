/**
 * Versioned save file: parse, validate and migrate. Pure (the storage adapters live in
 * src/platform). Never throws: a broken or foreign save is reported as null.
 */
import type { GameData } from "./game";
import type { IslandState } from "./state";

export const SAVE_VERSION = 1;
export const SAVE_KEY = "bt.save";

export interface SaveMeta {
  /** The first-run choice ("We're starving") was made. */
  introDone: boolean;
  colonyName: string;
  /** Real time the save was written (ms since epoch); supplied by the caller. */
  savedAt: number;
}
export interface SaveFile {
  v: number;
  data: GameData;
  meta: SaveMeta;
}

const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
export function validState(s: unknown): s is IslandState {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    !!o.lots && typeof o.lots === "object" && num(o.L) && num(o.hours) && num(o.debt) && num(o.seed) && num(o.rngS) &&
    num(o.tier) && o.tier >= 0 && o.tier <= 3 && num(o.pop) && num(o.day) && num(o.season) && num(o.hour) && num(o.dayLen) &&
    (o.phase === "day" || o.phase === "dusk" || o.phase === "night") && !!o.stats && typeof o.raidMem === "object"
  );
}

/** Migrations from older versions, keyed by the version they upgrade from. */
export const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // v0: an early dev save that stored only the island state at the top level
  0: (raw) => {
    const st = raw.state as IslandState;
    return {
      v: 1,
      data: { islandId: String(raw.islandId ?? "local"), checkpoint: st, checkpointSeq: 0, commands: [], events: [], seq: 0, state: st },
      meta: { introDone: true, colonyName: "New Patience", savedAt: 0 },
    };
  },
};

export function encodeSave(data: GameData, meta: SaveMeta): string {
  return JSON.stringify({ v: SAVE_VERSION, data, meta } satisfies SaveFile);
}

export function decodeSave(raw: string | null): SaveFile | null {
  if (!raw) return null;
  try {
    let o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    let v = typeof o.v === "number" ? o.v : 0;
    if (v > SAVE_VERSION) return null; // from a newer build: never guess
    while (v < SAVE_VERSION) {
      const m = MIGRATIONS[v];
      if (!m) return null;
      o = m(o);
      v = o.v as number;
    }
    const f = o as unknown as SaveFile;
    if (!f.data || !validState(f.data.state) || !validState(f.data.checkpoint) || !Array.isArray(f.data.commands) || !Array.isArray(f.data.events)) return null;
    if (!f.meta || typeof f.meta !== "object") f.meta = { introDone: true, colonyName: "New Patience", savedAt: 0 };
    return f;
  } catch {
    return null;
  }
}
