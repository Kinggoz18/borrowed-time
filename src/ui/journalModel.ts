/**
 * The Journal as pure data: Ada's book, written from the island's real events. Entries are made at
 * open time from the stored log (no text is saved), newest first. Rules for which event becomes an
 * entry follow UX spec 8.4; the voice follows 8.9. A save always reads the same.
 */
import type { RaidResult } from "../core/engine";
import { NEAR_LIMIT } from "../core/eventlog";
import type { LoggedEvent } from "../core/game";
import { B, TECH, TIERS, type BType } from "../core/rules";
import { LANDMARKS } from "../core/landmarks";
import { CHAPTERS } from "./copy";
import { fill, HESPER_LINES, TAG_WORDS, TITLES, VOICE, type Vars } from "./journalCopy";
import { capital, numWord } from "./words";

export type JFilter = "all" | "nights" | "hesper" | "growth";
export type TagIcon = "shield" | "fire" | "owed" | "check" | "star" | "build" | "seal" | "moon" | "journal" | "sun" | "home";
export interface JEntry {
  id: string;
  seq: number;
  season: number;
  day: number;
  /** the age it happened in: 0 Colony .. 3 City */
  era: number;
  group: Exclude<JFilter, "all">;
  title: string;
  tag: { icon: TagIcon; word: string };
  text: string;
  quote?: string;
  facts?: string;
  big?: boolean;
  warn?: boolean;
  /** Hours of the dusk or night, for tests: what the entry was written from */
  kind: string;
}

const hrs = (n: number): string => `${n} Hour${n === 1 ? "" : "s"}`;
const UP = (t: BType): string => B[t].name;
const an = (name: string): string => (/^[aeiou]/i.test(name) ? "an" : "a");

/** Picks a variant by (seed + seq); never the same one twice in a row for the same kind. */
export function pick<T>(list: readonly T[], seed: number, seq: number, last: Map<string, number>, kind: string): { v: T; i: number } {
  let i = Math.abs(seed + seq) % list.length;
  if (last.get(kind) === i) i = (i + 1) % list.length;
  last.set(kind, i);
  return { v: list[i], i };
}

/** Milestone levels worth a line: every fifth level, and the level that opens the next age. */
export function levelMilestone(to: number, from: number, era: number): "cap" | "five" | null {
  const nxt = TIERS[era + 1];
  for (let l = to; l > from; l--) {
    if (nxt && l === nxt.lvl) return "cap";
  }
  for (let l = to; l > from; l--) if (l % 5 === 0) return "five";
  return null;
}

