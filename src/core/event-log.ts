/**
 * Caps the append-only event log: drops hour ticks and closed-day noise, keeps journal kinds.
 */
import type { LoggedEvent } from "./game";
/** Kinds kept for the journal and chronicle (never drop these). */
export const JOURNAL_EVENT_KINDS = new Set<LoggedEvent["kind"]>([
  "built",
  "upgraded",
  "borrowed",
  "repaid",
  "research",
  "caravan",
  "levelUp",
  "dusk",
  "raid",
  "night",
  "seized",
  "tierUp",
  "seasonEnd",
]);

const DROP_ALWAYS = new Set<LoggedEvent["kind"]>(["hourTick"]);

/** After a day closes (night resolved), hour ticks and duplicate builds can go. */
export function compactEvents(events: LoggedEvent[], maxBytes = 200_000): LoggedEvent[] {
  const closed = new Set<number>();
  for (const ev of events) {
    if (ev.kind === "night") closed.add(ev.season * 100 + ev.day);
  }
  const kept: LoggedEvent[] = [];
  const buildsSeen = new Set<string>();
  for (const ev of events) {
    if (DROP_ALWAYS.has(ev.kind)) continue;
    if (ev.kind === "dusk" || ev.kind === "night") {
      if (!closed.has(ev.season * 100 + ev.day)) kept.push(ev);
      continue;
    }
    if (ev.kind === "built") {
      const ck = `${ev.season}-${ev.day}-${ev.type}`;
      if (buildsSeen.has(ck) && closed.has(ev.season * 100 + ev.day)) continue;
      buildsSeen.add(ck);
    }
    if (ev.kind === "upgraded" && closed.has(ev.season * 100 + ev.day)) continue;
    kept.push(ev);
  }
  let json = JSON.stringify(kept);
  while (json.length > maxBytes && kept.length > 50) {
    const drop = kept.findIndex((e) => e.kind === "built" || e.kind === "upgraded");
    if (drop < 0) break;
    kept.splice(drop, 1);
    json = JSON.stringify(kept);
  }
  return kept;
}

export function measureEventLog(events: LoggedEvent[]): number {
  return JSON.stringify(events).length;
}
