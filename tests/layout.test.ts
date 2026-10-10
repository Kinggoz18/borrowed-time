import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { phys, physRadius } from "../src/core/streets";
import { coastFor } from "../src/render/island/coast";
import { BUILDING_SCALE, cellAt, cellFront, eraOf, ISLAND_R, layoutIsland, lotAt, lotFront, lotCornerKeys, ringCells, ringStage, visibleFigures } from "../src/render/island/layout";

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
  it("the ring re-fits per tier: one cell outside the blocks, one gate on the avenue", () => {
    for (const r of [3, 5, 7, 10]) {
      const cells = ringCells(r);
      const R = physRadius(r) + 1;
      expect(cells).toHaveLength(8 * R);
      expect(cells.filter((c) => c.piece === "gate")).toHaveLength(1);
      expect(cells.find((c) => c.piece === "gate")).toMatchObject({ i: R, j: 2 });
      expect(cells.filter((c) => c.piece === "post")).toHaveLength(4);
      expect(cells.every((c) => Math.max(Math.abs(c.i), Math.abs(c.j)) === R)).toBe(true);
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
  it("fields sit on a plot decal at scale 1, cottages keep the 1.3 building scale", () => {
    const st = E.newGame({ seed: 1 });
    st.hours = 200;
    E.build(st, "-2,-2", "field");
    E.build(st, "2,2", "cottage");
    const lay = layoutIsland(st);
    const plot = lay.ground.find((g) => g.key === "-2,-2")!;
    expect(plot.frame).toMatch(/^g\/colony\/plot\//);
    expect(lay.things.find((t) => t.key === "-2,-2")!.scale).toBe(1);
    expect(lay.things.find((t) => t.key === "2,2")!.scale).toBe(BUILDING_SCALE);
    expect(lay.ground.find((g) => g.key === "2,2")!.frame).toMatch(/^g\/colony\/lot\//);
  });
  it("grey fields use the grey plot decal", () => {
    const st = E.newGame({ seed: 1 });
    st.hours = 200;
    E.build(st, "3,3", "field");
    E.borrow(st, E.limit(st));
    const lay = layoutIsland(st);
    const plot = lay.ground.find((g) => g.key === "3,3")!;
    expect(plot.frame.startsWith("grey/")).toBe(true);
    expect(plot.frame).toMatch(/plot/);
  });
  it("lot corner ticks stay off until Build is open or a lot is selected", () => {
    const st = E.newGame({ seed: 1 });
    st.hours = 200;
    E.build(st, "1,1", "cottage");
    const empty = Object.keys(st.lots).filter((k) => st.lots[k] == null);
    expect(lotCornerKeys(st.lots, null)).toEqual([]);
    expect(lotCornerKeys(st.lots, "1,1")).toEqual(["1,1"]);
    expect([...lotCornerKeys(st.lots, empty[0])].sort()).toEqual([...empty].sort());
    expect([...lotCornerKeys(st.lots, null, true)].sort()).toEqual([...empty].sort());
  });

  it("lots stand in city blocks: a lot maps to its block position and lotAt inverts lotFront", () => {
    for (const [i, j] of [[1, 0], [-2, 3], [4, -4], [7, 7]]) {
      const f = lotFront(i, j);
      expect(f).toEqual(cellFront(phys(i), phys(j)));
      expect(lotAt(f.x, f.y - 16)).toEqual({ i, j });
    }
    expect(lotAt(cellFront(2, 0).x, cellFront(2, 0).y - 16)).toBeNull(); // a street
  });
});

const all = () => true;
describe("streets and landmarks in the layout", () => {
  const at = (tier: number, road = true) => {
    const st = E.newGame({ seed: 4 });
    st.tier = tier;
    if (road) st.road = { n: 0, inv: 1 };
    return layoutIsland(st, { pixel: all });
  };
  it("no lot is drawn on a street, and every street cell is a paved tile once Roads are bought", () => {
    const lay = at(2);
    const streetTiles = lay.ground.filter((g) => g.frame.startsWith("st/town/"));
    expect(streetTiles.length).toBeGreaterThan(40);
    const lots = lay.ground.filter((g) => g.key).map((g) => `${g.x},${g.y}`);
    for (const g of streetTiles) expect(lots).not.toContain(`${g.x},${g.y}`);
    expect(lay.ground.some((g) => g.frame.startsWith("st/track/"))).toBe(false);
  });
  it("a dirt track before Roads, in every era; plazas are paved from the start", () => {
    const lay = at(1, false);
    expect(lay.ground.some((g) => g.frame.startsWith("st/track/"))).toBe(true);
    expect(lay.ground.some((g) => g.frame.startsWith("st/village/"))).toBe(false);
    expect(lay.ground.some((g) => g.frame === "plaza/village")).toBe(true);
  });
  it("is deterministic", () => {
    expect(at(3)).toEqual(at(3));
  });
  it("landmarks unlock by tier: none before Town, three in Town, six in City; never in the build list", () => {
    expect(at(0).landmarks).toHaveLength(0);
    expect(at(1).landmarks).toHaveLength(0);
    expect(at(2).landmarks.map((l) => l.id).sort()).toEqual(["bargain", "clock", "wreck"]);
    expect(at(3).landmarks.map((l) => l.id).sort()).toEqual(["bargain", "bell", "clock", "dial", "lighthouse", "wreck"]);
    for (const l of at(3).landmarks) expect(l.plaque.length).toBeGreaterThan(40);
    expect(at(3).things.filter((t) => t.frame.startsWith("land/"))).toHaveLength(6);
  });
  it("landmarks stand on street junctions or the shore, never on a lot, and shore ones never move", () => {
    const a = at(2), b = at(3);
    for (const lay of [a, b]) {
      const lots = new Set(lay.ground.filter((g) => g.key).map((g) => `${g.x},${g.y}`));
      for (const l of lay.landmarks) expect(lots.has(`${l.x},${l.y}`)).toBe(false);
    }
    for (const id of ["wreck", "clock", "bargain"]) expect(a.landmarks.find((l) => l.id === id)).toEqual(b.landmarks.find((l) => l.id === id));
    const coast = coastFor(ISLAND_R);
    for (const l of b.landmarks) expect(coast.isLand(l.i, l.j)).toBe(true);
  });
  it("landmarks wait for their art: not placed (or listed) while the era page has not streamed in", () => {
    const st = E.newGame({ seed: 4 });
    st.tier = 3;
    const lay = layoutIsland(st, { pixel: (f) => !f.startsWith("land/") });
    expect(lay.landmarks).toHaveLength(0);
  });
});

describe("one fixed island from the first day", () => {
  it("the coast, bounds and sea frame are the same at every tier", () => {
    const lays = [0, 1, 2, 3].map((t) => {
      const st = E.newGame({ seed: 9 });
      st.tier = t;
      return layoutIsland(st, { pixel: all });
    });
    for (const l of lays) {
      expect(l.bounds).toEqual(lays[0].bounds);
      expect(l.fitBounds).toEqual(lays[0].fitBounds);
    }
    // land cells (shore overlay positions) never change either
    for (const l of lays) expect(l.shore.length).toBe(lays[0].shore.length);
  });
  it("the ring, its gate and the tent are always inside the island, with beach beyond", () => {
    const coast = coastFor(ISLAND_R);
    for (const r of [3, 5, 7, 10]) {
      for (const c of ringCells(r)) expect(coast.isLand(c.i, c.j)).toBe(true);
      const R = physRadius(r) + 1;
      expect(coast.isLand(R + 2, -R + 3)).toBe(true);
      expect(R).toBeLessThan(coast.extent - 3);
    }
    const st = E.newGame({ seed: 9 });
    st.tier = 3;
    const lay = layoutIsland(st, { pixel: all });
    const fb = lay.fitBounds;
    for (const c of ringCells(10)) {
      const f = cellFront(c.i, c.j);
      expect(f.x).toBeGreaterThan(fb.x);
      expect(f.x).toBeLessThan(fb.x + fb.w);
      expect(f.y).toBeGreaterThan(fb.y);
      expect(f.y).toBeLessThan(fb.y + fb.h);
    }
  });
  it("the play frame follows the ring while the island frame stays put", () => {
    const a = layoutIsland(Object.assign(E.newGame({ seed: 9 }), { tier: 0 }), { pixel: all });
    const b = layoutIsland(Object.assign(E.newGame({ seed: 9 }), { tier: 3 }), { pixel: all });
    expect(b.playBounds.w).toBeGreaterThan(a.playBounds.w * 2);
    expect(b.fitBounds).toEqual(a.fitBounds);
  });
  it("unclaimed land is open meadow and woods that the ring clears as it grows", () => {
    const cnt = (tier: number) => {
      const st = E.newGame({ seed: 9 });
      st.tier = tier;
      return layoutIsland(st, { pixel: all }).things.filter((t) => t.frame.startsWith("sc/tree/")).length;
    };
    expect(cnt(0)).toBeGreaterThan(cnt(3));
    expect(cnt(3)).toBeGreaterThan(0);
  });
});

describe("draw order uses the drawn (physical) position", () => {
  it("a building is sorted by where it stands, so a tree or landmark in front of it covers it and the reverse", () => {
    const st = E.newGame({ seed: 4 });
    st.tier = 3;
    st.hours = 1000;
    st.lots["9,9"] = { type: "cottage", n: 3, inv: 1 };
    const lay = layoutIsland(st, { pixel: () => true });
    const b = lay.things.find((t) => t.key === "9,9")!;
    expect(b.z).toBe((phys(9) + phys(9)) * 100 + 10);
    const clock = lay.things.find((t) => t.frame === "land/clock")!; // at the back, behind the cottage
    expect(clock.z).toBeLessThan(b.z);
  });
});