export function journalEntries(events: readonly LoggedEvent[], seed: number): JEntry[] {
  const out: JEntry[] = [];
  const last = new Map<string, number>();
  let era = 0;
  const entry = (ev: LoggedEvent, e: Omit<JEntry, "id" | "seq" | "season" | "day" | "era">): void => {
    out.push({ id: `${ev.seq}-${out.length}`, seq: ev.seq, season: ev.season, day: ev.day, era, ...e });
  };
  const say = (kind: string, ev: LoggedEvent, v: Vars): { title: string; text: string } => {
    const t = pick(TITLES[kind], seed, ev.seq, last, "t:" + kind);
    const x = pick(VOICE[kind], seed, ev.seq, last, kind);
    const vars = { ...v, People: capital(String(v.people ?? "")) };
    return { title: fill(t.v, vars), text: fill(x.v, vars) };
  };
  for (const ev of events) {
    era = ev.kind === "tierUp" ? ev.tier : ev.era ?? era;
    switch (ev.kind) {
      case "raid": {
        if ("quiet" in ev.result && ev.result.quiet) break;
        const res = ev.result as RaidResult;
        const saved = res.saved ?? 0;
        const borrowedDusk = res.decision === "borrow" ? "borrowed the dusk" : "";
        if (res.boss) {
          const k = res.won ? "bossHeld" : "bossLost";
          const facts = res.won ? [`${hrs(res.loot)} salvaged`, res.damaged.length ? "" : "nothing taken", borrowedDusk] : [res.stolen ? `${hrs(res.stolen)} taken` : "", res.damaged.length ? `${res.damaged.length} hit` : "", borrowedDusk];
          entry(ev, { kind: k, group: "nights", ...say(k, ev, {}), tag: { icon: res.won ? "shield" : "fire", word: res.won ? TAG_WORDS.held : TAG_WORDS.lost }, big: true, warn: !res.won, facts: facts.filter(Boolean).join(" · ") });
        } else if (res.won) {
          const near = res.D - res.S < res.S * 0.08;
          const k = near ? "nearMiss" : "held";
          entry(ev, { kind: k, group: "nights", ...say(k, ev, {}), tag: { icon: "shield", word: TAG_WORDS.held }, facts: [`${hrs(res.loot)} salvaged`, res.boat ? "a boat at the docks" : "", borrowedDusk].filter(Boolean).join(" · ") });
        } else {
          const k = res.villagersLost > 0 ? "lostPeople" : "lostLight";
          const facts = [res.stolen ? `${hrs(res.stolen)} taken` : "", res.damaged.length ? `${res.damaged.length} building${res.damaged.length > 1 ? "s" : ""} hit` : "", saved > 0 ? `${saved} carried home alive` : ""].filter(Boolean).join(" · ");
          entry(ev, { kind: k, group: "nights", ...say(k, ev, { people: numWord(res.villagersLost) }), tag: { icon: "fire", word: TAG_WORDS.lost }, warn: true, facts });
        }
        break;
      }
      case "seized": {
        const name = UP(ev.seizure.type);
        entry(ev, { kind: "seized", group: "hesper", ...say("seized", ev, { building: name }), tag: { icon: "owed", word: TAG_WORDS.taken }, warn: true, quote: HESPER_LINES[0], facts: `${hrs(ev.seizure.credit)} written off what we owe` });
        break;
      }
      case "borrowed": {
        if (ev.first) entry(ev, { kind: "firstBorrow", group: "hesper", ...say("firstBorrow", ev, {}), tag: { icon: "owed", word: TAG_WORDS.borrowed }, facts: [`+${hrs(ev.x)}`, ev.shortTomorrow > 0 ? `tomorrow ${ev.shortTomorrow} ${ev.shortTomorrow === 1 ? "hour" : "hours"} shorter` : ""].filter(Boolean).join(" · ") });
        else if (ev.debt !== undefined && ev.lim && ev.debt >= NEAR_LIMIT * ev.lim) entry(ev, { kind: "nearLimit", group: "hesper", ...say("nearLimit", ev, {}), tag: { icon: "owed", word: TAG_WORDS.borrowed }, warn: true, quote: HESPER_LINES[3], facts: `+${hrs(ev.x)}` });
        break;
      }
      case "repaid":
        if (ev.cleared) entry(ev, { kind: "paid", group: "hesper", ...say("paid", ev, {}), tag: { icon: "check", word: TAG_WORDS.repaid }, facts: `${hrs(ev.x)}, the last of it` });
        break;
      case "research": {
        const t = TECH[ev.id];
        entry(ev, { kind: "research", group: "growth", ...say("research", ev, { tech: t.name.toLowerCase() }), tag: { icon: "journal", word: TAG_WORDS.learned }, facts: `${t.name} · ${t.text}` });
        break;
      }
      case "tierUp": {
        const k = `age${ev.tier}`;
        if (!VOICE[k]) break;
        entry(ev, { kind: "tierUp", group: "growth", ...say(k, ev, {}), tag: { icon: "star", word: TAG_WORDS.age }, big: true, facts: `The ${TIERS[ev.tier].name} age begins` });
        const seen = LANDMARKS.filter((l) => l.tier === ev.tier);
        if (seen.length) {
          const first = seen[0].name;
          const rest = seen.slice(1).map((l) => l.name);
          entry(ev, { kind: "landmark", group: "growth", ...say("landmark", ev, { first }), tag: { icon: "seal", word: TAG_WORDS.found }, facts: ["You can place: " + [first, ...rest].join(" · ")].join("") });
        }
        break;
      }
      case "levelUp": {
        const m = levelMilestone(ev.to, ev.from, era);
        if (m) entry(ev, { kind: m === "cap" ? "levelCap" : "level", group: "growth", ...say(m === "cap" ? "levelCap" : "level", ev, {}), tag: { icon: "star", word: `Level ${ev.to}` }, facts: m === "cap" ? "The next age is within reach" : undefined });
        break;
      }
      case "built": {
        if (!ev.first) break;
        const name = UP(ev.type);
        const k = ev.type === "cottage" ? "builtCottage" : "built";
        entry(ev, { kind: k, group: "growth", ...say(k, ev, { building: name, a: an(name) }), tag: { icon: "build", word: TAG_WORDS.built } });
        break;
      }
      case "seasonEnd":
        entry(ev, { kind: ev.won ? "seasonHeld" : "seasonLost", group: "nights", ...say(ev.won ? "seasonHeld" : "seasonLost", ev, { n: ev.season }), tag: { icon: "sun", word: TAG_WORDS.season }, facts: ev.won ? "The Long Dusk was held" : "The Long Dusk got in" });
        break;
    }
  }
  return out.reverse();
}

export interface JChapterGroup {
  /** set on the first (newest) entry of each age */
  chapter: { era: number; kicker: string; name: string } | null;
  entry: JEntry;
}

/** Filters the list and marks the newest entry of each age with its chapter heading (only on "All"). */
export function chaptered(entries: readonly JEntry[], filter: JFilter): JChapterGroup[] {
  const list = filter === "all" ? entries : entries.filter((e) => e.group === filter);
  let lastEra = -1;
  return list.map((entry) => {
    let chapter: JChapterGroup["chapter"] = null;
    if (filter === "all" && entry.era !== lastEra) chapter = { era: entry.era, kicker: `${TIERS[entry.era].name} age`, name: CHAPTERS[entry.era] };
    lastEra = entry.era;
    return { chapter, entry };
  });
}

export const PAGE = 60;
export const ariaFor = (e: JEntry): string => `Season ${e.season}, Day ${e.day}. ${e.title}.`;
