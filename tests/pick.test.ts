import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import type { IslandState } from "../src/core/state";

const fresh = (seed = 3): IslandState => E.newGame({ seed });
const rich = (st: IslandState, h = 500): IslandState => ((st.hours = h), st);
import { cellFront, layoutIsland, lotFront, TW } from "../src/render/island/layout";
import { pickAt as pick } from "../src/render/island/pick";

describe("pickAt", () => {
  it("prefers a building lot over Hesper's tent when both overlap in x", () => {
    const st = rich(fresh(), 500);
    E.build(st, "pal", "palisade");
    const lot = Object.keys(st.lots).find((k) => st.lots[k] === null && Math.abs(+k.split(",")[0]) <= 2)!;
    E.build(st, lot, "field");
    const layout = layoutIsland(st);
    const [i, j] = lot.split(",").map(Number);
    const f = lotFront(i, j);
    expect(pick(f.x, f.y - 8, st, layout)).toBe(lot);
  });

  it("returns pal when tapping the ring", () => {
    const st = rich(fresh(), 500);
    E.build(st, "pal", "palisade");
    const layout = layoutIsland(st);
    const ring = layout.ring[0];
    expect(pick(ring.x, ring.y - 8, st, layout)).toBe("pal");
  });

  it("tent opens only on the tent tile, not the shore beside it", () => {
    const st = rich(fresh(), 500);
    const layout = layoutIsland(st);
    const t = layout.tent;
    expect(pick(t.x + TW, t.y, st, layout)).not.toBe("tent");
    expect(pick(t.x, t.y - 8, st, layout)).toBe("tent");
  });
});

describe("pickAt: streets and landmarks", () => {
  it("a street between blocks picks nothing; a lot beside it still picks the lot", () => {
    const st = rich(fresh(), 500);
    const layout = layoutIsland(st);
    const s = cellFront(2, 4); // street line i = 2
    expect(pick(s.x, s.y - 16, st, layout)).toBeNull();
    const lot = "2,-2";
    const f = lotFront(2, -2);
    expect(pick(f.x, f.y - 16, st, layout)).toBe(lot);
  });
  it("a landmark answers with land:<id> on its body and its ground, from its tier on", () => {
    const st = rich(fresh(), 500);
    st.tier = 2;
    st.landmarks = { clock: "p:-2,-2" };
    const layout = layoutIsland(st);
    const clock = layout.landmarks.find((l) => l.id === "clock")!;
    expect(pick(clock.x, clock.y - 60, st, layout)).toBe("land:clock");
    expect(pick(clock.x, clock.y - 16, st, layout)).toBe("land:clock");
    expect(layoutIsland(fresh()).landmarks).toHaveLength(0);
    st.landmarks = undefined;
    expect(layoutIsland(st).landmarks).toHaveLength(0);
  });
});
