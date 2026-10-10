import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { bandOf, duskHint, duskRead, HINT_SPREAD, LINES, noonCall, noonHour, NOON_CALM_LINE, OBS_HINT_SPREAD, pickLine, QUIET, rangeBar, strengthRange } from "../src/core/hints";
import { lotKeys } from "../src/core/rules";
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
    expect(h.range).not.toBeNull();
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
    duskRead(st);
    expect(hashState(st)).toBe(before);
  });
  it("shows a ±25% raider range, narrowed to ±10% with an Observatory", () => {
    const st = E.newGame({ seed: 3 });
    st.day = 2;
    const n = E.nominal(st);
    const h = duskHint(st);
    expect(h.range).toEqual(strengthRange(n, HINT_SPREAD));
    const wide = h.range![1] - h.range![0];
    st.tier = 3;
    st.L = 12;
    st.hours = 5000;
    for (const k of lotKeys(3)) if (!(k in st.lots)) st.lots[k] = null;
    const lot = E.greyOrder(st).slice().reverse().find((k) => E.isFree(st, k))!;
    expect(E.build(st, lot, "observatory")).toBe(true);
    const n1 = E.nominal(st);
    const obs = duskHint(st);
    expect(obs.range).toEqual(strengthRange(n1, OBS_HINT_SPREAD));
    const without = strengthRange(n1, HINT_SPREAD);
    expect(obs.range![1] - obs.range![0]).toBeLessThan(without[1] - without[0]);
    expect(wide).toBeGreaterThan(0);
  });
  it("dusk read lists defence now and the defence each choice would give", () => {
    const st = E.newGame({ seed: 3 });
    st.hours = 200;
    E.build(st, "pal", "palisade");
    st.day = 2;
    const r = duskRead(st);
    expect(r.defence).toBe(E.defence(st));
    expect(r.wallsDefence).toBe(E.defence(st, { walls: true }));
    expect(r.borrowDefence).toBe(E.defence(st, { borrow: true }));
    expect(r.wallsDefence).toBeGreaterThan(r.defence);
    expect(r.borrowDefence).toBeGreaterThan(r.defence);
    expect(r.canBorrow).toBe(true);
    expect(r.loan).toBe(E.duskLoan(st));
    expect(r.hint.range).not.toBeNull();
  });
  it("noon hour sits before dusk for day lengths 7–12", () => {
    for (const dayLen of [7, 8, 9, 10, 11, 12]) {
      const h = noonHour(dayLen);
      expect(h).toBeGreaterThanOrEqual(1);
      expect(h).toBeLessThan(dayLen);
    }
  });
  it("noon call matches dusk hint on raid and boss days, calm line on quiet", () => {
    const st = E.newGame({ seed: 3 });
    st.day = 1;
    expect(noonCall(st).calm).toBe(true);
    expect(noonCall(st).line).toBe(NOON_CALM_LINE);
    st.day = 2;
    const call = noonCall(st);
    const dusk = duskHint(st);
    expect(call.line).toBe(dusk.line);
    expect(call.kind).toBe(dusk.kind);
    expect(call.band).toBe(dusk.band);
    st.day = 6;
    expect(noonCall(st).line).toBe(duskHint(st).line);
  });
  it("reading the noon call never changes the island", () => {
    const st = E.newGame({ seed: 9 });
    st.day = 4;
    const before = hashState(st);
    noonCall(st);
    expect(hashState(st)).toBe(before);
  });

  it("the range bar places defence on the same scale as the raiders", () => {
    const b = rangeBar(12, 9, 15);
    expect(b.defPct).toBeGreaterThan(b.loPct);
    expect(b.defPct).toBeLessThan(b.loPct + b.widthPct + 1);
    expect(b.loPct + b.widthPct).toBeLessThan(100);
  });
});
