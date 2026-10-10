/**
 * What the island remembers. The log feeds the Journal and the chronicle, so it keeps the story
 * (borrowings, repayments, ages, nights, seasons, firsts) and drops the noise (every hour tick,
 * every upgrade, quiet dusks). It is capped; when full, the least important entries go first.
 * Replay uses commands, not events, so none of this can change the island.
 */
import type { EventNotes, GameEvent, LoggedEvent } from "./game";

/** Most entries the log keeps. A season adds a handful, so this is dozens of seasons of story. */
export const EVENT_CAP = 400;

/** A borrowing this close to the limit is worth a line in the Journal (the HUD calls it "Near limit"). */
export const NEAR_LIMIT = 0.8;


/** Whether an event is worth remembering at all. */
export function worthKeeping(ev: GameEvent): boolean {
  switch (ev.kind) {
    case "built":
    case "borrowed":
    case "research":
    case "levelUp":
    case "seized":
    case "tierUp":
    case "seasonEnd":
      return true;
    case "repaid":
      return ev.cleared;
    case "raid":
      return !("quiet" in ev.result && ev.result.quiet);
    default:
      return false;
  }
}

/** 3 = never drop unless nothing else is left, 0 = first to go. */
export function importance(ev: LoggedEvent): number {
  switch (ev.kind) {
    case "tierUp":
    case "seized":
    case "seasonEnd":
      return 3;
    case "built":
      return ev.first ? 3 : 0;
    case "borrowed":
      return ev.first ? 3 : ev.debt !== undefined && ev.lim ? (ev.debt >= NEAR_LIMIT * ev.lim ? 2 : 0) : 0;
    case "raid": {
      const r = ev.result as { boss?: boolean; won?: boolean };
      return r.boss ? 3 : r.won ? 1 : 2;
    }
    case "research":
    case "repaid":
      return 2;
    case "levelUp":
      return 1;
    default:
      return 0;
  }
}

/** Drops the least important, oldest entries until the log fits. Returns the same array when it already fits. */
export function trimEvents(events: LoggedEvent[], cap = EVENT_CAP): LoggedEvent[] {
  if (events.length <= cap) return events;
  let over = events.length - cap;
  const drop = new Set<number>();
  for (let level = 0; level <= 3 && over > 0; level++) {
    for (let i = 0; i < events.length && over > 0; i++) {
      if (!drop.has(i) && importance(events[i]) === level) {
        drop.add(i);
        over--;
      }
    }
  }
  return events.filter((_, i) => !drop.has(i));
}

/** Notes added when an event is recorded: the era it happened in, whether it is a first, and the ledger at that moment. */
export function annotate(ev: GameEvent, prior: readonly LoggedEvent[], era: number, debtAfter: number, limAfter: number): EventNotes {
  const n: EventNotes = { era };
  if (ev.kind === "built" && !prior.some((p) => p.kind === "built" && p.type === ev.type)) n.first = true;
  if (ev.kind === "borrowed") {
    if (!prior.some((p) => p.kind === "borrowed")) n.first = true;
    n.debt = debtAfter;
    n.lim = limAfter;
  }
  return n;
}

/** Brings a log written by an older build up to date: drops the noise, adds the notes it can, caps it. */
export function upgradeEvents(events: LoggedEvent[]): LoggedEvent[] {
  const out: LoggedEvent[] = [];
  let era = 0;
  for (const raw of events) {
    if (!raw || typeof raw !== "object" || !worthKeeping(raw)) continue;
    const ev = { ...raw } as LoggedEvent;
    if (ev.kind === "tierUp") era = ev.tier;
    else if (ev.era === undefined) ev.era = era;
    if (ev.kind === "tierUp" && ev.era === undefined) ev.era = ev.tier;
    if (ev.kind === "built" && ev.first === undefined && !out.some((p) => p.kind === "built" && p.type === ev.type)) ev.first = true;
    if (ev.kind === "borrowed" && ev.first === undefined && !out.some((p) => p.kind === "borrowed")) ev.first = true;
    out.push(ev);
  }
  return trimEvents(out);
}
