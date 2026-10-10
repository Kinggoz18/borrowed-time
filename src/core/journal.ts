/**
 * Ada's chronicle entries derived from the event log (nothing stored as prose).
 */
import { B, TIERS } from "./rules";
import type { GameEvent, LoggedEvent } from "./game";
import type { SaveMeta } from "./save";

export const JOURNAL_PAGE_SIZE = 60;

export interface JournalEntry {
  key: string;
  season: number;
  day: number;
  text: string;
}

const SKIP: Set<GameEvent["kind"]> = new Set(["hourTick", "dusk"]);

function dateLabel(season: number, day: number): string {
  return `Season ${season}, Day ${day}`;
}

function raidEntry(ev: LoggedEvent & { kind: "raid" }): JournalEntry | null {
  const r = ev.result;
  if ("quiet" in r && r.quiet) return null;
  const won = r.won;
  const nick = won && r.D - r.S < r.S * 0.08;
  const text = nick
    ? `${dateLabel(ev.season, ev.day)} — In the nick of time! The wall held.`
    : won
      ? `${dateLabel(ev.season, ev.day)} — We held the shore. +${r.loot} Hours from the wreck.`
      : `${dateLabel(ev.season, ev.day)} — They broke through. We mend what we can.`;
  return { key: `raid-${ev.seq}`, season: ev.season, day: ev.day, text };
}

function formatOne(ev: LoggedEvent, meta: SaveMeta): JournalEntry | null {
  const d = dateLabel(ev.season, ev.day);
  const name = meta.colonyName;
  switch (ev.kind) {
    case "borrowed":
      return { key: `b-${ev.seq}`, season: ev.season, day: ev.day, text: `${d} — Borrowed ${ev.x} Hours. Tomorrow's light, lent today.` };
    case "repaid":
      return ev.cleared ? { key: `r-${ev.seq}`, season: ev.season, day: ev.day, text: `${d} — Paid Hesper to zero. ${name} breathes again.` } : null;
    case "levelUp":
      return { key: `l-${ev.seq}`, season: ev.season, day: ev.day, text: `${d} — Level ${ev.to}. The dial turns a little easier.` };
    case "tierUp":
      return { key: `t-${ev.seq}`, season: ev.season, day: ev.day, text: `${d} — ${TIERS[ev.tier].name}! A new chapter for ${name}.` };
    case "seasonEnd":
      return {
        key: `s-${ev.seq}`,
        season: ev.season,
        day: ev.day,
        text: ev.won ? `${d} — The Long Dusk was held. Season ${ev.season} closes well.` : `${d} — The Long Dusk fed on what we owed.`,
      };
    case "raid":
      return raidEntry(ev as LoggedEvent & { kind: "raid" });
    case "seized":
      return { key: `z-${ev.seq}`, season: ev.season, day: ev.day, text: `${d} — Hesper took the ${B[ev.seizure.type].name}. Stay under the limit.` };
    case "caravan":
      return { key: `c-${ev.seq}`, season: ev.season, day: ev.day, text: `${d} — A caravan returned with ${ev.x} Hours.` };
    case "research":
      return { key: `x-${ev.seq}`, season: ev.season, day: ev.day, text: `${d} — Ada's hands learned something new.` };
    case "upgraded":
      return null;
    case "built":
      return null;
    case "night":
      return null;
    default:
      return null;
  }
}

/** Collapse same-day builds into one line; drop presentation-only kinds. */
export function journalEntries(events: readonly LoggedEvent[], meta: SaveMeta): JournalEntry[] {
  const out: JournalEntry[] = [];
  const builds = new Map<string, string[]>();
  for (const ev of events) {
    if (SKIP.has(ev.kind)) continue;
    if (ev.kind === "built") {
      const k = `${ev.season}-${ev.day}`;
      const list = builds.get(k) ?? [];
      list.push(B[ev.type].name);
      builds.set(k, list);
      continue;
    }
    const row = formatOne(ev, meta);
    if (row) out.push(row);
  }
  for (const [k, names] of builds) {
    const [season, day] = k.split("-").map(Number);
    const uniq = [...new Set(names)];
    const text =
      uniq.length === 1
        ? `${dateLabel(season, day)} — Raised a ${uniq[0]}.`
        : `${dateLabel(season, day)} — Built: ${uniq.join(", ")}.`;
    out.push({ key: `build-${k}`, season, day, text });
  }
  out.sort((a, b) => a.season * 10 + a.day - (b.season * 10 + b.day) || a.key.localeCompare(b.key));
  return out;
}

export function journalPage(entries: JournalEntry[], page: number): { entries: JournalEntry[]; hasEarlier: boolean } {
  const end = entries.length - page * JOURNAL_PAGE_SIZE;
  const start = Math.max(0, end - JOURNAL_PAGE_SIZE);
  return { entries: entries.slice(start, end), hasEarlier: start > 0 };
}

/** Invented villager names must never appear in journal copy. */
export const JOURNAL_FORBIDDEN_NAMES = /\b(Wren|Piper|Mara|Edda|Clem|Bess)\b/i;
