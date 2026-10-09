/**
 * Commands in, events out. The client records intents (never results) with sequence numbers;
 * replaying the command log from a checkpoint reproduces the island exactly.
 */
import { Rng } from "./rng";
import * as E from "./engine";
import { B, SEASON_DAYS, TECH, type BType, type TechId } from "./rules";
import { cloneState, hashState } from "./snapshot";
import type { IslandState } from "./state";

export type Command =
  | { t: "build"; key?: string; type: BType }
  | { t: "upgrade"; key: string }
  | { t: "borrow"; x: number }
  | { t: "repay"; x: number }
  | { t: "research"; id: TechId }
  | { t: "caravan"; x: number }
  | { t: "hour" }
  | { t: "dusk"; decision: E.Decision }
  | { t: "night" };
export type LoggedCommand = Command & { seq: number };

export type GameEvent =
  | { kind: "built"; key: string; type: BType; credit: boolean; cost: number }
  | { kind: "upgraded"; key: string; type: BType; n: number; newLook: boolean }
  | { kind: "borrowed"; x: number; dayLen: number; shortTomorrow: number }
  | { kind: "repaid"; x: number; cleared: boolean }
  | { kind: "research"; id: TechId }
  | { kind: "caravan"; x: number }
  | { kind: "levelUp"; from: number; to: number }
  | { kind: "dusk"; dayKind: "raid" | "boss" | "quiet" }
  | { kind: "raid"; result: E.DuskResult }
  | { kind: "night"; result: E.NightResult }
  | { kind: "seized"; seizure: E.Seizure }
  | { kind: "tierUp"; tier: number }
  | { kind: "seasonEnd"; season: number; won: boolean };
export type LoggedEvent = GameEvent & { seq: number; season: number; day: number };

export class CommandError extends Error {}

/** The free lot the game picks when the player taps Build without choosing a lot: the safest first. */
export const safestFreeLot = (st: IslandState): string | undefined =>
  E.greyOrder(st).slice().reverse().find((k) => E.isFree(st, k));

/** Applies one command. Throws CommandError when the rules refuse it; the state is then unchanged. */
export function apply(st: IslandState, cmd: Command): GameEvent[] {
  const out: GameEvent[] = [];
  const L0 = st.L;
  switch (cmd.t) {
    case "build": {
      if (st.phase !== "day") throw new CommandError("not daytime");
      const key = B[cmd.type].glob ? B[cmd.type].glob : cmd.key ?? safestFreeLot(st);
      const c = E.cost(cmd.type, 0, st.L);
      if (!E.build(st, key, cmd.type)) throw new CommandError("can't build");
      out.push({ kind: "built", key: key!, type: cmd.type, credit: !!B[cmd.type].credit, cost: c });
      break;
    }
    case "upgrade": {
      if (st.phase !== "day") throw new CommandError("not daytime");
      const s0 = E.bAt(st, cmd.key) ? Math.floor(E.bAt(st, cmd.key)!.n / 3) : 0;
      if (!E.upgrade(st, cmd.key)) throw new CommandError("can't upgrade");
      const b = E.bAt(st, cmd.key)!;
      out.push({ kind: "upgraded", key: cmd.key, type: E.typeAt(st, cmd.key)!, n: b.n, newLook: Math.min(6, Math.floor(b.n / 3)) !== Math.min(6, s0) });
      break;
    }
    case "borrow": {
      if (st.phase !== "day") throw new CommandError("not daytime");
      const x = E.borrow(st, cmd.x);
      if (!x) throw new CommandError("at the limit");
      out.push({ kind: "borrowed", x, dayLen: st.dayLen, shortTomorrow: st.shortTomorrow });
      break;
    }
    case "repay": {
      const x = E.repay(st, cmd.x);
      if (!x) throw new CommandError("nothing to repay");
      out.push({ kind: "repaid", x, cleared: st.debt === 0 });
      break;
    }
    case "research":
      if (st.phase !== "day" || !TECH[cmd.id] || !E.research(st, cmd.id)) throw new CommandError("can't research");
      out.push({ kind: "research", id: cmd.id });
      break;
    case "caravan": {
      if (st.phase !== "day") throw new CommandError("not daytime");
      const x = E.sendCaravan(st, cmd.x);
      if (!x) throw new CommandError("can't send");
      out.push({ kind: "caravan", x });
      break;
    }
    case "hour": {
      if (st.phase !== "day") throw new CommandError("not daytime");
      const e = E.tickHour(st);
      if (e) out.push({ kind: "dusk", dayKind: e.kind });
      break;
    }
    case "dusk": {
      if (st.phase !== "dusk") throw new CommandError("not dusk");
      out.push({ kind: "raid", result: E.resolveDusk(st, cmd.decision) });
      break;
    }
    case "night": {
      if (st.phase !== "night") throw new CommandError("not night");
      const r = E.night(st);
      out.push({ kind: "night", result: r });
      if (r.seized) out.push({ kind: "seized", seizure: r.seized });
      if (r.seasonEnd) out.push({ kind: "seasonEnd", season: r.seasonEnd.season, won: r.seasonEnd.won });
      if (r.tierUp !== null) out.push({ kind: "tierUp", tier: r.tierUp });
      break;
    }
  }
  if (st.L > L0) out.push({ kind: "levelUp", from: L0, to: st.L });
  return out;
}

export interface GameData {
  islandId: string;
  /** The island at the start of the current season: replay starts here. */
  checkpoint: IslandState;
  checkpointSeq: number;
  /** Commands since the checkpoint. */
  commands: LoggedCommand[];
  /** Append-only island history (raids, seizures, tier-ups ...). Feeds the chronicle. */
  events: LoggedEvent[];
  seq: number;
  state: IslandState;
}

export function newIslandId(seed: number): string {
  const r = new Rng(seed * 31 + 7);
  let id = "";
  for (let i = 0; i < 4; i++) id += Math.floor(r.next() * 0x10000).toString(16).padStart(4, "0");
  return id;
}

export function newData(seed: number): GameData {
  const st = E.newGame({ seed });
  return { islandId: newIslandId(seed), checkpoint: cloneState(st), checkpointSeq: 0, commands: [], events: [], seq: 0, state: st };
}

/** Records a command, applies it and appends its events. Refused commands change nothing. */
export function dispatch(g: GameData, cmd: Command): GameEvent[] {
  const before = cloneState(g.state);
  let evs: GameEvent[];
  try {
    evs = apply(g.state, cmd);
  } catch (e) {
    g.state = before;
    throw e;
  }
  g.seq++;
  g.commands.push({ ...cmd, seq: g.seq });
  const at = { seq: g.seq, season: before.season, day: before.day };
  for (const ev of evs) g.events.push({ ...ev, ...at });
  // a new season is a checkpoint: replay never needs older commands
  if (evs.some((e) => e.kind === "seasonEnd")) {
    g.checkpoint = cloneState(g.state);
    g.checkpointSeq = g.seq;
    g.commands = [];
  }
  return evs;
}

/** Replays commands from a checkpoint. Throws if any command is refused (a log that doesn't reproduce). */
export function replay(checkpoint: IslandState, commands: Command[]): IslandState {
  const st = cloneState(checkpoint);
  for (const c of commands) apply(st, c);
  return st;
}
export const verify = (g: GameData): boolean => hashState(replay(g.checkpoint, g.commands)) === hashState(g.state);
export const absoluteDay = (st: IslandState): number => (st.season - 1) * SEASON_DAYS + st.day;
