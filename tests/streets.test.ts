import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { TIERS } from "../src/core/rules";
import { blockOf, blocks, gateCell, isStreetLine, logical, phys, physRadius, streetAt, streetCells, streetMask } from "../src/core/streets";

const R = TIERS.map((t) => (t.grid - 1) / 2);

describe("street grid", () => {
  it("maps every lot to one physical cell and back, with a street between blocks of three", () => {
    for (let c = -12; c <= 12; c++) {
      expect(logical(phys(c))).toBe(c);
      expect(isStreetLine(phys(c))).toBe(false);
    }
    // the gnomon's block is -1..1; streets lie on every fourth line
    expect([-1, 0, 1].map(phys)).toEqual([-1, 0, 1]);
    expect([2, 3, 4].map(phys)).toEqual([3, 4, 5]);
    expect([-4, -3, -2].map(phys)).toEqual([-5, -4, -3]);
    for (const P of [-10, -6, -2, 2, 6, 10]) expect(logical(P)).toBeNull();
    expect(blockOf(-2)).toBe(-1);
    expect(blockOf(1)).toBe(0);
    expect(blockOf(2)).toBe(1);
  });
  it("is deterministic and nested: a bigger tier only adds street cells", () => {
    for (let t = 0; t < R.length - 1; t++) {
      const small = new Set(streetCells(R[t]).map((c) => `${c.i},${c.j}`));
      const big = new Set(streetCells(R[t + 1]).map((c) => `${c.i},${c.j}`));
      for (const k of small) expect(big.has(k)).toBe(true);
      expect(big.size).toBeGreaterThan(small.size);
    }
    expect(streetCells(10)).toEqual(streetCells(10));
  });
  it("the built area is a square of lots plus streets; every lot maps inside it", () => {
    for (const r of R) {
      const PR = physRadius(r);
      for (let i = -r; i <= r; i++)
        for (let j = -r; j <= r; j++) {
          expect(Math.abs(phys(i))).toBeLessThanOrEqual(PR);
          expect(streetAt(phys(i), phys(j), r)).toBeNull();
        }
    }
    expect(R.map(physRadius)).toEqual([4, 7, 9, 13]);
  });
  it("the streets form one connected network that reaches the gate at every tier", () => {
    for (const r of R) {
      const cells = streetCells(r);
      const keys = new Set(cells.map((c) => `${c.i},${c.j}`));
      const g = gateCell(r);
      keys.add(`${g.i},${g.j}`);
      const seen = new Set<string>([`${g.i},${g.j}`]);
      const q = [`${g.i},${g.j}`];
      while (q.length) {
        const [i, j] = q.pop()!.split(",").map(Number);
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${i + a},${j + b}`;
          if (keys.has(k) && !seen.has(k)) {
            seen.add(k);
            q.push(k);
          }
        }
      }
      expect(seen.size).toBe(keys.size);
    }
  });
  it("streets never overlap a lot, and blocks cover exactly the lots", () => {
    for (const r of R) {
      const lots = new Set<string>();
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) lots.add(`${phys(i)},${phys(j)}`);
      for (const c of streetCells(r)) expect(lots.has(`${c.i},${c.j}`)).toBe(false);
      const inBlocks = new Set<string>();
      for (const [i0, i1, j0, j1] of blocks(r))
        for (let i = i0; i <= i1; i++)
          for (let j = j0; j <= j1; j++) {
            const k = `${i},${j}`;
            expect(inBlocks.has(k)).toBe(false);
            inBlocks.add(k);
          }
      for (const k of lots) expect(inBlocks.has(k)).toBe(true);
    }
  });
  it("junction masks: straight, T, cross, plaza, gate road", () => {
    expect(streetMask(4, 2, 5)).toBe(1 | 2); // along the avenue j = 2
    expect(streetMask(2, 4, 5)).toBe(4 | 8); // along the cross street i = 2
    expect(streetMask(2, 2, 5)).toBe(15); // crossing
    expect(streetMask(-6, 2, 5)).toBe(1 | 2 | 4 | 8);
    expect(streetMask(-7, 2, 5)).toBe(1); // end of the avenue at the ring
    expect(streetMask(2, -7, 5)).toBe(4); // end of the cross street
    const g = gateCell(5);
    expect(g).toEqual({ i: 8, j: 2 });
    expect(streetMask(g.i, g.j, 5)).toBe(2);
    expect(streetMask(7, 2, 5)).toBe(1 | 2);
  });
});

describe("streets are layout only: the rules and lots are untouched", () => {
  it("the lot grid and the economy are exactly the Village/Town/City grids of the rules", () => {
    const st = E.newGame({ seed: 3 });
    expect(Object.keys(st.lots)).toHaveLength(48);
    st.hours = 500;
    expect(E.canBuild(st, "1,0", "field")).toBe(true);
    expect(E.cost("field", 0, 1)).toBe(E.cost("field", 0, 1));
  });
  it("big footprints stay inside one city block", () => {
    const st = E.newGame({ seed: 3 });
    st.tier = 3;
    st.L = 20;
    for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) if ((i || j) && !(`${i},${j}` in st.lots)) st.lots[`${i},${j}`] = null;
    // block 1 holds 2..4, so a level-18 workshop (3x3) at (4,4) fits; at (5,5) it would reach back across the street
    st.lots["4,4"] = { type: "workshop", n: 18, inv: 1 };
    expect(E.claims(st).size["4,4"]).toBe(3);
    st.lots["4,4"] = null;
    st.lots["5,5"] = { type: "workshop", n: 12, inv: 1 };
    expect(E.claims(st).size["5,5"]).toBeUndefined();
    st.lots["6,6"] = { type: "workshop", n: 12, inv: 1 };
    expect(E.claims(st).size["6,6"]).toBeUndefined();
    st.lots["5,5"] = null;
    expect(E.claims(st).size["6,6"]).toBe(2);
  });
});
