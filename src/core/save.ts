/**
 * Versioned save file: parse, validate and migrate. Pure (the storage adapters live in
 * src/platform). Never throws: a broken or foreign save is reported as null.
 */
import type { GameData } from "./game";
import * as E from "./engine";
import type { IslandState } from "./state";

export const SAVE_VERSION = 2;
export const SAVE_KEY = "bt.save";

export interface CrestDesc {
  shape: string;
  charge: string;
  c1: string;
  c2: string;
}

export interface MetaLog {
  sessions: number;
  minutes: number;
  firstSeenAt: number;
  lastSeenAt: number;
  tier: number;
  goalsDone: number;
  lastScreen: string;
  quitAt: number;
}

export interface SaveMeta {
  /** The first-run choice ("We're starving") was made. */
  introDone: boolean;
  /** The six-line story intro was seen (or skipped). */
  storyDone: boolean;
  colonyName: string;
  /** Real time the save was written (ms since epoch); supplied by the caller. */
  savedAt: number;
  /** Ids of first-time lines already shown (borrow, grey, raid, held). */
  firsts: string[];
  /** Completed goal ids from Ada's list. */
  goalsDone: string[];
  /** Last (season * 10 + day) the noon watch call fired. */
  calledDay: number;
  crest: CrestDesc | null;
  chapters: { shared: string[] };
  log: MetaLog;
  letters: { seen: string[] };
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
    !!o.lots &&
    typeof o.lots === "object" &&
    num(o.L) &&
    num(o.hours) &&
    num(o.debt) &&
    num(o.seed) &&
    num(o.rngS) &&
    num(o.tier) &&
    o.tier >= 0 &&
    o.tier <= 3 &&
    num(o.pop) &&
    num(o.day) &&
    num(o.season) &&
    num(o.hour) &&
    num(o.dayLen) &&
    (o.phase === "day" || o.phase === "dusk" || o.phase === "night") &&
    !!o.stats &&
    typeof o.raidMem === "object"
  );
}

export const dayKey = (season: number, day: number): number => season * 10 + day;

export function defaultMeta(partial?: Partial<SaveMeta>): SaveMeta {
  const colonyName = partial?.colonyName?.trim() || "New Patience";
  return {
    introDone: partial?.introDone ?? false,
    storyDone: partial?.storyDone ?? false,
    colonyName: colonyName.slice(0, 48),
    savedAt: partial?.savedAt ?? 0,
    firsts: Array.isArray(partial?.firsts) ? [...partial!.firsts] : [],
    goalsDone: Array.isArray(partial?.goalsDone) ? [...partial!.goalsDone] : [],
    calledDay: typeof partial?.calledDay === "number" ? partial.calledDay : 0,
    crest: partial?.crest && typeof partial.crest === "object" ? { ...partial.crest } : null,
    chapters: { shared: Array.isArray(partial?.chapters?.shared) ? [...partial!.chapters!.shared] : [] },
    log: {
      sessions: partial?.log?.sessions ?? 0,
      minutes: partial?.log?.minutes ?? 0,
      firstSeenAt: partial?.log?.firstSeenAt ?? 0,
      lastSeenAt: partial?.log?.lastSeenAt ?? 0,
      tier: partial?.log?.tier ?? 0,
      goalsDone: partial?.log?.goalsDone ?? 0,
      lastScreen: partial?.log?.lastScreen ?? "",
      quitAt: partial?.log?.quitAt ?? 0,
    },
    letters: { seen: Array.isArray(partial?.letters?.seen) ? [...partial!.letters!.seen] : [] },
  };
}

/** Seed first-time line ids so migrated saves do not replay borrow / raid flourishes. */
export function seedFirsts(data: GameData): string[] {
  const st = data.state;
  const ids: string[] = [];
  if (st.stats.borrowed > 0) ids.push("borrow");
  if (E.greyCount(st) > 0) ids.push("grey");
  if (st.stats.raidsWon + st.stats.raidsLost + st.stats.bossWon + st.stats.bossLost > 0) ids.push("raid");
  if (st.stats.raidsWon + st.stats.bossWon > 0) ids.push("held");
  return ids;
}

export function normalizeMeta(raw: unknown, data?: GameData): SaveMeta {
  const p = raw && typeof raw === "object" ? (raw as Partial<SaveMeta>) : {};
  const meta = defaultMeta(p);
  if (data && meta.firsts.length === 0) meta.firsts = seedFirsts(data);
  return meta;
}

export function trimColonyName(name: string): string {
  return name.trim().slice(0, 48) || "New Patience";
}

/** Migrations from older versions, keyed by the version they upgrade from. */
export const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // v0: an early dev save that stored only the island state at the top level
  0: (raw) => {
    const st = raw.state as IslandState;
    const data = {
      islandId: String(raw.islandId ?? "local"),
      checkpoint: st,
      checkpointSeq: 0,
      commands: [],
      events: [],
      seq: 0,
      state: st,
    } satisfies GameData;
    const meta = defaultMeta({ introDone: true, storyDone: true, colonyName: "New Patience", savedAt: 0 });
    meta.firsts = seedFirsts(data);
    return { v: 2, data, meta };
  },
  1: (raw) => {
    const data = raw.data as GameData;
    const meta = normalizeMeta(raw.meta, data);
    return { v: 2, data, meta };
  },
};

export function encodeSave(data: GameData, meta: SaveMeta): string {
  return JSON.stringify({ v: SAVE_VERSION, data, meta: defaultMeta(meta) } satisfies SaveFile);
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
    f.meta = normalizeMeta(f.meta, f.data);
    return f;
  } catch {
    return null;
  }
}
