import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { cellAt, cellFront, eraOf, layoutIsland, ringCells, ringStage, visibleFigures } from "../src/render/island/layout";

describe("island layout", () => {
  it("cellAt inverts cellFront", () => {
    for (const [i, j] of [[0, 0], [3, -2], [-5, 4], [2, 2]]) {
      const p = cellFront(i, j);
      expect(cellAt(p.x, p.y - 16)).toEqual({ i, j });
    }
  });
  it("no ring before the Palisade; the ring appears once bought", () => {
    const st = E.newGame({ seed: 1 });
    expect(layoutIsland(st).ring).toHaveLength(0);
    st.hours = 100;
    expect(E.build(st, undefined, "palisade")).toBe(true);
    expect(ringStage(st)).toBe(0);
    expect(layoutIsland(st).ring.length).toBe(ringCells(3).length);
  });
  it("the ring re-fits per tier: one cell outside the lots, one gate", () => {
    for (const r of [3, 5, 7, 10]) {
      const cells = ringCells(r);
      expect(cells).toHaveLength(8 * (r + 1));
      expect(cells.filter((c) => c.piece === "gate")).toHaveLength(1);
      expect(cells.filter((c) => c.piece === "post")).toHaveLength(4);
      expect(cells.every((c) => Math.max(Math.abs(c.i), Math.abs(c.j)) === r + 1)).toBe(true);
    }
  });
  it("grey land: the front lots go grey first and show the grey frame", () => {
    const st = E.newGame({ seed: 1 });
    E.borrow(st, 10);
    const lay = layoutIsland(st);
    const grey = lay.ground.filter((g) => g.frame.startsWith("grey/"));
    expect(grey.length).toBe(E.greyCount(st));
    const front = Math.max(...lay.ground.filter((g) => g.key).map((g) => g.y));
    expect(grey.some((g) => g.y === front)).toBe(true);
  });
  it("buildings draw the era look and depth-sort back to front", () => {
    const st = E.newGame({ seed: 1 });
    st.hours = 200;
    E.build(st, "-2,-2", "field");
    E.build(st, "2,2", "cottage");
    const lay = layoutIsland(st);
    const a = lay.things.find((t) => t.key === "-2,-2")!, b = lay.things.find((t) => t.key === "2,2")!;
    expect(a.frame).toBe("b/colony/field/0");
    expect(a.z).toBeLessThan(b.z);
    expect(eraOf(0)).toBe("colony");
    expect(eraOf(1)).toBe("village");
  });
  it("visible figures are a sample capped per quality tier", () => {
    expect(visibleFigures(6, 20)).toBe(3);
    expect(visibleFigures(160, 20)).toBe(20);
    expect(visibleFigures(160, 50)).toBe(50);
  });
});
