import { describe, expect, it } from "vitest";
import { journalEntries, journalPage, JOURNAL_PAGE_SIZE, JOURNAL_FORBIDDEN_NAMES } from "../src/core/journal";
import { defaultMeta } from "../src/core/save";
import type { LoggedEvent } from "../src/core/game";

const meta = defaultMeta({ colonyName: "New Patience" });

function ev(partial: Record<string, unknown>): LoggedEvent {
  return { seq: 1, season: 1, day: 2, ...partial } as LoggedEvent;
}

describe("journal entries", () => {
  it("formats borrow, repay-to-zero, level and season result", () => {
    const rows = journalEntries(
      [
        ev({ kind: "borrowed", x: 10, dayLen: 12, shortTomorrow: 0, seq: 1 }),
        ev({ kind: "repaid", x: 10, cleared: true, seq: 2 }),
        ev({ kind: "levelUp", from: 1, to: 2, seq: 3 }),
        ev({ kind: "seasonEnd", season: 1, won: true, seq: 4 }),
      ],
      meta,
    );
    expect(rows.some((r) => r.text.includes("Borrowed 10"))).toBe(true);
    expect(rows.some((r) => r.text.includes("Paid Hesper to zero"))).toBe(true);
    expect(rows.some((r) => r.text.includes("Level 2"))).toBe(true);
    expect(rows.some((r) => r.text.includes("Long Dusk was held"))).toBe(true);
  });
  it("skips hourTick and dusk", () => {
    const rows = journalEntries([ev({ kind: "hourTick", gain: 1, seq: 1 }), ev({ kind: "dusk", dayKind: "quiet", seq: 2 })], meta);
    expect(rows).toHaveLength(0);
  });
  it("collapses builds on the same day", () => {
    const rows = journalEntries(
      [
        ev({ kind: "built", key: "a", type: "palisade", credit: false, cost: 1, seq: 1, day: 3 }),
        ev({ kind: "built", key: "b", type: "field", credit: false, cost: 1, seq: 2, day: 3 }),
      ],
      meta,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toMatch(/Palisade/);
    expect(rows[0].text).toMatch(/Field/);
  });
  it("pages at 60 entries", () => {
    const entries = Array.from({ length: 70 }, (_, i) => ({ key: String(i), season: 1, day: 1, text: `line ${i}` }));
    const p0 = journalPage(entries, 0);
    expect(p0.entries).toHaveLength(JOURNAL_PAGE_SIZE);
    expect(p0.hasEarlier).toBe(true);
    const p1 = journalPage(entries, 1);
    expect(p1.entries).toHaveLength(10);
    expect(p1.hasEarlier).toBe(false);
  });
  it("no random villager names in templates", () => {
    const rows = journalEntries(
      [
        ev({ kind: "borrowed", x: 5, dayLen: 12, shortTomorrow: 0, seq: 1 }),
        ev({ kind: "tierUp", tier: 1, seq: 2 }),
      ],
      meta,
    );
    for (const r of rows) {
      expect(r.text).not.toMatch(JOURNAL_FORBIDDEN_NAMES);
      expect(r.text).toMatch(/Hesper|Hours|Season/);
    }
  });
});
