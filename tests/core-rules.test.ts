import { describe, expect, it } from "vitest";
import { Rng, seedState, step } from "../src/core/rng";
import { COUNT, TIERS, costMul, lotKeys, ramp, stageOf, xpNeed } from "../src/core/rules";

describe("seeded rng", () => {
  it("matches the prototype makeRng sequence", () => {
    // prototype: makeRng(seed) xorshift32; first values for seed 1
    function makeRng(seed: number) {
      let s = seed >>> 0 || 1;
      return () => {
        s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
        return s / 4294967296;
      };
    }
    const a = makeRng(110);
    const b = new Rng(110);
    for (let i = 0; i < 1000; i++) expect(b.next()).toBe(a());
  });
  it("keeps its state as a plain number", () => {
    const [v, s] = step(seedState(5));
    expect(typeof s).toBe("number");
    expect(step(s)[0]).not.toBe(v);
  });
});

describe("curves and tables", () => {
  it("costMul matches the plan's table", () => {
    expect(costMul(1).toFixed(2)).toBe("1.09");
    expect(costMul(4).toFixed(2)).toBe("1.68");
    expect(costMul(8).toFixed(2)).toBe("2.60");
    expect(costMul(20).toFixed(2)).toBe("4.07");
  });
  it("ramp and XP need follow the formulas", () => {
    expect(ramp(1).toFixed(2)).toBe("0.71");
    expect(xpNeed(1)).toBe(30);
    expect(xpNeed(2)).toBe(Math.round(30 * 2 ** 1.35));
  });
  it("seven looks, one every 3 levels, capped at grand", () => {
    expect([0, 2, 3, 6, 11, 12, 18, 20].map(stageOf)).toEqual([0, 0, 1, 2, 3, 4, 6, 6]);
  });
  it("tiers: build levels 1/3/7/11, grids, caps and City raid scale x1.12", () => {
    expect(TIERS.map((t) => t.lvl)).toEqual([1, 3, 7, 11]);
    expect(TIERS.map((t) => t.grid)).toEqual([7, 11, 15, 21]);
    expect(TIERS[3].threat).toBe(1.12);
    expect(lotKeys(0)).toHaveLength(48);
    expect(lotKeys(1)).toHaveLength(120);
  });
  it("building counts per tier", () => {
    expect(COUNT.cottage).toEqual([4, 10, 20, 40]);
    expect(COUNT.lantern[0]).toBe(0);
  });
});
