import { describe, expect, it } from "vitest";
import type { LoggedEvent } from "../src/core/game";
import { chaptered, dayLabel, journalEntries, journalPages, pageForEra, pageIndexOf } from "../src/ui/journalModel";

const seized = (seq: number, season: number, day: number, era = 0): LoggedEvent => ({ kind: "seized", seq, season, day, era, seizure: { k: "1,1", type: "workshop", n: 2, credit: 21 } }) as never;
const level = (seq: number, season: number, day: number, to: number, era = 0): LoggedEvent => ({ kind: "levelUp", seq, season, day, era, from: to - 1, to }) as never;
const borrowed = (seq: number, season: number, day: number, era = 0): LoggedEvent => ({ kind: "borrowed", seq, season, day, era, x: 3, first: true, shortTomorrow: 0 }) as never;
const season = (seq: number, season: number, day: number, era = 0): LoggedEvent => ({ kind: "seasonEnd", seq, season, day, era, won: true }) as never;

// day 1: two entries, day 3: one (days 2 and 4 are empty), season 2 day 2: two entries across an age change
const events: LoggedEvent[] = [borrowed(1, 1, 1), level(2, 1, 1, 5), seized(3, 1, 3), season(4, 2, 2, 1), level(5, 2, 2, 5, 1)];

describe("journal pages by day", () => {
  const entries = journalEntries(events, 3);
  const pages = journalPages(entries, "all");
  it("is one page per day that has entries, newest day first, empty days skipped", () => {
    expect(pages.map((p) => p.label)).toEqual(["Season 2 · Day 2", "Season 1 · Day 3", "Season 1 · Day 1"]);
    expect(pages.map((p) => p.count)).toEqual([2, 1, 2]);
    expect(pages.reduce((n, p) => n + p.count, 0)).toBe(entries.length);
    expect(dayLabel(4, 6)).toBe("Season 4 · Day 6");
  });
  it("keeps the entries newest first inside a page and never splits a day", () => {
    for (const p of pages) {
      const seqs = p.groups.map((g) => g.entry.seq);
      expect(seqs).toEqual([...seqs].sort((a, b) => b - a));
      for (const g of p.groups) expect(`${g.entry.season}:${g.entry.day}`).toBe(p.key);
    }
    expect(new Set(pages.map((p) => p.key)).size).toBe(pages.length);
  });
  it("filters per day: a filter drops the days with nothing to show", () => {
    const nights = journalPages(entries, "nights");
    expect(nights.map((p) => p.label)).toEqual(["Season 2 · Day 2"]);
    expect(nights[0].groups.every((g) => g.entry.group === "nights")).toBe(true);
    const hesper = journalPages(entries, "hesper");
    expect(hesper.map((p) => p.label)).toEqual(["Season 1 · Day 3", "Season 1 · Day 1"]);
    expect(journalPages(entries, "growth").map((p) => p.label)).toEqual(["Season 2 · Day 2", "Season 1 · Day 1"]);
  });
  it("puts chapter headings on the page where each age first shows, only under All", () => {
    const heads = pages.flatMap((p) => p.groups.filter((g) => g.chapter).map((g) => ({ page: p.label, era: g.chapter!.era })));
    expect(heads.map((h) => h.era)).toEqual([1, 0]);
    expect(heads[0].page).toBe("Season 2 · Day 2");
    expect(heads[1].page).toBe("Season 1 · Day 3");
    expect(journalPages(entries, "nights").every((p) => p.groups.every((g) => !g.chapter))).toBe(true);
    // the same headings the long list had
    expect(chaptered(entries, "all").filter((x) => x.chapter).length).toBe(heads.length);
  });
  it("finds a page by day and by age (for the day jumper and the chapter buttons)", () => {
    expect(pageIndexOf(pages, "1:3")).toBe(1);
    expect(pageIndexOf(pages, "9:9")).toBe(0);
    expect(pageForEra(pages, 1)).toBe(0);
    expect(pageForEra(pages, 0)).toBe(1);
    expect(pageForEra(pages, 3)).toBe(0);
  });
  it("has no pages when there is nothing written", () => {
    expect(journalPages([], "all")).toEqual([]);
  });
});
