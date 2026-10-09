import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { assignWalkers, blockedLots, facingOf, roadLots, route } from "../src/render/island/walkers";
import { radius } from "../src/render/island/layout";

describe("walker paths", () => {
  it("never routes through the gnomon or a building footprint", () => {
    const st = E.newGame({ seed: 1 });
    st.hours = 200;
    E.build(st, "1,1", "cottage");
    E.build(st, "-2,2", "workshop");
    const allow = new Set(["1,1", "-2,2"]);
    const blocked = blockedLots(st, allow);
    expect(blocked.has("0,0")).toBe(true);
    expect(blocked.has("1,1")).toBe(false);
    const path = route("1,1", "-2,2", blocked, new Set(), radius(st.tier));
    expect(path[0]).toBe("1,1");
    expect(path[path.length - 1]).toBe("-2,2");
    expect(path).not.toContain("0,0");
    for (const k of path.slice(1, -1)) expect(blocked.has(k), k).toBe(false);
  });
  it("prefers hour-line roads when they exist", () => {
    const st = E.newGame({ seed: 1 });
    st.hours = 200;
    E.build(st, undefined, "palisade");
    st.road = { n: 0, inv: 1 };
    const roads = roadLots(st);
    expect(roads.has("1,0")).toBe(true);
    expect(roads.has("0,1")).toBe(true);
    expect(roads.has("0,0")).toBe(false);
    const path = route("2,0", "-2,0", blockedLots(st, new Set()), roads, radius(st.tier));
    expect(path.some((k) => roads.has(k))).toBe(true);
  });
  it("gives each walker a home lot and a work lot", () => {
    const st = E.newGame({ seed: 1 });
    st.hours = 400;
    E.build(st, "1,1", "cottage");
    E.build(st, "-1,1", "cottage");
    E.build(st, "2,1", "field");
    E.build(st, "-2,2", "workshop");
    E.build(st, "2,-1", "tower");
    const plans = assignWalkers(st, 5);
    expect(plans).toHaveLength(5);
    expect(plans.map((p) => p.job).slice(0, 3)).toEqual(["nell", "ada", "tobias"]);
    for (const p of plans) {
      expect(p.home in st.lots).toBe(true);
      expect(p.work in st.lots).toBe(true);
    }
  });
  it("picks a 3/4 view from movement", () => {
    expect(facingOf(4, 2)).toBe("se");
    expect(facingOf(-4, 2)).toBe("sw");
    expect(facingOf(4, -2)).toBe("ne");
    expect(facingOf(-4, -2)).toBe("nw");
  });
});
