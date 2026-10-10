import { describe, expect, it } from "vitest";
import { B, B_TYPES, type BType } from "../src/core/rules";
import * as E from "../src/core/engine";
import type { IslandState } from "../src/core/state";
import { BUILD_GROUPS, BUILD_ORDER, landmarkCards, teaserFor, visibleGroups } from "../src/ui/buildMenu";

const names = (tier: number, list: BType[] = BUILD_ORDER) => visibleGroups(tier, list).flatMap((g) => g.types);

describe("build menu", () => {
  it("never lists a building the current era has not unlocked (no Roads in the Colony)", () => {
    const colony = names(0);
    for (const t of ["road", "trade", "lantern", "mirror", "hospital", "exchange", "harbour", "observatory"] as BType[]) expect(colony).not.toContain(t);
    for (const t of colony) expect(B[t].tier ?? 0).toBeLessThanOrEqual(0);
    expect(names(1)).toEqual(expect.arrayContaining(["road", "trade", "lantern"]));
    expect(names(1)).not.toContain("hospital");
    expect(names(3)).toEqual(expect.arrayContaining(["exchange", "harbour", "observatory"]));
  });
  it("puts every building type in exactly one function group", () => {
    const all = BUILD_GROUPS.flatMap((g) => g.types);
    expect([...all].sort()).toEqual([...B_TYPES].sort());
  });
  it("groups by function (Roads in Trade, Hourglass in Civic) and drops empty groups", () => {
    expect(visibleGroups(0, BUILD_ORDER).map((g) => g.title)).toEqual(["Defence", "Dwellings", "Food & farming", "Trade & industry", "Civic"]);
    expect(visibleGroups(0, BUILD_ORDER)[0].types).toEqual(["palisade", "tower"]);
    expect(visibleGroups(1, BUILD_ORDER).find((g) => g.id === "trade")!.types).toEqual(["workshop", "road", "trade"]);
    expect(visibleGroups(0, ["field"]).map((g) => g.id)).toEqual(["food"]);
  });
  it("shows one teaser line per group, never a name, instead of a bottom list", () => {
    expect(teaserFor("trade", 0, BUILD_ORDER)).toBe("New ways to work arrive in the Village.");
    expect(teaserFor("trade", 3, BUILD_ORDER)).toBeNull();
  });
});

describe("landmarks in the build menu", () => {
  const at = (tier: number): IslandState => {
    const st = E.newGame({ seed: 2 });
    st.tier = tier;
    return st;
  };
  it("none are offered before Town (locked ones are not in the sheet at all)", () => {
    expect(landmarkCards(at(0))).toEqual([]);
    expect(landmarkCards(at(1))).toEqual([]);
  });
  it("Town offers its three, City all six, and none of them is a building type", () => {
    expect(landmarkCards(at(2)).map((c) => c.id)).toEqual(["clock", "wreck", "bargain"]);
    expect(landmarkCards(at(3))).toHaveLength(6);
    for (const c of landmarkCards(at(3))) expect(B_TYPES as string[]).not.toContain(c.id);
  });
  it("a placed one says so (the button then moves it)", () => {
    const st = at(2);
    st.landmarks = { clock: "p:-2,-2" };
    expect(landmarkCards(st).map((c) => [c.id, c.placed])).toEqual([["clock", true], ["wreck", false], ["bargain", false]]);
  });
});
