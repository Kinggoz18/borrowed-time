import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { bandOf, duskHint, LINES, pickLine, QUIET } from "../src/core/hints";
import { hashState } from "../src/core/snapshot";

describe("dusk hints", () => {
  it("bands: light < 70% of defence, even 70-110%, heavy above", () => {
    expect(bandOf(69, 100)).toBe("light");
    expect(bandOf(70, 100)).toBe("even");
    expect(bandOf(110, 100)).toBe("even");
    expect(bandOf(111, 100)).toBe("heavy");
  });
  it("each night type and strength band has 4-5 short lines", () => {
    for (const kind of ["skiffs", "longboats", "longDusk"] as const) {
      for (const band of ["light", "even", "heavy"] as const) {
        const bank = LINES[kind][band];
        expect(bank.length, `${kind}/${band}`).toBeGreaterThanOrEqual(4);
        expect(bank.length, `${kind}/${band}`).toBeLessThanOrEqual(5);
        expect(new Set(bank).size).toBe(bank.length);
        for (const line of bank) {
          expect(line.length).toBeGreaterThan(8);
          expect(line.length).toBeLessThan(80);
          expect(line).not.toMatch(/\d/);
        }
      }
    }
    expect(QUIET.length).toBeGreaterThanOrEqual(4);
    expect(QUIET.length).toBeLessThanOrEqual(5);
    expect(new Set(QUIET).size).toBe(QUIET.length);
  });
  it("quiet nights are announced, raid nights hint without a number", () => {
    const st = E.newGame({ seed: 3 });
    st.day = 1;
    expect(duskHint(st).kind).toBe("quiet");
    expect(QUIET).toContain(duskHint(st).line);
    st.day = 2;
    const h = duskHint(st);
    expect(["skiffs", "longboats"]).toContain(h.kind);
    expect(h.band).not.toBeNull();
    expect(h.line).not.toMatch(/\d/);
    expect(LINES[h.kind as "skiffs" | "longboats"][h.band!]).toContain(h.line);
    expect(h.range).toBeNull();
    st.day = 6;
    expect(duskHint(st).kind).toBe("longDusk");
    expect(LINES.longDusk[duskHint(st).band!]).toContain(duskHint(st).line);
  });
  it("rotates lines by season and day without touching the island rng", () => {
    const a = ["one", "two", "three", "four", "five"];
    expect(pickLine(a, 1, 2)).not.toBe(pickLine(a, 4, 2));
    expect(pickLine(a, 1, 2)).not.toBe(pickLine(a, 1, 4));
    expect(pickLine(a, 1, 2)).toBe(pickLine(a, 1, 2));
    const st = E.newGame({ seed: 5 });
    st.day = 4;
    const before = hashState(st);
    const rng = st.rngS;
    const first = duskHint(st).line;
    expect(hashState(st)).toBe(before);
    expect(st.rngS).toBe(rng);
    st.season = 8;
    expect(duskHint(st).line).not.toBe(first);
    expect(st.rngS).toBe(rng);
  });
  it("reading a hint never changes the island (no RNG draw)", () => {
    const st = E.newGame({ seed: 5 });
    st.day = 4;
    const before = hashState(st);
    duskHint(st);
    expect(hashState(st)).toBe(before);
  });
});
